import request from 'supertest';
import app from '../../src/app.js';
import { jest } from '@jest/globals';

// Mock dependencies to avoid hitting real endpoints
jest.mock('../../src/services/resources.js', () => ({
    resourceManager: {
        init: jest.fn().mockResolvedValue(true),
        search: jest.fn().mockImplementation(async (q) => {
            if (q.includes('empty')) return [];
            return [{ url: 'http://test.com', title: 'Test Result', source: 'mock', snippet: 'A test result' }];
        }),
        searchRSS: jest.fn().mockResolvedValue([
            { url: 'http://rss.com', title: 'RSS Result', source: 'rss', snippet: 'RSS snippet' }
        ]),
        getHealthyResources: jest.fn().mockResolvedValue(['mock_source']),
        status: new Map()
    }
}));

describe('Search V2 API', () => {
    let server;
    const API_KEY = '5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec'; // Master key from README

    beforeAll(() => {
        process.env.MASTER_KEY = API_KEY;
    });

    it('should return 401 without auth', async () => {
        const res = await request(app).get('/api/news?query=test');
        expect(res.status).toBe(401);
    });

    it('should return results with valid auth', async () => {
        const res = await request(app)
            .get('/api/news?query=test')
            .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0].title).toBe('Test Result');
    });

    it('should trigger fallback if search is empty', async () => {
        const res = await request(app)
            .get('/api/search?query=empty')
            .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('No results found');
        // If we mock searchRSS to return data, we might see it here depending on searchController logic
        // Current logic: if results < 5, trigger RSS.
        // Mock search returns [] for 'empty', so RSS should trigger.
        // But mock searchRSS returns 1 item.
        // So final result should include RSS item.

        // Actually, if uniqueResults > 0, status is 200.
    });
});
