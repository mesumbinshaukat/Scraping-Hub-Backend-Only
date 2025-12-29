import winston from 'winston';
import createDOMPurify from 'dompurify';
import { JSDOM, ResourceLoader } from 'jsdom';
import { Window as HappyWindow } from 'happy-dom';
import cloudscraper from 'cloudscraper';
import iconv from 'iconv-lite';
import https from 'https';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

const dompurify = createDOMPurify(new JSDOM('').window);

/**
 * Lightweight JS rendered scraping using JSDOM and Happy-DOM fallback.
 * Optimized for Vercel Hobby (3s execution limit).
 */
export const dynamicPhase = async (url, options = {}) => {
    const startTime = Date.now();
    const JS_EXECUTION_TIMEOUT = 3000;

    try {
        // 1. Fetch HTML using cloudscraper (static method)
        const html = await fetchRawHtml(url);

        // 2. Try JSDOM first (more feature complete)
        try {
            logger.info({ message: 'Attempting JSDOM rendering', url });
            return await renderWithJSDOM(html, url, JS_EXECUTION_TIMEOUT);
        } catch (jsdomError) {
            logger.warn({ message: 'JSDOM failed, falling back to Happy-DOM', url, error: jsdomError.message });
            // 3. Fallback to Happy-DOM (faster, simpler)
            return await renderWithHappyDOM(html, url, JS_EXECUTION_TIMEOUT);
        }

    } catch (error) {
        logger.error({ message: 'Dynamic phase failed', url, error: error.message });
        throw error;
    }
};

const fetchRawHtml = async (url) => {
    const ignoreSsl = process.env.IGNORE_SSL_ERRORS === 'true';
    const config = {
        url,
        method: 'GET',
        timeout: 5000,
        responseType: 'arraybuffer',
        strictSSL: !ignoreSsl,
        agentOptions: ignoreSsl ? { rejectUnauthorized: false } : {}
    };

    const response = await cloudscraper(config);
    return iconv.decode(Buffer.from(response), 'utf-8');
};

import { MessageChannel } from 'worker_threads';
import { VirtualConsole } from 'jsdom';

const renderWithJSDOM = async (html, url, timeout) => {
    const resourceLoader = new ResourceLoader({
        proxy: process.env.PROXY_ENABLED === 'true' ? process.env.PROXY_URL : undefined,
        strictSSL: false,
    });

    // Suppress JSDOM CSS/Script errors
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (err) => {
        if (err.message.includes('Could not parse CSS stylesheet')) return; // Ignore CSS errors
        logger.debug({ message: 'JSDOM Error', url, error: err.message });
    });
    virtualConsole.on("error", (err) => {
        logger.debug({ message: 'JSDOM Console Error', url, error: err.message });
    });
    // Optional: Forward logs if needed, but keep it clean
    // virtualConsole.sendTo(console, { omitJSDOMErrors: true });

    const dom = new JSDOM(html, {
        url,
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        resourceLoader,
        virtualConsole, // Attach the custom console
        beforeParse(window) {
            // Polyfill MessageChannel for reCAPTCHA/external scripts
            window.MessageChannel = MessageChannel;
        }
    });

    // Wait for scripts to execute (with timeout)
    await Promise.race([
        new Promise(resolve => {
            dom.window.addEventListener('load', resolve);
            setTimeout(resolve, timeout); // Hard cap on wait
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('JSDOM Timeout')), timeout + 500))
    ]);

    const result = extractData(dom.window.document);
    dom.window.close();
    return { ...result, method: 'dynamic_jsdom' };
};

const renderWithHappyDOM = async (html, url, timeout) => {
    const window = new HappyWindow({
        url,
        settings: {
            disableJavaScriptEvaluation: false,
            disableJavaScriptFileLoading: true, // Only inline scripts for speed
            disableCSSFileLoading: true,
            disableIframePageLoading: true
        }
    });

    const document = window.document;
    document.write(html);

    // Give it a moment to run inline scripts
    await new Promise(resolve => setTimeout(resolve, timeout / 2));

    const result = extractData(document);
    await window.close();
    return { ...result, method: 'dynamic_happydom' };
};

const extractData = (document) => {
    const getMeta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute('content') || '';

    // Remove noise
    ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe'].forEach(s =>
        document.querySelectorAll(s).forEach(e => e.remove())
    );

    const title = document.title;
    const body = document.body;

    // Simple extraction logic
    const html = body.innerHTML;
    const text = body.textContent || body.innerText || '';

    // Check for zero content
    if (text.trim().length < 100) {
        throw new Error('Rendered content too short');
    }

    const sanitized = dompurify.sanitize(html, { ALLOWED_TAGS: [] }).trim().substring(0, 200000);

    return {
        title,
        description: getMeta('description') || getMeta('og:description'),
        image: getMeta('og:image'),
        mainContent: sanitized || text.trim().substring(0, 200000),
        links: Array.from(document.querySelectorAll('a[href^="http"]'))
            .map(a => a.href)
            .slice(0, 50)
    };
};
