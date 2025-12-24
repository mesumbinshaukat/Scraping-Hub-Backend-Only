import { resourceManager } from '../resources.js';

/**
 * Fallback Phase: Search and RSS
 * If static and dynamic phases fail, we try to find the content via search indices or RSS feeds.
 */
export const fallbackPhase = async (url) => {
    try {
        const domain = new URL(url).hostname;

        // 1. Try URL Search
        let results = await resourceManager.search(url, 'search');

        // 2. If empty, try RSS Search for the domain
        if (!results || results.length === 0) {
            console.log(`Search fallback empty for ${url}. Trying RSS fallback for domain ${domain}...`);
            results = await resourceManager.search(domain, 'rss');
        }

        if (results && results.length > 0) {
            // Find best match or use first
            const match = results.find(r => r.url === url) || results[0];

            return {
                title: match.title || 'Found via Fallback',
                description: match.snippet || `Content found in ${match.source} for ${url}.`,
                mainContent: match.snippet || match.title,
                links: results.map(r => r.url).filter(l => l !== url),
                method: `fallback_${match.source || 'resource'}_search`,
                duration: 0
            };
        }

        return null;

    } catch (error) {
        console.error(`Fallback phase error for ${url}:`, error.message);
        return null; // Silent fail for fallback
    }
};
