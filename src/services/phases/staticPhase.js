import axios from 'axios';
import * as cheerio from 'cheerio';
import { UserAgent } from '../../utils/userAgents.js';
import robotsParser from 'robots-parser';
import cloudscraper from 'cloudscraper';
import { proxyManager } from '../../utils/proxyManager.js';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import iconv from 'iconv-lite';
import https from 'https';

const window = new JSDOM('').window;
const dompurify = createDOMPurify(window);

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;

/**
 * Fetch and parse robots.txt
 */
const getRobotsTxt = async (url) => {
    try {
        const robotsUrl = new URL('/robots.txt', url).href;
        const response = await axios.get(robotsUrl, { timeout: 3000 });
        return robotsParser(robotsUrl, response.data);
    } catch (e) {
        return null; // Assume allowed if robots.txt unreachable
    }
};

/**
 * Core request maker with Cloudscraper/Proxy/Retry logic
 */
const requestWithRetry = async (url, options = {}, attempt = 1, forceProxy = false) => {
    try {
        const delay = Math.floor(Math.random() * SCRAPE_DELAY) + 500;
        await new Promise(r => setTimeout(r, delay));

        const headers = {
            'User-Agent': UserAgent.getRandom(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
            ...options.headers
        };

        const ignoreSsl = process.env.IGNORE_SSL_ERRORS === 'true';
        const httpsAgent = new https.Agent({ rejectUnauthorized: !ignoreSsl });

        const config = {
            url,
            method: options.method || 'GET',
            headers,
            timeout: 8000,
            responseType: 'arraybuffer',
            httpsAgent,
            strictSSL: !ignoreSsl // for cloudscraper/request
        };

        // Proxy Rotation
        if (process.env.PROXY_ENABLED === 'true' || forceProxy) {
            const proxy = await proxyManager.getNextProxy();
            if (proxy) {
                const urlParsed = new URL(proxy);
                config.proxy = proxy; // Cloudscraper likes the string
                config.httpProxy = proxy;
                // For axios config
                config.proxy = {
                    host: urlParsed.hostname,
                    port: parseInt(urlParsed.port),
                    protocol: urlParsed.protocol.replace(':', '')
                };
                if (urlParsed.username) {
                    config.proxy.auth = {
                        username: urlParsed.username,
                        password: urlParsed.password
                    };
                }
            }
        }

        try {
            // Priority 1: Cloudscraper (Bypasses Cloudflare/Some Akamai)
            const csResponse = await cloudscraper({
                ...config,
                resolveWithFullResponse: true,
                simple: true,
                agentOptions: ignoreSsl ? { rejectUnauthorized: false } : {}
            });

            const data = iconv.decode(Buffer.from(csResponse.body), 'utf-8');
            return { data, status: csResponse.statusCode };
        } catch (csError) {
            // EPROTO errors often solved by rejecting unauthorized
            if (csError.message?.includes('EPROTO') || csError.message?.includes('SSL')) {
                console.warn(`SSL/EPROTO error detected for ${url}, retrying with insecure fallback...`);
                config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
                config.strictSSL = false;
            }

            // Priority 2: Standard Axios fallback if cloudscraper fails for non-antibot reasons
            if (csError.statusCode !== 403 && csError.statusCode !== 429) {
                const axiosResponse = await axios(config);
                const data = iconv.decode(Buffer.from(axiosResponse.data), 'utf-8');
                return { data, status: axiosResponse.status };
            }
            throw csError;
        }

    } catch (error) {
        const status = error.response?.status || error.statusCode;
        const isBlock = [403, 429, 503].includes(status) || error.message?.toLowerCase().includes('denied') || error.message?.toLowerCase().includes('blocked');

        if (attempt < MAX_RETRIES && (isBlock || error.code === 'ECONNABORTED' || error.message?.includes('EPROTO'))) {
            const backoff = Math.pow(attempt === 1 ? 0.5 : 2, attempt) * 1000;
            console.log(`Static phase retry ${attempt} for ${url} in ${backoff}ms (ForceProxy: ${isBlock})...`);
            return requestWithRetry(url, options, attempt + 1, isBlock);
        }
        throw error;
    }
};

/**
 * Main Static Phase entry
 */
export const staticPhase = async (url, options = {}) => {
    try {
        // 1. Robots.txt Compliance
        const robots = await getRobotsTxt(url);
        if (robots && !robots.isAllowed(url, 'Googlebot')) {
            throw new Error('Disallowed by robots.txt');
        }

        // 2. Execute Request
        const response = await requestWithRetry(url, options);
        const $ = cheerio.load(response.data);

        // 3. Block Detection in Content
        const pageText = $('body').text().toLowerCase();
        const blockKeywords = ['captcha', 'access denied', 'blocked', 'please enable js', 'security check', 'not a robot', 'cloudflare', 'ddos protection'];
        if (blockKeywords.some(k => pageText.includes(k))) {
            throw new Error('Anti-bot detected in static content');
        }

        // 4. Data Extraction
        const getMeta = (n) => $(`meta[name="${n}"], meta[property="${n}"]`).attr('content') || '';

        // Remove noise
        $('script, style, nav, footer, header, aside, .ad, iframe').remove();

        const mainSelectors = ['main', 'article', '#content', '.content', '.post-content', 'body'];
        let mainContent = '';
        for (const selector of mainSelectors) {
            const el = $(selector);
            if (el.length > 0) {
                const text = el.text().replace(/\s+/g, ' ').trim();
                if (text.length > 200) {
                    mainContent = text;
                    break;
                }
            }
        }

        const sanitized = dompurify.sanitize(mainContent || $('body').text()).trim().substring(0, 200000);

        if (sanitized.length < 200) {
            throw new Error('Static content too short, possible partial block');
        }

        const links = [];
        $('a[href^="http"]').each((_, el) => {
            links.push($(el).attr('href'));
        });

        return {
            title: $('title').text().trim(),
            description: getMeta('description') || getMeta('og:description'),
            image: getMeta('og:image'),
            mainContent: sanitized,
            links: [...new Set(links)].slice(0, 50),
            method: 'static_cloudscraper',
            duration: 0 // Will be set by parent
        };

    } catch (error) {
        throw error; // Rethrow to trigger fallback/dynamic
    }
};
