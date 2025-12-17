import express from 'express';
import { scrapeController } from '../controllers/scrapeController.js';

const router = express.Router();

import { rssController } from '../controllers/rssController.js';
import { sitemapController } from '../controllers/sitemapController.js';
import { validateController } from '../controllers/validateController.js';
import { searchController } from '../controllers/searchController.js';

import { statsController, logRequest, cleanupLogs } from '../controllers/statsController.js';
import { authenticate } from '../middleware/auth.js';

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

router.get('/stats/:period', statsController);

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default router;
