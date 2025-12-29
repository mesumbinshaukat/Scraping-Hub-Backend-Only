
import axios from 'axios';
import assert from 'assert';

const TEST_PORT = 3000;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Mock express server to simulate the controller usage without starting the full app
import express from 'express';
import { rssController } from '../src/controllers/rssController.js';

const app = express();
app.get('/rss', rssController);
// Mock logger to avoid cluttering output or failing if logger not set up in test env fully
// But in this case we imported the real controller which imports the real logger, so we let it exist.

const server = app.listen(TEST_PORT, async () => {
    console.log(`Test server running on port ${TEST_PORT}`);

    try {
        // Test 1: Valid IGN RSS Feed
        console.log('Test 1: Fetching valid IGN RSS feed...');
        const ignUrl = 'https://ign.com/rss/v2/articles/feed'; // Correct URL
        const res1 = await axios.get(`${BASE_URL}/rss?url=${encodeURIComponent(ignUrl)}`);

        assert.strictEqual(res1.status, 200);
        assert.ok(res1.data.title, 'Response should have a title');
        assert.ok(Array.isArray(res1.data.items), 'Response should have items array');
        console.log('✅ Test 1 Passed: Valid RSS fetched successfully.');

        // Test 2: Invalid URL (404 expected from upstream)
        console.log('\nTest 2: Fetching invalid URL (expecting 404/502 handled error)...');
        const badUrl = 'https://ign.com/rss/articles'; // The original bad URL
        try {
            await axios.get(`${BASE_URL}/rss?url=${encodeURIComponent(badUrl)}`);
            throw new Error('Should have failed with status code');
        } catch (err) {
            if (err.response) {
                console.log(`Got expected error status: ${err.response.status}`);
                assert.ok([404, 502].includes(err.response.status), 'Status should be 404 or 502');
                assert.ok(err.response.data.error, 'Should return JSON with error message');
                console.log('✅ Test 2 Passed: Error handled gracefully.');
            } else {
                throw err;
            }
        }

    } catch (testError) {
        console.error('❌ Verification Failed:', testError.message);
        process.exit(1);
    } finally {
        server.close();
    }
});
