import axios from 'axios';
import * as cheerio from 'cheerio';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.lastUpdateTime = 0;
        this.updateInterval = 30 * 60 * 1000; // 30 minutes
    }

    async getProxies() {
        if (Date.now() - this.lastUpdateTime > this.updateInterval || this.proxies.length === 0) {
            await this.refreshProxies();
        }
        return this.proxies;
    }

    async refreshProxies() {
        if (process.env.PROXY_ENABLED !== 'true') return;

        logger.info('Updating free proxies...');
        try {
            const response = await axios.get('https://free-proxy-list.net/', { timeout: 10000 });
            const $ = cheerio.load(response.data);
            const newList = [];

            $('.table-responsive tbody tr').each((i, row) => {
                const cols = $(row).find('td');
                const ip = $(cols[0]).text().trim();
                const port = $(cols[1]).text().trim();
                const https = $(cols[6]).text().trim() === 'yes';

                if (ip && port && https) {
                    newList.push(`http://${ip}:${port}`);
                }
            });

            this.proxies = newList.slice(0, 50); // Limit to top 50
            this.lastUpdateTime = Date.now();
            logger.info(`Found ${this.proxies.length} potential HTTPS proxies.`);
        } catch (error) {
            logger.error('Failed to update proxies:', error.message);
        }
    }

    async getNextProxy() {
        const list = await this.getProxies();
        if (list.length === 0) return null;

        const proxy = list[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % list.length;
        return proxy;
    }

    /**
     * Optional validation for a specific proxy
     */
    async validateProxy(proxyUrl) {
        try {
            await axios.head('https://www.google.com', {
                proxy: {
                    host: proxyUrl.split('://')[1].split(':')[0],
                    port: parseInt(proxyUrl.split(':')[2])
                },
                timeout: 5000
            });
            return true;
        } catch (e) {
            return false;
        }
    }
}

export const proxyManager = new ProxyManager();
