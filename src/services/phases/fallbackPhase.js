import { resourceManager } from '../resources.js';
import { UserAgent } from '../../utils/userAgents.js';

export const fallbackPhase = async (url) => {
    // Phase 3: Search for the URL to find a cache or snippet
    // Logic: Search for the specific URL to see if it's indexed
    
    try {
        const results = await resourceManager.search(url, 'search');
        
        if (results && results.length > 0) {
            // Found it indexed
            const match = results.find(r => r.url === url) || results[0];
            
            return {
                title: match.title || 'Available via Search',
                description: `Direct scrape failed, but URL found in ${match.source}.`,
                content: `Found in search index: ${match.url}`,
                links: results.map(r => r.url),
                mainContent: `This content was not directly scrapable, but was found in ${match.source}. Url: ${match.url}`,
                method: 'fallback_phase_3_search'
            };
        }
        
        return null;

    } catch (error) {
        throw error;
    }
};
