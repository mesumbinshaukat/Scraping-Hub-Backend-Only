import axios from 'axios';
import { UserAgent } from '../utils/userAgents.js';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import NodeCache from 'node-cache';
import promiseRetry from 'promise-retry';
import robotsParser from 'robots-parser';
import { proxyManager } from '../utils/proxyManager.js';
import cloudscraper from 'cloudscraper';
import nlp from 'compromise';
import { getCollection, saveCollection } from '../utils/db.js';
import { logger } from '../utils/logger.js';

const rssParser = new Parser({
    headers: { 'User-Agent': UserAgent.getRandom() }
});

const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour health cache
const robotsCache = new NodeCache({ stdTTL: 86400 }); // 24 hours robots.txt cache

// Helper to standardise results
const standardise = (url, title, snippet, source) => ({
    url,
    title: title || 'No Title',
    snippet: snippet || 'No Snippet Available',
    source
});

// --- Resource Definitions ---
const RESOURCES = {
    searx_tiekoetter: { type: 'search', url: 'https://searx.tiekoetter.com/search', params: (q) => ({ q, categories: 'general', language: 'en-US' }), parser: ($) => $('.result').map((i, el) => standardise($(el).find('h3 a').attr('href'), $(el).find('h3 a').text(), $(el).find('.content').text(), 'searx_tiekoetter')).get() },
    searx_be: { type: 'search', url: 'https://searx.be/search', params: (q) => ({ q, categories: 'general', language: 'en-US' }), parser: ($) => $('.result').map((i, el) => standardise($(el).find('h3 a').attr('href'), $(el).find('h3 a').text(), $(el).find('.content').text(), 'searx_be')).get() },
    searx_space: { type: 'search', url: 'https://searx.space/search', params: (q) => ({ q }), parser: ($) => $('.result').map((i, el) => standardise($(el).find('h3 a').attr('href'), $(el).find('h3 a').text(), $(el).find('.content').text(), 'searx_space')).get() },
    searx_bare: { type: 'search', url: 'https://baresearch.org/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_bare')).get() },
    searx_party: { type: 'search', url: 'https://searx.party/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_party')).get() },
    qwant_lite: { type: 'search', url: 'https://lite.qwant.com/', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('a').text(), null, 'qwant_lite')).get() },
    wiby: { type: 'search', url: 'https://wiby.me/', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('a').text(), null, 'wiby')).get() },
    duckduckgo_lite: { type: 'search', url: 'https://lite.duckduckgo.com/lite/', method: 'POST', params: q => ({ q }), parser: $ => $('.result-link').map((i, el) => standardise($(el).attr('href'), $(el).text(), null, 'duckduckgo_lite')).get() },

    // RSS
    ign: { type: 'rss', url: 'https://ign.com/rss/v2/articles/feed' },
    ap_news: { type: 'rss', url: 'https://apnews.com/hub/ap-top-news/rss' },
    techcrunch: { type: 'rss', url: 'https://techcrunch.com/feed/' },
    hackernews: { type: 'rss', url: 'https://hnrss.org/newest' }
};

class ResourceManager {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        logger.info('Initializing resources...');
        this.initialized = true;
    }

    async search(query, type = 'search') {
        if (type === 'rss') {
            return this.searchRSS(query);
        }

        let allResults = [];
        const seenUrls = new Set();
        const engines = Object.keys(RESOURCES).filter(k => RESOURCES[k].type === type);

        // Parallel fetch for first batch
        const healthyEngines = engines
            .sort((a, b) => (cache.get(`health_${b}`) || 0) - (cache.get(`health_${a}`) || 0))
            .slice(0, 4);

        const enginePromises = healthyEngines.map(key => this.fetchFromResource(key, query));
        const settled = await Promise.allSettled(enginePromises);

        settled.forEach((res, idx) => {
            const key = healthyEngines[idx];
            if (res.status === 'fulfilled') {
                this.updateHealth(key, true);
                res.value.forEach(item => {
                    if (item.url && !seenUrls.has(item.url)) {
                        seenUrls.add(item.url);
                        allResults.push(item);
                    }
                });
            } else {
                this.updateHealth(key, false);
            }
        });

        // NLP Expansion if results are low
        if (allResults.length < 5) {
            const variants = this.generateQueryVariants(query);
            logger.info({ message: 'Low results, attempting NLP expansion', original: query, variants });

            const variantPromises = variants.flatMap(v =>
                healthyEngines.slice(0, 2).map(key => this.fetchFromResource(key, v))
            );

            const variantSettled = await Promise.allSettled(variantPromises);
            variantSettled.forEach(res => {
                if (res.status === 'fulfilled') {
                    res.value.forEach(item => {
                        if (item.url && !seenUrls.has(item.url)) {
                            seenUrls.add(item.url);
                            allResults.push(item);
                        }
                    });
                }
            });
        }

        return allResults.slice(0, 50);
    }

    generateQueryVariants(query) {
        const doc = nlp(query);
        const variants = [];

        // 1. Synonyms/Related (Simplified with compromise)
        const nouns = doc.nouns().out('array');
        if (nouns.length > 0) {
            // Add plural/singular variants
            variants.push(doc.clone().nouns().toPlural().text());
            variants.push(doc.clone().nouns().toSingular().text());
        }

        const verbs = doc.verbs().out('array');
        if (verbs.length > 0) {
            variants.push(doc.clone().verbs().toPastTense().text());
        }

        return [...new Set(variants)].filter(v => v && v !== query).slice(0, 3);
    }

    async updateHealth(key, success) {
        const healthData = await getCollection('resource_health');
        const current = healthData.find(h => h.key === key) || { key, score: 50 };

        current.score = success ? Math.min(current.score + 5, 100) : Math.max(current.score - 10, 0);
        current.last_updated = new Date().toISOString();

        const index = healthData.findIndex(h => h.key === key);
        if (index > -1) healthData[index] = current;
        else healthData.push(current);

        await saveCollection('resource_health', healthData);
        cache.set(`health_${key}`, current.score); // Still cache for speed
    }

    async fetchFromResource(key, query) {
        const resource = RESOURCES[key];
        return promiseRetry(async (retry, number) => {
            try {
                const headers = { 'User-Agent': UserAgent.getRandom() };
                const proxy = process.env.PROXY_ENABLED === 'true' ? await proxyManager.getNextProxy() : null;

                let body;
                if (resource.method === 'POST') {
                    body = await cloudscraper({
                        method: 'POST',
                        url: resource.url,
                        formData: resource.params(query),
                        headers,
                        proxy
                    });
                } else {
                    body = await cloudscraper({
                        method: 'GET',
                        url: resource.url,
                        qs: resource.params(query),
                        headers,
                        proxy
                    });
                }

                const $ = cheerio.load(body);
                return resource.parser($);
            } catch (e) {
                if (number < 2 && (e.statusCode === 403 || e.statusCode === 429)) {
                    return retry(e);
                }
                return [];
            }
        }, { retries: 1 });
    }

    async searchRSS(query) {
        const feeds = Object.keys(RESOURCES).filter(k => RESOURCES[k].type === 'rss');
        const results = [];
        for (const key of feeds) {
            try {
                const feed = await rssParser.parseURL(RESOURCES[key].url);
                feed.items.forEach(item => {
                    if (item.title?.toLowerCase().includes(query.toLowerCase()) ||
                        item.contentSnippet?.toLowerCase().includes(query.toLowerCase())) {
                        results.push(standardise(item.link, item.title, item.contentSnippet, key));
                    }
                });
            } catch (e) { /* ignore */ }
        }
        return results;
    }
}

export const resourceManager = new ResourceManager();
export const RESOURCES_LIST = RESOURCES;
