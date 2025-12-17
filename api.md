# API Documentation

**Base URL**: `https://scraping-hub-backend-only.vercel.app/api`

All endpoints require Bearer token authentication.

---

## Authentication

**Required Header**:
```
Authorization: Bearer YOUR_API_KEY
```

### How to Get an API Key

1. **For Vercel (Production)**: Set `MASTER_KEY` environment variable in Vercel Dashboard
2. **For Local Development**: Run `node src/scripts/generate-key.js`

**Current Master Key** (for testing): `5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec`

---

## Endpoints

### 1. Health Check

**Endpoint**: `GET /api/health`

**Description**: Check if the API is running

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/health" -Headers @{Authorization="Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec"}
```

**cURL Example**:
```bash
curl -H "Authorization: Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec" \
  https://scraping-hub-backend-only.vercel.app/api/health
```

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-17T08:30:00.000Z"
}
```

---

### 2. Scrape Website

**Endpoint**: `GET /api/scrape?url=<URL>`

**Description**: Scrapes a website using multi-phase strategy (static → dynamic → fallback)

**Parameters**:
- `url` (required): The URL to scrape

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/scrape?url=https://example.com" -Headers @{Authorization="Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec"}
```

**cURL Example**:
```bash
curl -H "Authorization: Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec" \
  "https://scraping-hub-backend-only.vercel.app/api/scrape?url=https://example.com"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "title": "Example Domain",
    "description": "Example Domain description",
    "content": "This domain is for use in illustrative examples...",
    "image": "https://example.com/image.jpg",
    "links": [
      "https://www.iana.org/domains/example"
    ],
    "method": "static_phase_1"
  }
}
```

---

### 3. Parse RSS Feed

**Endpoint**: `GET /api/rss?url=<RSS_URL>`

**Description**: Parses RSS/Atom feeds and returns items

**Parameters**:
- `url` (required): RSS feed URL

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/rss?url=https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" -Headers @{Authorization="Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec"}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "title": "Article Title",
        "link": "https://example.com/article",
        "description": "Article description",
        "pubDate": "2025-12-17T08:00:00Z"
      }
    ]
  }
}
```

---

### 4. Parse Sitemap

**Endpoint**: `GET /api/sitemap?url=<SITEMAP_URL>`

**Description**: Parses XML sitemaps and extracts URLs

**Parameters**:
- `url` (required): Sitemap URL

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/sitemap?url=https://example.com/sitemap.xml" -Headers @{Authorization="Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec"}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "urls": [
      {
        "loc": "https://example.com/page1",
        "lastmod": "2025-12-01",
        "priority": "1.0"
      }
    ]
  }
}
```

---

### 5. Validate URL

**Endpoint**: `GET /api/validate?url=<URL>`

**Description**: Checks if a URL is valid and accessible

**Parameters**:
- `url` (required): URL to validate

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/validate?url=https://example.com" -Headers @{Authorization="Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec"}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "status": 200,
    "contentExists": true
  }
}
```

---

### 6. Search News

**Endpoint**: `GET /api/news?query=<QUERY>`

**Description**: Searches for news articles using fallback resources

**Parameters**:
- `query` (required): Search query
- `limit` (optional): Max results (default 50)

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/news?query=technology" -Headers @{Authorization="Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec"}
```

**Response**:
```json
{
  "success": true,
  "type": "news",
  "query": "technology news",
  "count": 10,
  "data": {
    "results": [
      {
        "url": "https://example.com/tech-news",
        "title": "Tech News Article",
        "source": "fox_news"
      }
    ]
  }
}
```

---

### 7. Search Blogs

**Endpoint**: `GET /api/blog?query=<QUERY>`

**Description**: Searches for blog posts using fallback resources

**Parameters**:
- `query` (required): Search query

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/blog?query=web+development" -Headers @{Authorization="Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec"}
```

**Response**:
```json
{
  "success": true,
  "type": "blog",
  "query": "web development blog",
  "count": 10,
  "data": {
    "results": [
      {
        "url": "https://example.com/blog-post",
        "title": "Web Development Blog Post",
        "source": "medium_tech"
      }
    ]
  }
}
```

---

### 8. Get Statistics

**Endpoint**: `GET /api/stats/:period`

**Description**: Retrieves API usage statistics

**Parameters**:
- `period` (required): One of `daily`, `weekly`, or `monthly`

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/stats/daily" -Headers @{Authorization="Bearer 5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec"}
```

**Response**:
```json
{
  "period": "daily",
  "data": {
    "total_requests": 150,
    "success": 145,
    "failures": 5,
    "avg_duration": 234.5
  },
  "note": "This API shows data for the last 6 months only."
}
```

---

### 9. Cleanup Logs (Cron)

**Endpoint**: `GET /api/cron/cleanup`

**Description**: Deletes logs older than 6 months (for Vercel Cron jobs)

**Authentication**: Requires `CRON_SECRET` in production

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "https://scraping-hub-backend-only.vercel.app/api/cron/cleanup" -Headers @{Authorization="Bearer YOUR_CRON_SECRET"}
```

**Response**:
```json
{
  "message": "Cleanup complete"
}
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized: Missing or invalid Bearer token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden: Invalid token"
}
```

### 400 Bad Request
```json
{
  "error": {
    "message": "\"url\" is required",
    "status": 400
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "message": "Internal Server Error",
    "status": 500
  }
}
```

---

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Response when exceeded**: `429 Too Many Requests`

---

## Notes

- All endpoints return JSON responses
- Data storage is ephemeral on Vercel (resets on deployment)
- For persistent API keys, use the `MASTER_KEY` environment variable
- Scraping uses a 3-phase strategy: Static → Dynamic (Playwright) → Fallback (Search engines)
