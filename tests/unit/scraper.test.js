import { jest } from '@jest/globals';

// Define mocks before imports
jest.unstable_mockModule('../../src/services/phases/staticPhase.js', () => ({
    staticScrape: jest.fn()
}));
jest.unstable_mockModule('../../src/services/phases/dynamicPhase.js', () => ({
    dynamicScrape: jest.fn()
}));
jest.unstable_mockModule('../../src/services/phases/fallbackPhase.js', () => ({
    fallbackScrape: jest.fn()
}));

// Import modules dynamically
const { scraperService } = await import('../../src/services/scraper.js');
const { staticScrape } = await import('../../src/services/phases/staticPhase.js');
const { dynamicScrape } = await import('../../src/services/phases/dynamicPhase.js');
const { fallbackScrape } = await import('../../src/services/phases/fallbackPhase.js');

describe('Scraper Service Orchestrator', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return Phase 1 result if successful', async () => {
        const mockResult = { title: 'Test', method: 'static_phase_1' };
        staticScrape.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result).toEqual(mockResult);
        expect(staticScrape).toHaveBeenCalled();
        expect(dynamicScrape).not.toHaveBeenCalled();
    });

    test('should fallback to Phase 2 if Phase 1 fails', async () => {
        staticScrape.mockRejectedValue(new Error('Phase 1 failed'));
        const mockResult = { title: 'Test Dynamic', method: 'dynamic_phase_2' };
        dynamicScrape.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result).toEqual(mockResult);
        expect(staticScrape).toHaveBeenCalled();
        expect(dynamicScrape).toHaveBeenCalled();
    });

    test('should fallback to Phase 3 if Phase 1 and 2 fail', async () => {
        staticScrape.mockRejectedValue(new Error('Phase 1 failed'));
        dynamicScrape.mockRejectedValue(new Error('Phase 2 failed'));
        const mockResult = { title: 'Test Fallback', method: 'fallback_phase_3_search' };
        fallbackScrape.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result).toEqual(mockResult);
        expect(fallbackScrape).toHaveBeenCalled();
    });

    test('should throw error if all phases fail', async () => {
        staticScrape.mockRejectedValue(new Error('Phase 1 failed'));
        dynamicScrape.mockRejectedValue(new Error('Phase 2 failed'));
        fallbackScrape.mockRejectedValue(new Error('Phase 3 failed'));

        await expect(scraperService.scrape('http://example.com')).rejects.toThrow('All scraping phases failed');
    });
});
