import { resourceManager } from '../services/resources.js';
import Joi from 'joi';
import nlp from 'compromise';

const schema = Joi.object({
    query: Joi.string().required().min(2).max(200),
    type: Joi.string().valid('all', 'news', 'blog').default('all')
});

const buildSuggestions = (query) => {
    const doc = nlp(query);
    const nouns = doc.nouns().out('array');
    const terms = query.split(' ');

    // Basic variations
    const suggestions = new Set();
    if (terms.length > 2) suggestions.add(terms.slice(0, 2).join(' '));
    if (nouns.length > 0) suggestions.add(nouns[0]);

    return Array.from(suggestions);
};

export const searchController = (endpointType) => async (req, res, next) => {
    try {
        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { query, type: queryType } = value;
        // Prioritize specific endpoint type (e.g. /news -> 'news') or query param
        const searchType = endpointType || queryType;

        // Smart Query Analysis
        let modifiedQuery = query;
        const doc = nlp(query);

        // If searching news, maybe boost it
        if (searchType === 'news') {
            // Append 'news' if not present, but some engines handle this via params
            // modifiedQuery = `${query} news`; 
            // Logic moved to Resource params mostly, but keeps intent clear here
        }

        console.log(`[Search] Query: "${query}" Type: ${searchType}`);

        // 1. Primary Search
        let results = await resourceManager.search(modifiedQuery, searchType === 'blog' ? 'search' : 'search');
        // Note: 'blog' type engines might be 'search' type in resources with specific params, 
        // specifically wiby/marginalia are good for blogs. 
        // For now, mapping 'blog' -> 'search' but we could filter resources by custom tags later.

        // 2. Smart Fallback
        if (results.length < 5 || searchType === 'news') {
            console.log('Low results, triggering RSS fallback...');
            const rssResults = await resourceManager.searchRSS(query);
            results = [...results, ...rssResults];
        }

        // 3. Deduplication & Ranking
        const unique = new Map();
        results.forEach(item => {
            if (!unique.has(item.url)) {
                unique.set(item.url, item);
            }
        });

        let finalResults = Array.from(unique.values()).slice(0, process.env.MAX_RESULTS || 50);

        // 4. Response Construction
        const response = {
            success: true,
            meta: {
                query,
                type: searchType,
                count: finalResults.length,
                timestamp: new Date().toISOString()
            },
            data: finalResults
        };

        if (finalResults.length === 0) {
            response.message = `No results found for "${query}".`;
            response.suggestions = buildSuggestions(query);
        }

        // Always 200 OK with success flag structure
        res.json(response);

    } catch (err) {
        next(err);
    }
};
