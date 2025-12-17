# API Documentation

**Base URL**: `https://<your-vercel-app>.vercel.app/api`

All endpoints require a Bearer token in the `Authorization` header.

```http
Authorization: Bearer YOUR_API_KEY
```

---

## 1. Advanced Search

Flexible search across multiple engines (SearxNG, Indie, RSS) with automatic fallback and type filtering.

**Endpoints**:
- `GET /api/search` (Generic search)
- `GET /api/news` (Optimize for news sources)
- `GET /api/blog` (Optimize for blogs/wikis)

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search term (e.g., "AI news"). |
| `limit` | number | No | Max results to return (default: 50). |

**Response Example** (`GET /api/news?query=tech`):
```json
{
  "success": true,
  "meta": {
    "query": "tech",
    "type": "news",
    "count": 10,
    "timestamp": "2025-12-17T14:30:00.000Z"
  },
  "data": [
    {
      "url": "https://techcrunch.com/2025/example",
      "title": "Latest Tech News",
      "snippet": "A brief snippet of the article content...",
      "source": "techcrunch"
    },
    {
      "url": "https://www.wired.com/story/example",
      "title": "Wired Article",
      "snippet": "Another snippet...",
      "source": "searx_tiekoetter"
    }
  ],
  "message": "Found 10 results."
}
```

---

## 2. Scrape Website

Scrapes a specific URL using a multi-phase strategy:
1.  **Static**: Fast HTTP request.
2.  **Proxy**: Retries with proxy if enabled.
3.  **Dynamic**: Uses Playwright (Stealth) for JS-heavy sites.
4.  **Fallback**: Searches for the content if direct access fails.

**Endpoint**: `GET /api/scrape`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | The full URL to scrape. |

**Response Example**:
```json
{
  "success": true,
  "data": {
    "title": "Example Domain",
    "description": "This domain is for use in illustrative examples...",
    "image": "https://example.com/og-image.jpg",
    "mainContent": "Full body text of the article...",
    "links": ["https://more-info.com"],
    "method": "static_phase" // or "dynamic_phase_stealth", "fallback_phase_3_search"
  }
}
```

---

## 3. RSS Parser

Parses an RSS or Atom feed and normalizes the output.

**Endpoint**: `GET /api/rss`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | The RSS feed URL. |

**Response Example**:
```json
{
  "success": true,
  "data": {
    "title": "TechCrunch",
    "description": "TechCrunch is a leading technology media property...",
    "items": [
      {
        "title": "Startup raises $10M",
        "link": "https://techcrunch.com/startup-raise",
        "pubDate": "Wed, 17 Dec 2025 10:00:00 GMT",
        "contentSnippet": "Short summary of the news..."
      }
    ]
  }
}
```

---

## 4. Sitemap Parser

Extracts all URLs from an XML sitemap.

**Endpoint**: `GET /api/sitemap`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | The Sitemap XML URL. |

**Response Example**:
```json
{
  "success": true,
  "data": {
    "urls": [
      "https://example.com/page-1",
      "https://example.com/page-2"
    ],
    "count": 2
  }
}
```

---

## 5. URL Validator

Checks if a URL is reachable and returns its status code.

**Endpoint**: `GET /api/validate`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | The URL to check. |

**Response Example**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "status": 200,
    "content_type": "text/html; charset=UTF-8"
  }
}
```

---

## 6. Resource Management

Lists all Search Engines and RSS feeds currently available and marked as "Healthy".

**Endpoint**: `GET /api/resources`

**Response Example**:
```json
{
  "total_healthy": 45,
  "search_engines": [
    "searx_tiekoetter",
    "searx_be",
    "qwant_lite",
    "wiby"
  ],
  "rss_feeds": [
    "ap_news",
    "techcrunch",
    "hackernews"
  ]
}
```

---

## 7. System Health & Stats

### Health Check
**Endpoint**: `GET /api/health`

**Response Example**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-17T19:00:00.000Z",
  "memory": 45.2 // MB used
}
```

### Usage Statistics
**Endpoint**: `GET /api/stats/:period`
- `:period` can be `daily`, `weekly`, or `monthly`.

**Response Example**:
```json
{
  "period": "daily",
  "data": {
    "total_requests": 1500,
    "success": 1450,
    "failures": 50,
    "avg_duration": 450.5 // ms
  },
  "note": "This API shows data for the last 6 months only."
}
```

---

## 8. Cron Maintenance

**Endpoint**: `GET /api/cron/cleanup`
**Auth**: Requires `Authorization: Bearer <CRON_SECRET>`

**Description**: Deletes logs older than 6 months. Designed to be called by Vercel Cron.

**Response Example**:
```json
{
  "message": "Cleanup complete"
}
```

---

## Error Responses

**400 Bad Request**
```json
{ "error": "Query parameter 'url' is required" }
```

**401 Unauthorized**
```json
{ "error": "Missing Authorization header" }
```

**429 Too Many Requests**
```json
{ "error": "Too many requests, please try again later." }
```

**500 Internal Server Error**
```json
{
  "error": {
    "message": "Scraping failed after 3 attempts.",
    "status": 500
  }
}
```
