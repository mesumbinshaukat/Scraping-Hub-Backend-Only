import { jest } from '@jest/globals';
import axios from 'axios';

// Define mocks before imports
jest.unstable_mockModule('../../src/services/phases/staticPhase.js', () => ({
    staticPhase: jest.fn()
}));
jest.unstable_mockModule('../../src/services/phases/dynamicPhase.js', () => ({
    dynamicPhase: jest.fn()
}));
jest.unstable_mockModule('../../src/services/phases/fallbackPhase.js', () => ({
    fallbackPhase: jest.fn()
}));
jest.unstable_mockModule('axios', () => ({
    default: {
        head: jest.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' } })
    },
    head: jest.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' } })
}));

// Import modules dynamically
const { scraperService } = await import('../../src/services/scraper.js');
const { staticPhase } = await import('../../src/services/phases/staticPhase.js');
const { dynamicPhase } = await import('../../src/services/phases/dynamicPhase.js');
const { fallbackPhase } = await import('../../src/services/phases/fallbackPhase.js');

describe('Scraper Service Orchestrator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should return Phase 1 result if successful and enough content', async () => {
        const mockResult = { title: 'Test', mainContent: 'A'.repeat(200), method: 'static_cloudscraper' };
        staticPhase.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result.phase).toBe('static');
        expect(staticPhase).toHaveBeenCalled();
        expect(dynamicPhase).not.toHaveBeenCalled();
    });

    test('should fallback to Phase 2 (Dynamic) if Phase 1 has low content', async () => {
        staticPhase.mockResolvedValue({ title: 'Short', mainContent: 'too short', method: 'static' });
        const mockResult = { title: 'Test Dynamic', mainContent: 'A'.repeat(200), method: 'dynamic_jsdom' };
        dynamicPhase.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result.phase).toBe('dynamic_js');
        expect(staticPhase).toHaveBeenCalled();
        expect(dynamicPhase).toHaveBeenCalled();
    });

    test('should fallback to Phase 3 if Phase 1 and 2 fail', async () => {
        staticPhase.mockRejectedValue(new Error('Phase 1 failed'));
        dynamicPhase.mockRejectedValue(new Error('Phase 2 failed'));
        const mockResult = { title: 'Test Fallback', method: 'fallback_search' };
        fallbackPhase.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result.phase).toBe('search_fallback');
        expect(fallbackPhase).toHaveBeenCalled();
    });

    test('should throw error if all phases fail', async () => {
        staticPhase.mockRejectedValue(new Error('Phase 1 failed'));
        dynamicPhase.mockRejectedValue(new Error('Phase 2 failed'));
        fallbackPhase.mockRejectedValue(new Error('Phase 3 failed'));

        await expect(scraperService.scrape('http://example.com')).rejects.toThrow('All scraping phases failed');
    });
});
