import { jest } from '@jest/globals';

// Define mocks
jest.unstable_mockModule('../../src/services/resources.js', () => ({
    resourceManager: {
        init: jest.fn().mockResolvedValue(true),
        search: jest.fn().mockImplementation(async (q) => {
            if (q.includes('empty')) return [];
            return [{ url: 'http://test.com', title: 'Test Result', source: 'mock', snippet: 'A test result' }];
        }),
        searchRSS: jest.fn().mockResolvedValue([
            { url: 'http://rss.com', title: 'RSS Result', source: 'rss', snippet: 'RSS snippet' }
        ]),
        updateHealth: jest.fn(),
        generateQueryVariants: jest.fn().mockReturnValue([])
    }
}));

const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;

describe('Search V2 API', () => {
    let server;
    const API_KEY = '5de0f7120d6e8a9063aca929d362718982bd408c25dfb3f001ec2ba72633f0ec';

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
    });

    it('should return 200 with empty results message if search is empty', async () => {
        const res = await request(app)
            .get('/api/search?query=empty')
            .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBeDefined();
    });
});
