# API Documentation

Base URL: `/api`

## Authentication
**All endpoints require authentication.**

You must provide a valid API Key in the `Authorization` header.

**Header Format:**
`Authorization: Bearer <YOUR_API_KEY>`

### How to get an API Key?
1. **Local/Development**: Run `node src/scripts/generate-key.js` to generate and store a key in your local `scraping.db`.
2. **Production (Vercel)**: Set the `MASTER_KEY` environment variable in your Vercel Project Settings.
   - **Current Master Key**: `5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec` (Set in local .env)

---

## 2. Postman Examples

### Request: Scrape URL
**Method**: `GET`
**URL**: `https://your-app.vercel.app/api/scrape`
**Headers**:
- `Authorization`: `Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec`
**Params**:
- `url`: `https://example.com`

**cURL**:
```bash
curl --location 'https://your-app.vercel.app/api/scrape?url=https://example.com' \
--header 'Authorization: Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec'
```

### Request: Get Daily Stats
**Method**: `GET`
**URL**: `https://your-app.vercel.app/api/stats/daily`
**Headers**:
- `Authorization`: `Bearer <YOUR_API_KEY>`

**cURL**:
```bash
curl --location 'https://your-app.vercel.app/api/stats/daily' \
--header 'Authorization: Bearer YOUR_SECRET_KEY'
```

---

## 3. Endpoints Reference

### `GET /scrape`
... (Same as before)
