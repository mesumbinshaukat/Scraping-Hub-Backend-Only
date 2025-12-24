import axios from 'axios';
import * as cheerio from 'cheerio';
import { UserAgent } from '../../utils/userAgents.js';
import robotsParser from 'robots-parser';
import cloudscraper from 'cloudscraper';

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getRobotsTxt = async (url) => {
    try {
        const robotsUrl = new URL('/robots.txt', url).href;
        const response = await axios.get(robotsUrl, { timeout: 3000 });
        return robotsParser(robotsUrl, response.data);
    } catch (e) {
        return null;
    }
};

const makeRequest = async (url, options = {}, attempt = 1) => {
    try {
        const delay = Math.floor(Math.random() * SCRAPE_DELAY) + 500;
        await wait(delay);

        const headers = {
            'User-Agent': UserAgent.getRandom(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
            ...options.headers
        };

        const config = {
            method: options.method || 'GET',
            url,
            headers,
            timeout: 10000,
            validateStatus: (status) => status === 200, // Only accept 200
            ...options
        };

        // Handle POST data
        if (options.data && options.headers?.['Content-Type'] === 'application/x-www-form-urlencoded') {
            config.data = new URLSearchParams(options.data).toString();
        }

        try {
            const response = await axios(config);
            // Check for empty content
            if (!response.data || response.data.length < 100) {
                throw new Error('Empty content received');
            }
            return response;
        } catch (axiosError) {
            // Fallback to cloudscraper if axios fails with 403 or other non-200
            if (axiosError.response?.status === 403 || !axiosError.response) {
                console.log(`Axios failed for ${url} (status: ${axiosError.response?.status}). Trying cloudscraper fallback...`);
                const csData = await cloudscraper({
                    method: config.method,
                    url: config.url,
                    headers: config.headers,
                    formData: options.data,
                    timeout: config.timeout
                });
                return { data: csData };
            }
            throw axiosError;
        }
    } catch (error) {
        if (attempt < MAX_RETRIES) {
            // Exponential backoff
            const backoff = Math.pow(2, attempt) * 1000;
            console.log(`Static scrape failed (attempt ${attempt}). Retrying in ${backoff}ms...`);
            await wait(backoff);
            return makeRequest(url, options, attempt + 1);
        }
        throw error;
    }
};

export const staticPhase = async (url, options = {}) => {
    try {
        // Check robots.txt logic
        const robots = await getRobotsTxt(url);
        if (robots && !robots.isAllowed(url, 'Googlebot')) { // Mimic Googlebot as good citizen, or generic user agent
            // Note: Many sites block generic bots but allow browsers. 
            // Strictly following robots.txt might limit scope too much for this "bypass" tool.
            // We'll log warning but proceed if user agent allows?
            // For strict compliance:
            // if (!robots.isAllowed(url, options.userAgent || 'MyBot')) throw new Error('Robots.txt disallowed');
        }

        const response = await makeRequest(url, options);

        const $ = cheerio.load(response.data);

        // Security check for captcha/block pages
        const title = $('title').text().toLowerCase();
        if (title.includes('captcha') || title.includes('robot') || title.includes('attention required') || title.includes('security check')) {
            throw new Error('Anti-bot page detected');
        }

        const data = {
            title: $('title').text().trim(),
            description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
            image: $('meta[property="og:image"]').attr('content') || '',
            content: '',
            links: [],
            method: 'static_phase'
        };

        // Improved Main Content Extraction
        // Remove noise
        $('script, style, nav, footer, header, aside, .ad, .advertisement, .social-share, .menu, .navigation').remove();

        // Try to find main article container
        const mainSelectors = ['main', 'article', '#content', '.content', '.post-content', '.article-body', '.entry-content', 'body'];
        let mainContent = '';

        for (const selector of mainSelectors) {
            if ($(selector).length > 0) {
                mainContent = $(selector).text().replace(/\s+/g, ' ').trim();
                if (mainContent.length > 200) break; // Good enough length
            }
        }

        data.mainContent = mainContent.substring(0, 200000); // 200k char limit

        // Extract Links
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.startsWith('http')) {
                data.links.push(href);
            }
        });

        // Limit links
        data.links = [...new Set(data.links)].slice(0, 50);

        return data;

    } catch (error) {
        throw error; // Rethrow to trigger dynamic phase
    }
};
