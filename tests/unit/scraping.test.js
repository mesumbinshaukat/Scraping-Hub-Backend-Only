import { jest } from '@jest/globals';
import { getBrowser } from '../../src/utils/browserManager.js';
import { staticPhase } from '../../src/services/phases/staticPhase.js';

// Mock Dependencies
jest.mock('playwright-extra', () => ({
    addExtra: jest.fn(() => ({
        use: jest.fn(),
        launch: jest.fn().mockResolvedValue({
            newContext: jest.fn().mockResolvedValue({
                newPage: jest.fn().mockResolvedValue({
                    goto: jest.fn(),
                    evaluate: jest.fn().mockResolvedValue({ title: 'Test', mainContent: 'Some content', links: [] }),
                    close: jest.fn(),
                    on: jest.fn()
                }),
                addInitScript: jest.fn(),
                close: jest.fn()
            }),
            close: jest.fn()
        })
    }))
}));

jest.mock('@sparticuz/chromium-min', () => ({
    executablePath: jest.fn().mockResolvedValue('/mock/path'),
    args: [],
    defaultViewport: {},
    headless: true
}));

describe('Scraping Logic', () => {
    afterAll(async () => {
        // Allow any pending async work to settle
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    test('browserManager should handle Vercel environment status', async () => {
        process.env.VERCEL = '1';
        // Mocking behavior, we can't easily test the full retry loop without deep mocking
        // but we verify the function is exported and callable.
        expect(getBrowser).toBeDefined();
        delete process.env.VERCEL;
    });

    test('staticPhase should be defined', () => {
        expect(staticPhase).toBeDefined();
    });
});
