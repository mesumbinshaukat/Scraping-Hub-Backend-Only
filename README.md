# Serverless Scraping Backend

A robust Express.js backend for web scraping, optimized for Vercel Serverless Functions. Features multi-phase scraping, dynamic fallback strategies, and extensive resource integration.

## Features

- **Multi-Phase Scraping**:
  1. **Static**: Axios + Cheerio (fastest).
  2. **Proxy Static**: Auto-rotating proxies for bypass.
  3. **Dynamic**: Playwright (Stealth mode) for JS-heavy sites.
  4. **Search Fallback**: Smart fallback to 50+ search engines and RSS feeds.
- **Smart Search**: NLP-powered intent analysis, suggestions for zero-results, and "news"/"blog" filtering.
- **Resilience**: Rate limiting, retry with exponential backoff, health checks, and robot.txt compliance.
- **Performance**: In-memory queuing, cache (Vercel optimization), and minimal cold starts.
- **APIs**: Scrape, Search (News/Blog/Web), RSS, Sitemap, Validate, Stats.
- **Maintenance**: Automated cron cleanup for logs.

## Security & Configuration

This API is secured via Bearer Token.

### Environment Variables (.env)
Set these in Vercel Dashboard or `.env` locally:
```bash
MASTER_KEY=your_secure_random_key_here
RATE_LIMIT=100
PROXY_ENABLED=false
SCRAPE_DELAY=1000
MAX_RESULTS=50
CRON_SECRET=your_cron_secret
```

### Authentication
- **Master Key**: Used for admin/cron tasks.
- **Generated Keys**: Call `node src/scripts/generate-key.js` locally.

### Key Generation
To generate a new secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Or for the Cron Secret:
```bash
node src/scripts/generate-cron-secret.js
```

## Installation

```bash
npm install
```

## Local Development

```bash
npm run dev
```

## Testing

```bash
npm test
```

## Deployment to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel`
3. Set Environment Variables in dashboard (CRON_SECRET, MASTER_KEY, etc.).

**Note**: On Vercel Serverless, SQLite (`access_logs.json`) is ephemeral (resets on deployment). For persistent stats, use an external Database or Vercel KV.

## API Documentation

See [api.md](api.md) for detailed endpoint usage.

## Resources & Bypass Strategies

- **50+ Search Engines**: Includes SearxNG instances, Qwant, Mojeek, etc.
- **Proxies**: Can scrape free proxies via `src/utils/proxyManager.js` (enable with `PROXY_ENABLED=true`). Recommended to use a paid proxy service/URL in production.
- **Stealth**: Uses `playwright-extra` + `stealth` plugin to mimic human behavior.

## Disclaimer

This tool is for educational/research purposes. 
- Respect `robots.txt` (this tool checks it by default).
- Do not overload sites (respect rate limits).
- The author is not liable for misuse.
