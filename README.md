
# Geopolitical Dashboard (React + Vite + TS)

A no-auth, free-API dashboard for geopolitics & humanitarian situational awareness.

## Data sources (no API keys required)
- **World Bank** Indicators API — macro & governance (WGI) time series
- **REST Countries** — country facts, ISO codes, flags
- **ReliefWeb** (UNOCHA) — latest humanitarian reports
- **NASA EONET** — open natural events, mapped

## Quick start
```bash
npm install
npm run dev
# open http://localhost:5173
```

## Notes
- If you hit a CORS issue in dev, you can enable the commented proxies in `vite.config.ts`.
- For production deployment, host behind a reverse proxy if your hosting environment requires CORS mediation.

## Useful indicators
- `PV.EST` Political Stability (estimate)
- `GE.EST` Government Effectiveness (estimate)
- `CC.EST` Control of Corruption (estimate)
- `NY.GDP.MKTP.KD.ZG` GDP growth (annual %)
- `FP.CPI.TOTL.ZG` CPI inflation (annual %)
