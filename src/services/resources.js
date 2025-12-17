import axios from 'axios';
import { UserAgent } from '../utils/userAgents.js';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import NodeCache from 'node-cache';
import { dynamicPhase } from './phases/dynamicPhase.js';

const rssParser = new Parser({
    headers: { 'User-Agent': UserAgent.getRandom() }
});

const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour health cache

// Helper for random choice
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- Resource Definitions (30+) ---

const RESOURCES = {
    // --- SearxNG Instances (Public, often allow bots) ---
    searx_tiekoetter: {
        type: 'search',
        url: 'https://searx.tiekoetter.com/search',
        params: (q) => ({ q, categories: 'general', language: 'en-US' }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_rhscz: {
        type: 'search',
        url: 'https://search.rhscz.eu/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_hbubli: {
        type: 'search',
        url: 'https://search.hbubli.cc/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_oloke: { // often good
        type: 'search',
        url: 'https://searx.oloke.xyz/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_bladerunn: {
        type: 'search',
        url: 'https://search.bladerunn.in/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_iminSpace: {
        type: 'search',
        url: 'https://search.im-in.space/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_blockblitz: {
        type: 'search',
        url: 'https://searxng.blockblitz.dev/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_2b9t: {
        type: 'search',
        url: 'https://search.2b9t.xyz/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_namejeff: {
        type: 'search',
        url: 'https://searx.namejeff.xyz/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },
    searx_prvcy: {
        type: 'search',
        url: 'https://searx.prvcy.eu/search',
        params: (q) => ({ q }),
        parser: ($) => $('.url_wrapper').map((i, el) => $(el).attr('href')).get()
    },

    // --- Indie / Alternative Search Engines ---
    gigablast: { 
        type: 'search',
        url: 'https://www.gigablast.com/search',
        params: (q) => ({ q }),
        parser: ($) => $('.result a[href^="http"]').map((i, el) => $(el).attr('href')).get()
    },
    millionshort: {
        type: 'search',
        url: 'https://millionshort.com/search',
        params: (keywords) => ({ keywords }),
        parser: ($) => $('.result-header a').map((i, el) => $(el).attr('href')).get()
    },
    wiby: { // Good for retro/blog content
        type: 'search',
        url: 'https://wiby.me/',
        params: (q) => ({ q }),
        parser: ($) => $('a[href^="http"]').map((i, el) => $(el).attr('href')).get()
    },
    marginalia: { // Good for blogs
        type: 'search',
        url: 'https://search.marginalia.nu/search',
        params: (query) => ({ query }),
        parser: ($) => $('.search-result h2 a').map((i, el) => $(el).attr('href')).get()
    },
    teclis: {
        type: 'search',
        url: 'https://www.teclis.com/en/search',
        params: (query) => ({ query }),
        parser: ($) => $('.result a').map((i, el) => $(el).attr('href')).get()
    },
    "4get": { // Another proxy wrapper usually
        type: 'search',
        url: 'https://4get.ca/web',
        params: (s) => ({ s }),
        parser: ($) => $('.title a').map((i, el) => $(el).attr('href')).get()
    },
    oscobo: {
        type: 'search',
        url: 'https://www.oscobo.com/search.php',
        params: (q) => ({ q }),
        parser: ($) => $('.result a').map((i, el) => $(el).attr('href')).get()
    },
    metager: {
        type: 'search',
        url: 'https://metager.org/meta/meta.ger',
        params: (q) => ({ q }),
        parser: ($) => $('.result a').map((i, el) => $(el).attr('href')).get()
    },
    qwant_lite: {
        type: 'search',
        url: 'https://lite.qwant.com/',
        params: (q) => ({ q }),
        parser: ($) => $('.result a').map((i, el) => $(el).attr('href')).get()
    },
    duckduckgo_lite: { // Often blocked but worth a try with headers
        type: 'search',
        url: 'https://lite.duckduckgo.com/lite/',
        method: 'POST',
        params: (q) => ({ q }),
        parser: ($) => $('.result-link').map((i, el) => $(el).attr('href')).get()
    },

    // --- RSS / Content Feeds (News & Tech) ---
    fox_news: { type: 'rss', url: 'https://moxie.foxnews.com/feedburner/latest.xml' },
    ap_news: { type: 'rss', url: 'https://apnews.com/rss' },
    bloomberg: { type: 'rss', url: 'https://www.bloomberg.com/feeds/business.rss' },
    techcrunch: { type: 'rss', url: 'https://techcrunch.com/feed/' },
    medium_tech: { type: 'rss', url: 'https://medium.com/feed/topic/technology' },
    stackoverflow: { type: 'rss', url: 'https://stackoverflow.com/feeds' },
    reddit_news: { type: 'rss', url: 'https://www.reddit.com/r/news/.rss' },
    arxiv_cs: { type: 'rss', url: 'https://arxiv.org/rss/cs' },
    pubmed: { type: 'rss', url: 'https://pubmed.ncbi.nlm.nih.gov/rss/search/?term=science' }, // Example term
    creativecommons: { // Search via simple scraping
        type: 'search',
        url: 'https://search.creativecommons.org/search',
        params: (q) => ({ q }),
        parser: ($) => $('.result a').map((i, el) => $(el).attr('href')).get()
    },
    gutenberg: { type: 'rss', url: 'https://www.gutenberg.org/browse/recent/rss' },
    osm_wiki: { type: 'rss', url: 'https://wiki.openstreetmap.org/wiki/Special:RecentChanges?feed=rss' },
    nasa: { type: 'rss', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
};

class ResourceManager {
    constructor() {
        this.status = new Map();
    }

    // Check if a resource is working (returns non-empty/200)
    async isHealthy(key) {
        const cached = cache.get(`health_${key}`);
        if (cached !== undefined) return cached;

        const resource = RESOURCES[key];
        const testQuery = 'test';
        
        try {
            if (resource.type === 'rss') {
                await rssParser.parseURL(resource.url);
            } else {
                const config = {
                    headers: { 'User-Agent': UserAgent.getRandom() },
                    params: resource.method === 'POST' ? {} : resource.params(testQuery),
                    timeout: 5000,
                    validateStatus: s => s === 200
                };
                if (resource.method === 'POST') {
                    // Send as form data
                    config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                    config.data = resource.params(testQuery);
                }
                await axios(resource.url, config);
            }
            cache.set(`health_${key}`, true);
            return true;
        } catch (e) {
            console.log(`Resource ${key} unhealthy: ${e.message.substring(0, 50)}...`);
            cache.set(`health_${key}`, false);
            return false;
        }
    }

    async getHealthyResources(type = 'search', count = 5) {
        const candidates = Object.keys(RESOURCES).filter(k => RESOURCES[k].type === type);
        // Shuffle candidates
        const shuffled = candidates.sort(() => 0.5 - Math.random());
        
        const healthy = [];
        for (const key of shuffled) {
            if (healthy.length >= count) break;
            // Optimistic approach: assume healthy unless proven otherwise to speed up request
            // Only strictly check if we previously marked it unhealthy
            if (cache.get(`health_${key}`) !== false) {
                healthy.push(key);
            }
        }
        return healthy;
    }

    async search(query, type = 'search') {
        const engines = await this.getHealthyResources(type, 5);
        
        for (const key of engines) {
            try {
                const resource = RESOURCES[key];
                console.log(`Searching via ${key}...`);

                const config = {
                    headers: { 
                        'User-Agent': UserAgent.getRandom(),
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    timeout: 8000
                };

                let response;
                if (resource.method === 'POST') {
                    const data = resource.params(query);
                    config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                    response = await axios.post(resource.url, new URLSearchParams(data).toString(), config);
                } else {
                    config.params = resource.params(query);
                    response = await axios.get(resource.url, config);
                }

                const $ = cheerio.load(response.data);
                const links = resource.parser($);

                // Filter valid links
                const validLinks = links.filter(l => l && l.startsWith('http') && !l.includes('google') && !l.includes('search'));

                if (validLinks.length > 0) {
                    console.log(`Found ${validLinks.length} results via ${key}`);
                    return validLinks.map(url => ({
                        url,
                        title: `Result from ${key}`, // Simplified, ideally parse titles too
                        source: key
                    }));
                }

            } catch (e) {
                // If 403/429, maybe try dynamic fallback? 
                // For now, just log and skip to next engine
                console.log(`Search ${key} failed: ${e.message}`);
                cache.set(`health_${key}`, false); // Mark unhealthy
            }
        }
        return [];
    }

    // Helper to search RSS feeds as fallback
    async searchRSS(query) {
        const feeds = Object.keys(RESOURCES).filter(k => RESOURCES[k].type === 'rss');
        const results = [];
        const limit = 5; 
        
        // Pick random 5 feeds
        const selected = feeds.sort(() => 0.5 - Math.random()).slice(0, limit);

        for (const key of selected) {
            try {
                const feed = await rssParser.parseURL(RESOURCES[key].url);
                const matches = feed.items.filter(item => 
                    (item.title && item.title.toLowerCase().includes(query.toLowerCase())) ||
                    (item.contentSnippet && item.contentSnippet.toLowerCase().includes(query.toLowerCase()))
                );
                results.push(...matches.map(m => ({
                    title: m.title,
                    url: m.link,
                    source: key,
                    date: m.pubDate
                })));
            } catch (e) {
                continue;
            }
        }
        return results;
    }
}

export const resourceManager = new ResourceManager();
export const RESOURCES_LIST = RESOURCES;
