import axios from 'axios';
import NodeCache from 'node-cache';
import { HttpsProxyAgent } from 'https-proxy-agent';

const cache = new NodeCache({ stdTTL: 3600 }); // Cache proxies for 1 hour

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.lastFetch = 0;
        this.FETCH_INTERVAL = 1000 * 60 * 60; // 1 hour
    }

    async getProxy() {
        if (this.proxies.length === 0 || Date.now() - this.lastFetch > this.FETCH_INTERVAL) {
            await this.fetchProxies();
        }

        // Return a random healthy proxy if enabled
        if (process.env.PROXY_ENABLED !== 'true' || this.proxies.length === 0) {
            return null;
        }

        // Simple rotation: random choice
        return this.proxies[Math.floor(Math.random() * this.proxies.length)];
    }

    async fetchProxies() {
        console.log('Fetching fresh proxies...');
        try {
            // Fetch from free-proxy-list.net (example source)
            // In production, use a paid provider or more robust matching
            const response = await axios.get('https://free-proxy-list.net/');
            const html = response.data;
            
            // Simple regex to find IPs (quick & dirty for free lists)
            const ipPortRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{2,5})/g;
            const found = [];
            let match;
            
            // Extract from the first 100 matches to avoid garbage
            while ((match = ipPortRegex.exec(html)) !== null && found.length < 50) {
                found.push(`http://${match[1]}:${match[2]}`);
            }

            console.log(`Found ${found.length} potential proxies. validating...`);
            
            // Validate first 20 concurrently
            const candidates = found.slice(0, 20);
            const valid = (await Promise.all(candidates.map(p => this.checkHealth(p)))).filter(Boolean);

            this.proxies = valid;
            this.lastFetch = Date.now();
            console.log(`Active Proxies: ${this.proxies.length}`);

        } catch (error) {
            console.error('Failed to fetch proxies:', error.message);
        }
    }

    async checkHealth(proxyUrl) {
        try {
            const agent = new HttpsProxyAgent(proxyUrl);
            await axios.head('https://www.google.com', {
                httpsAgent: agent,
                timeout: 3000 // Fast timeout
            });
            return proxyUrl;
        } catch (e) {
            return null;
        }
    }
}

export const proxyManager = new ProxyManager();
