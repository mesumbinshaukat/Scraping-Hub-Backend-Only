import { jest } from '@jest/globals';

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

// Import modules dynamically
const { scraperService } = await import('../../src/services/scraper.js');
const { staticPhase } = await import('../../src/services/phases/staticPhase.js');
const { dynamicPhase } = await import('../../src/services/phases/dynamicPhase.js');
const { fallbackPhase } = await import('../../src/services/phases/fallbackPhase.js');

describe('Scraper Service Orchestrator', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return Phase 1 result if successful', async () => {
        const mockResult = { title: 'Test', method: 'static_phase' };
        staticPhase.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result).toMatchObject(mockResult);
        expect(staticPhase).toHaveBeenCalled();
        expect(dynamicPhase).not.toHaveBeenCalled();
    });

    test('should fallback to Phase 2 if Phase 1 fails', async () => {
        staticPhase.mockRejectedValue(new Error('Phase 1 failed'));
        const mockResult = { title: 'Test Dynamic', method: 'dynamic_manual_stealth' };
        dynamicPhase.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result).toMatchObject(mockResult);
        expect(staticPhase).toHaveBeenCalled();
        expect(dynamicPhase).toHaveBeenCalled();
    });

    test('should fallback to Phase 3 if Phase 1 and 2 fail', async () => {
        staticPhase.mockRejectedValue(new Error('Phase 1 failed'));
        dynamicPhase.mockRejectedValue(new Error('Phase 2 failed'));
        const mockResult = { title: 'Test Fallback', method: 'fallback_search' };
        fallbackPhase.mockResolvedValue(mockResult);

        const result = await scraperService.scrape('http://example.com');
        expect(result).toMatchObject(mockResult);
        expect(fallbackPhase).toHaveBeenCalled();
    });

    test('should throw error if all phases fail', async () => {
        staticPhase.mockRejectedValue(new Error('Phase 1 failed'));
        dynamicPhase.mockRejectedValue(new Error('Phase 2 failed'));
        fallbackPhase.mockRejectedValue(new Error('Phase 3 failed'));

        await expect(scraperService.scrape('http://example.com')).rejects.toThrow('All scraping phases failed');
    });
});
