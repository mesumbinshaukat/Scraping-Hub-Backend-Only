import express from 'express';
import { scrapeController } from '../controllers/scrapeController.js';

const router = express.Router();

import { rssController } from '../controllers/rssController.js';
import { sitemapController } from '../controllers/sitemapController.js';
import { validateController } from '../controllers/validateController.js';
import { searchController } from '../controllers/searchController.js';

import { statsController, logRequest, cleanupLogs } from '../controllers/statsController.js';
import { authenticate } from '../middleware/auth.js';
import { resourceManager } from '../services/resources.js';

// Apply logging middleware
router.use(logRequest);

// Apply Authentication to all API routes below
router.use(authenticate);

router.get('/cron/cleanup', cleanupLogs);

router.get('/scrape', scrapeController);
router.get('/rss', rssController);
router.get('/sitemap', sitemapController);
router.get('/validate', validateController);
router.get('/news', searchController('news'));
router.get('/blog', searchController('blog'));
router.get('/search', searchController('all')); // Expose generic search explicitly

router.get('/stats/:period', statsController);

router.get('/health', async (req, res) => {
    // Basic health check
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage().rss / 1024 / 1024
    });
});

router.get('/resources', async (req, res) => {
    const searchEngines = await resourceManager.getHealthyResources('search', 100);
    const rssFeeds = await resourceManager.getHealthyResources('rss', 100);
    res.json({
        total_healthy: searchEngines.length + rssFeeds.length,
        search_engines: searchEngines,
        rss_feeds: rssFeeds
    });
});

export default router;
