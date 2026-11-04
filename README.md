# QTI's Market Pulse

Instrument-cluster gauges for the Dow, S&P 500 and Nasdaq, fed by Financial Modeling Prep.

A GitHub Action fetches quotes every 10 minutes during market hours, writes `data.json`, and redeploys the page. The FMP key lives in a repo secret and never reaches the browser, so any number of visitors share one cached data file.

## Setup

1. Create a new repo (for example `market-pulse`) and upload everything in this folder, keeping the `.github` and `scripts` folders.
2. **Settings → Secrets and variables → Actions → New repository secret.** Name it `FMP_API_KEY` and paste your FMP key.
3. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
4. **Actions → Market Pulse → Run workflow.** The first run fetches quotes immediately, whatever the time.
5. The page is live at `https://<your-user>.github.io/market-pulse/`.

## How it behaves

- Tries real index quotes (`^DJI`, `^GSPC`, `^IXIC`) first. If the free plan refuses them, it switches to the ETFs `DIA`, `SPY`, `QQQ` and stays there. The page says which source it is showing.
- Outside 9:25 AM–4:15 PM ET on weekdays it spends no API calls and keeps the last snapshot up.
- About 40 runs per trading day × 3 calls ≈ 120 of the 250 daily calls. Each manual run uses 3 more.
- The sparkline is built from that day's runs and resets on the next trading day.
- The page re-reads `data.json` every minute, so open tabs pick up each new run without a reload.

## Notes

- GitHub's scheduler often starts runs 5–15 minutes late, especially at the top of the hour. The feed lamp turns amber ("Delayed") if data is more than 30 minutes old during the session.
- GitHub pauses scheduled workflows in repos with no activity for 60 days. Any commit, or a manual run, re-enables them.
- Opening `index.html` straight from disk shows the built-in snapshot, since there is no `data.json` there.
