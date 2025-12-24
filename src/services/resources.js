import axios from 'axios';
import { UserAgent } from '../utils/userAgents.js';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import NodeCache from 'node-cache';
import promiseRetry from 'promise-retry';
import robotsParser from 'robots-parser';
import { proxyManager } from '../utils/proxyManager.js';
import { getBrowser } from '../utils/browserManager.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cloudscraper = require('cloudscraper');

const rssParser = new Parser({
    headers: { 'User-Agent': UserAgent.getRandom() }
});

const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour health cache
const robotsCache = new NodeCache({ stdTTL: 86400 }); // 24 hours robots.txt cache

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to standardise results
const standardise = (url, title, snippet, source) => ({
    url,
    title: title || 'No Title',
    snippet: snippet || 'No Snippet Available',
    source
});

// --- Resource Definitions (Expanded to 50+) ---
const RESOURCES = {
    // === SearxNG Instances (Public, High Uptime 2025) ===
    searx_tiekoetter: {
        type: 'search',
        url: 'https://searx.tiekoetter.com/search',
        params: (q) => ({ q, categories: 'general', language: 'en-US' }),
        parser: ($) => $('.result').map((i, el) => standardise($(el).find('h3 a').attr('href'), $(el).find('h3 a').text(), $(el).find('.content').text(), 'searx_tiekoetter')).get()
    },
    searx_be: {
        type: 'search',
        url: 'https://searx.be/search',
        params: (q) => ({ q, categories: 'general', language: 'en-US' }),
        parser: ($) => $('.result').map((i, el) => standardise($(el).find('h3 a').attr('href'), $(el).find('h3 a').text(), $(el).find('.content').text(), 'searx_be')).get()
    },
    searx_space: {
        type: 'search',
        url: 'https://searx.space/search',
        params: (q) => ({ q }),
        parser: ($) => $('.result').map((i, el) => standardise($(el).find('h3 a').attr('href'), $(el).find('h3 a').text(), $(el).find('.content').text(), 'searx_space')).get()
    },
    // Adding more diverse Searx instances
    searx_inetol: { type: 'search', url: 'https://search.inetol.net/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_inetol')).get() },
    searx_freestater: { type: 'search', url: 'https://search.freestater.org/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_freestater')).get() },
    searx_opnxng: { type: 'search', url: 'https://opnxng.com/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_opnxng')).get() },
    searx_priv: { type: 'search', url: 'https://priv.au/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_priv')).get() },
    searx_kantan: { type: 'search', url: 'https://kantan.cat/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_kantan')).get() },
    searx_gruble: { type: 'search', url: 'https://www.gruble.de/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_gruble')).get() },
    searx_sev: { type: 'search', url: 'https://searx.sev.monster/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_sev')).get() },
    searx_ro: { type: 'search', url: 'https://searx.ro/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_ro')).get() },
    searx_canine: { type: 'search', url: 'https://searxng.canine.tools/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_canine')).get() },
    searx_bare: { type: 'search', url: 'https://baresearch.org/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_bare')).get() },
    searx_party: { type: 'search', url: 'https://searx.party/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_party')).get() },
    searx_o5: { type: 'search', url: 'https://o5.gg/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_o5')).get() },
    searx_anoni: { type: 'search', url: 'https://search.anoni.net/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_anoni')).get() },
    searx_atl: { type: 'search', url: 'https://search.atl.tools/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_atl')).get() },
    searx_charlie: { type: 'search', url: 'https://search.charliewhiskey.net/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_charlie')).get() },
    searx_ipv6s: { type: 'search', url: 'https://search.ipv6s.net/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_ipv6s')).get() },
    searx_leptons: { type: 'search', url: 'https://search.leptons.xyz/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_leptons')).get() },
    searx_url4irl: { type: 'search', url: 'https://search.url4irl.com/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_url4irl')).get() },
    searx_dresden: { type: 'search', url: 'https://searx.dresden.network/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_dresden')).get() },
    searx_ox2: { type: 'search', url: 'https://searx.ox2.fr/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_ox2')).get() },
    searx_seek: { type: 'search', url: 'https://seek.fyi/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_seek')).get() },
    searx_indst: { type: 'search', url: 'https://search.indst.eu/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_indst')).get() },
    searx_darkness: { type: 'search', url: 'https://search.darkness.services/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_darkness')).get() },
    searx_unredacted: { type: 'search', url: 'https://search.unredacted.org/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_unredacted')).get() },
    searx_mbuf: { type: 'search', url: 'https://searx.mbuf.net/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_mbuf')).get() },
    searx_oh64: { type: 'search', url: 'https://search.oh64.moe/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_oh64')).get() },
    searx_catgirl: { type: 'search', url: 'https://sx.catgirl.cloud/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_catgirl')).get() },
    searx_lunar: { type: 'search', url: 'https://searx.lunar.icu/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_lunar')).get() },
    searx_amuse: { type: 'search', url: 'https://search.amuse.social/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_amuse')).get() },
    searx_work: { type: 'search', url: 'https://searx.work/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_work')).get() },
    searx_disroot: { type: 'search', url: 'https://search.disroot.org/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_disroot')).get() },
    searx_privacy: { type: 'search', url: 'https://searx.privacy.ovh/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_privacy')).get() },
    searx_tinfoil: { type: 'search', url: 'https://searx.tinfoil-hat.net/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_tinfoil')).get() },
    searx_mx: { type: 'search', url: 'https://searx.mx/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_mx')).get() },
    searx_es: { type: 'search', url: 'https://searx.es/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_es')).get() },
    searx_be_alt: { type: 'search', url: 'https://searxng.be/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_be_alt')).get() },
    searx_it: { type: 'search', url: 'https://searx.it/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_it')).get() },
    searx_mpx: { type: 'search', url: 'https://searx.mpx.wtf/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_mpx')).get() },
    searx_name: { type: 'search', url: 'https://search.name.sh/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_name')).get() },
    searx_xyz: { type: 'search', url: 'https://search.xyz.pt/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_xyz')).get() },
    searx_f: { type: 'search', url: 'https://searx.frt.sh/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_f')).get() },
    searx_ninja: { type: 'search', url: 'https://search.ninja/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_ninja')).get() },
    searx_rocks: { type: 'search', url: 'https://searx.rocks/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_rocks')).get() },
    searx_si: { type: 'search', url: 'https://searx.si/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_si')).get() },
    searx_work_2: { type: 'search', url: 'https://searx.work/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_work_2')).get() },
    searx_p: { type: 'search', url: 'https://searx.p.project-insanity.org/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_p')).get() },
    searx_d: { type: 'search', url: 'https://searx.dcre.one/search', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('h3').text(), $(el).find('.content').text(), 'searx_d')).get() },

    // === Indie / Alternative ===
    qwant_lite: { type: 'search', url: 'https://lite.qwant.com/', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('a').text(), null, 'qwant_lite')).get() },
    yacy_lab: { type: 'search', url: 'https://yacy.searchlab.eu/search', params: query => ({ query }), parser: $ => $('.yacysearch .result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('a').text(), null, 'yacy_lab')).get() },
    wiby: { type: 'search', url: 'https://wiby.me/', params: q => ({ q }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('a').text(), null, 'wiby')).get() },
    marginalia: { type: 'search', url: 'https://search.marginalia.nu/search', params: query => ({ query, profile: 'blog' }), parser: $ => $('.result').map((i, el) => standardise($(el).find('a').attr('href'), $(el).find('a').text(), null, 'marginalia')).get() },
    duckduckgo_lite: { type: 'search', url: 'https://lite.duckduckgo.com/lite/', method: 'POST', params: q => ({ q }), parser: $ => $('.result-link').map((i, el) => standardise($(el).attr('href'), $(el).text(), null, 'duckduckgo_lite')).get() },

    // === RSS Feeds ===
    ap_news: { type: 'rss', url: 'https://apnews.com/hub/ap-top-news/rss' },
    bloomberg: { type: 'rss', url: 'https://feeds.bloomberg.com/technology/news.rss' },
    techcrunch: { type: 'rss', url: 'https://techcrunch.com/feed/' },
    arxiv_cs: { type: 'rss', url: 'https://arxiv.org/rss/cs' },
    pubmed: { type: 'rss', url: 'https://pubmed.ncbi.nlm.nih.gov/rss/search/?term=science' },
    hackernews: { type: 'rss', url: 'https://hnrss.org/newest' },
    verge: { type: 'rss', url: 'https://www.theverge.com/rss/index.xml' },
    wired: { type: 'rss', url: 'https://www.wired.com/feed/rss' },
    engadget: { type: 'rss', url: 'https://www.engadget.com/rss.xml' },
    gizmodo: { type: 'rss', url: 'https://gizmodo.com/rss' },
    reuters_tech: { type: 'rss', url: 'https://www.reutersagency.com/feed/?best-topics=technology&post_type=best' },
    bbc_tech: { type: 'rss', url: 'http://feeds.bbci.co.uk/news/technology/rss.xml' }
};

class ResourceManager {
    constructor() {
        this.status = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        console.log('Initializing resources and health checks...');
        // Proactive random check of 5 resources to warm up cache
        const keys = Object.keys(RESOURCES);
        const sample = keys.sort(() => 0.5 - Math.random()).slice(0, 5);
        sample.forEach(k => this.isHealthy(k));
        this.initialized = true;
    }

    async checkRobots(url) {
        try {
            const domain = new URL(url).origin;
            const robotsUrl = `${domain}/robots.txt`;

            let robot = robotsCache.get(robotsUrl);
            if (!robot) {
                const resp = await axios.get(robotsUrl, { timeout: 3000, validateStatus: () => true });
                if (resp.status === 200) {
                    robot = robotsParser(robotsUrl, resp.data);
                    robotsCache.set(robotsUrl, robot);
                }
            }
            if (robot && !robot.isAllowed(url, 'Googlebot')) { // Being polite as Googlebot often works
                // If strictly blocking generic bots, respecting that
                return false;
            }
            return true;
        } catch (e) {
            return true; // Fail open if robots.txt unreachable
        }
    }

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
                    timeout: 5000
                };
                if (resource.method === 'POST') config.data = resource.params(testQuery);
                await axios(resource.url, config);
            }
            cache.set(`health_${key}`, true);
            return true;
        } catch (e) {
            cache.set(`health_${key}`, false);
            return false;
        }
    }

    async getHealthyResources(type = 'search', count = 10) {
        const candidates = Object.keys(RESOURCES).filter(k => RESOURCES[k].type === type);
        const shuffled = candidates.sort(() => 0.5 - Math.random());
        const healthy = [];

        for (const key of shuffled) {
            if (healthy.length >= count) break;
            if (cache.get(`health_${key}`) !== false) healthy.push(key);
        }
        // If we ran out of healthy, try some 'unhealthy' ones again just in case (optional, safe skip for now)
        return healthy;
    }

    async search(query, type = 'search', options = {}) {
        const engines = await this.getHealthyResources(type, 10);
        const allResults = [];
        const seenUrls = new Set();

        // Parallel execution in chunks to avoid spamming but be fast
        const CHUNK_SIZE = 3;

        for (let i = 0; i < engines.length; i += CHUNK_SIZE) {
            if (allResults.length >= (process.env.MAX_RESULTS || 50)) break;

            const chunk = engines.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(key => this.fetchFromResource(key, query));

            const chunkResults = await Promise.allSettled(chunkPromises);

            for (const res of chunkResults) {
                if (res.status === 'fulfilled' && res.value) {
                    res.value.forEach(item => {
                        if (item.url && item.url.startsWith('http') && !seenUrls.has(item.url)) {
                            seenUrls.add(item.url);
                            allResults.push(item);
                        }
                    });
                }
            }
        }

        return allResults;
    }

    async fetchFromResource(key, query) {
        const resource = RESOURCES[key];
        // 1. Check robots (skipped for aggregators themselves usually, but good practice)
        // const allowed = await this.checkRobots(resource.url); 
        // if (!allowed) return [];

        return promiseRetry(async (retry, number) => {
            try {
                // Determine method: Static -> Proxy -> Dynamic
                // For aggregators, static usually works.
                // If strict 403, could try proxy.

                const proxy = await proxyManager.getProxy();
                const agent = proxy ? new (await import('https-proxy-agent')).HttpsProxyAgent(proxy) : undefined;

                const config = {
                    headers: { 'User-Agent': UserAgent.getRandom() },
                    timeout: 8000,
                    httpsAgent: agent
                };

                let response;
                if (resource.method === 'POST') {
                    // Use cloudscraper for better success on first try if it supports POST?
                    // Cloudscraper is request-promise based, usually cleaner to use axios first
                    // defaulting to axios here
                    response = await axios.post(resource.url,
                        new URLSearchParams(resource.params(query)).toString(),
                        { ...config, headers: { ...config.headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
                    );
                } else {
                    config.params = resource.params(query);
                    // If we have cloudscraper and no proxy, maybe use it?
                    // Just use axios for speed on aggregators
                    response = await axios.get(resource.url, config);
                }

                const $ = cheerio.load(response.data);
                return resource.parser($);

            } catch (e) {
                if (e.response && (e.response.status === 403 || e.response.status === 429) && number < 2) {
                    retry(e);
                }
                // If failed, return empty, don't throw to keep Promise.all running
                return [];
            }
        }, { retries: 1, minTimeout: 1000 });
    }

    async searchRSS(query) {
        const feeds = Object.keys(RESOURCES).filter(k => RESOURCES[k].type === 'rss');
        const selected = feeds.sort(() => 0.5 - Math.random()).slice(0, 5);
        const results = [];

        await Promise.all(selected.map(async (key) => {
            try {
                const feed = await rssParser.parseURL(RESOURCES[key].url);
                feed.items.forEach(item => {
                    if ((item.title && item.title.toLowerCase().includes(query.toLowerCase())) ||
                        (item.contentSnippet && item.contentSnippet.toLowerCase().includes(query.toLowerCase()))) {
                        results.push(standardise(item.link, item.title, item.contentSnippet, key));
                    }
                });
            } catch (e) { /* ignore */ }
        }));
        return results;
    }
}

export const resourceManager = new ResourceManager();
export const RESOURCES_LIST = RESOURCES;
