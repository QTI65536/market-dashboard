// Fetches Dow / S&P 500 / Nasdaq quotes from Financial Modeling Prep and writes site/data.json.
// Runs inside GitHub Actions. The API key comes from the FMP_API_KEY repo secret and never reaches the page.
import fs from 'node:fs/promises';

const KEY = process.env.FMP_API_KEY;
const BASE = (process.env.PAGES_URL || '').replace(/\/$/, '');
const FORCE = process.env.FORCE === 'true';
const OUT = 'site';

const SETS = {
  index: [
    { id: 'dow', sym: '^DJI',  name: 'Dow Jones' },
    { id: 'spx', sym: '^GSPC', name: 'S&P 500' },
    { id: 'ndx', sym: '^IXIC', name: 'Nasdaq Composite' },
  ],
  etf: [
    { id: 'dow', sym: 'DIA', name: 'Dow Jones' },
    { id: 'spx', sym: 'SPY', name: 'S&P 500' },
    { id: 'ndx', sym: 'QQQ', name: 'Nasdaq-100' },
  ],
};

// Current New York wall-clock time
const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
const day = `${ny.getFullYear()}-${String(ny.getMonth() + 1).padStart(2, '0')}-${String(ny.getDate()).padStart(2, '0')}`;
const mins = ny.getHours() * 60 + ny.getMinutes();
const weekday = ny.getDay() >= 1 && ny.getDay() <= 5;
const inSession = weekday && mins >= 9 * 60 + 25 && mins <= 16 * 60 + 15;

async function loadPrevious() {
  if (!BASE) return null;
  try {
    const r = await fetch(`${BASE}/data.json?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function quote(sym) {
  const url = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(sym)}&apikey=${KEY}`;
  const r = await fetch(url);
  const body = await r.text();
  let j; try { j = JSON.parse(body); } catch { throw new Error(`${sym}: non-JSON response (${r.status})`); }
  if (!r.ok || !Array.isArray(j) || !j.length || j[0].price == null) {
    const msg = (j && (j['Error Message'] || j.message)) || body.slice(0, 160);
    throw new Error(`${sym}: ${r.status} ${msg}`);
  }
  return j[0];
}

async function fetchSet(set) {
  const out = {};
  for (const it of SETS[set]) {
    const q = await quote(it.sym);
    const prevClose = q.previousClose ?? (q.price - (q.change ?? 0));
    const pct = v => (v != null && prevClose ? (v - prevClose) / prevClose * 100 : null);
    out[it.id] = {
      sym: it.sym, name: it.name, price: q.price, prevClose,
      changePct: q.changePercentage ?? q.changesPercentage ?? pct(q.price),
      highPct: pct(q.dayHigh), lowPct: pct(q.dayLow),
      ts: q.timestamp ?? Math.floor(Date.now() / 1000),
    };
  }
  return out;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.copyFile('index.html', `${OUT}/index.html`);
  const prev = await loadPrevious();

  // Outside market hours: redeploy the last snapshot without spending API calls.
  if (!inSession && !FORCE && prev && prev.quotes) {
    prev.marketOpen = false;
    await fs.writeFile(`${OUT}/data.json`, JSON.stringify(prev));
    console.log('Market closed, reused previous data.');
    return;
  }
  if (!KEY) throw new Error('FMP_API_KEY secret is not set.');

  let source = prev?.source === 'etf' ? 'etf' : 'index';
  let quotes;
  try {
    quotes = await fetchSet(source);
  } catch (e) {
    if (source !== 'index') throw e;
    console.warn(`Index quotes unavailable (${e.message}). Falling back to ETFs.`);
    source = 'etf';
    quotes = await fetchSet(source);
  }

  const history = prev && prev.day === day && prev.source === source ? prev.history || {} : {};
  for (const [id, q] of Object.entries(quotes)) {
    const h = history[id] || [];
    if (!h.length || h[h.length - 1][0] !== q.ts) h.push([q.ts, Math.round(q.changePct * 100) / 100]);
    history[id] = h.slice(-150);
  }

  const data = { updated: new Date().toISOString(), day, source, marketOpen: inSession, quotes, history };
  await fs.writeFile(`${OUT}/data.json`, JSON.stringify(data));
  console.log(`Wrote data.json from ${source}:`, Object.values(quotes).map(q => `${q.sym} ${q.changePct.toFixed(2)}%`).join('  '));
}

main().catch(e => { console.error(e.message); process.exit(1); });
