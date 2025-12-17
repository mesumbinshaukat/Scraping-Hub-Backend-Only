# Serverless Scraping Backend

A robust Express.js backend for web scraping, optimized for Vercel Serverless Functions. Features multi-phase scraping, fallback strategies, and extensive resource integration.

## Features

- **Multi-Phase Scraping**:
  1. Static (Axios + Cheerio)
  2. Dynamic (Playwright)
  3. Search Fallback (DuckDuckGo, etc.)
- **APIs**: Scrape, RSS, Sitemap, Validate, News, Blog.
- **Performance**: In-memory queuing, Rate limiting, User-Agent rotation.
- **Stats**: Request logging to embedded SQLite (`scraping.db`).
- **Maintenance**: Automated cron cleanup.

## Security
This API is secured via Bearer Token.

### 1. Master Key (Recommended for Vercel)
Set the `MASTER_KEY` environment variable in your Vercel Dashboard.
- **Generated Key**: `5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec`
- **How to Generate New Key**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### 2. Generated Keys (Local/Database)
Run the generation script to create a key stored in the local SQLite DB:
```bash
node src/scripts/generate-key.js
```
*Note: On Vercel Serverless, file-based DBs are ephemeral. Use MASTER_KEY for persistent access.*

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

## Deployment

Deploy to Vercel:

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel`

Ensure you set the Environment Variables in Vercel Dashboard (CRON_SECRET, etc.). Note that on Vercel Serverless, SQLite data is ephemeral and resets on deployment; use an external DB if persistence across deployments is required.

## Disclaimer

This tool is for personal research only. Respect website TOS and laws; author not liable for misuse.
