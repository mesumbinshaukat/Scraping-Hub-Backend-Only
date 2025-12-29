import { jest } from '@jest/globals';

// Mock scraper service
jest.unstable_mockModule('../../src/services/scraper.js', () => ({
    scraperService: {
        scrape: jest.fn()
    }
}));

// We need to import app dynamically, but app.js imports routes, which imports controllers, which imports scraperService.
// So the mock above must be active before app is imported.
const { scraperService } = await import('../../src/services/scraper.js');
// Import supertest and app
const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;

describe('API Endpoints', () => {
    test('GET /api/health', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('status', 'ok');
    });

    test('GET /api/scrape with valid URL', async () => {
        const mockData = { title: 'Test', mainContent: 'Content here', phase: 'static' };
        scraperService.scrape.mockResolvedValue(mockData);

        const res = await request(app).get('/api/scrape?url=http://example.com');
        expect(res.statusCode).toEqual(200);
        // Scrape controller wraps data in data property of response body
        // and also includes message/url. But my controller implementation:
        // res.write('{"message": "Scraping in progress", "url": "' + url + '", "data": ');
        // res.write(JSON.stringify(data));
        // res.write('}');

        expect(res.body.data).toEqual(mockData);
        expect(res.body.url).toBe('http://example.com');
    });

    test('GET /api/scrape with missing URL', async () => {
        const res = await request(app).get('/api/scrape');
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error');
    });
});
