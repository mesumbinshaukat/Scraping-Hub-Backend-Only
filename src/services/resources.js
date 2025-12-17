import axios from 'axios';
import { UserAgent } from '../utils/userAgents.js';
import * as cheerio from 'cheerio';

// Resource definitions with simple scraping logic or RSS endpoints
const RESOURCES = {
    // Search Engines (Static HTML scraping where possible)
    duckduckgo: {
        type: 'search',
        url: 'https://html.duckduckgo.com/html/',
        method: 'POST',
        params: (q) => ({ q }),
        parser: ($) => $('.result__a').map((i, el) => $(el).attr('href')).get(),
    },
    brave: {
        type: 'search',
        url: 'https://search.brave.com/search',
        params: (q) => ({ q }),
        parser: ($) => $('.snippet-content .title').map((i, el) => $(el).attr('href')).get(), // Approximate
    },
    mojeek: {
        type: 'search',
        url: 'https://www.mojeek.com/search',
        params: (q) => ({ q }),
        parser: ($) => $('.result-link').map((i, el) => $(el).attr('href')).get(),
    },
    startpage: {
        type: 'search',
        url: 'https://www.startpage.com/sp/search', // Hard to scrape statically usually, but attempting
        method: 'POST',
        params: (q) => ({ query: q }),
        parser: ($) => [], // Startpage is hard without JS often
    },
    ecosia: {
        type: 'search',
        url: 'https://www.ecosia.org/search',
        params: (q) => ({ q }),
        parser: ($) => $('.result-title').map((i, el) => $(el).attr('href')).get(),
    },
    // ... add more search engines as 'search' type
    
    // Content/RSS Sources
    bbc: { type: 'rss', url: 'http://feeds.bbci.co.uk/news/rss.xml' },
    cnn: { type: 'rss', url: 'http://rss.cnn.com/rss/edition.rss' },
    reuters: { type: 'rss', url: 'https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best' },
    guardian: { type: 'rss', url: 'https://www.theguardian.com/world/rss' },
    nytimes: { type: 'rss', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
    
    // Public Data
    wikipedia: {
        type: 'direct',
        baseUrl: 'https://en.wikipedia.org/wiki/',
        parser: ($) => $('#mw-content-text').text(),
    },
    // ... and others from the list
};

class ResourceManager {
    constructor() {
        this.status = new Map(); // url -> { healthy: bool, lastChecked: timestamp }
        // Initialize status
        Object.keys(RESOURCES).forEach(k => {
            this.status.set(k, { healthy: true, lastChecked: 0 });
        });
    }

    async getHealthyResource(type = 'search') {
        // Simple round-robin or random retry for now
        const candidates = Object.keys(RESOURCES).filter(k => RESOURCES[k].type === type);
        if (candidates.length === 0) return null;
        
        // In a real generic implementation, we would check liveness here or rotate
        // For now, return a random healthy-assumed candidate
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    async search(query) {
        // Try up to 3 engines
        for (let i = 0; i < 3; i++) {
            const key = await this.getHealthyResource('search');
            if (!key) break;
            
            const resource = RESOURCES[key];
            try {
                const config = {
                    headers: { 'User-Agent': UserAgent.getRandom() },
                    params: resource.method === 'GET' || !resource.method ? resource.params(query) : undefined,
                    timeout: 5000,
                };
                
                if (resource.method === 'POST') {
                    // Handle POST params if needed, mostly form data
                }

                console.log(`Searching via ${key}`);
                const response = await axios(resource.url, config);
                 // Need to handle POST data specifically if the engine requires it in body
                 // Simplify for now to GET-based engines mainly or handle simple POSTs

                const $ = cheerio.load(response.data);
                const links = resource.parser($);
                if (links.length > 0) return links;
            } catch (e) {
                console.error(`Search ${key} failed: ${e.message}`);
                // Mark unhealthy?
            }
        }
        return [];
    }
}

export const resourceManager = new ResourceManager();
export const RESOURCES_LIST = RESOURCES;
