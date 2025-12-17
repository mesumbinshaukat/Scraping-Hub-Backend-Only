import { resourceManager } from '../services/resources.js';
import Joi from 'joi';

const schema = Joi.object({ query: Joi.string().required() });

// Combined controller for search, news, and blog
export const searchController = (type) => async (req, res, next) => {
    try {
        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { query } = value;
        
        let modifiedQuery = query;
        if (type === 'news') modifiedQuery = `${query} news`;
        if (type === 'blog') modifiedQuery = `${query} blog`;
        
        // 1. Try generic search engines
        let results = await resourceManager.search(modifiedQuery, 'search');

        // 2. If empty or specifically 'news'/'blog', try RSS fallback
        if (results.length === 0 || type === 'news') {
            console.log('Search returned empty/few results, falling back to RSS feeds...');
            const rssResults = await resourceManager.searchRSS(query);
            results = [...results, ...rssResults];
        }

        // 3. De-duplicate by URL
        const seen = new Set();
        const uniqueResults = results.filter(r => {
            const isDuplicate = seen.has(r.url);
            seen.add(r.url);
            return !isDuplicate;
        }).slice(0, 50); // Limit to 50

        res.json({
            success: true,
            type,
            query: modifiedQuery,
            count: uniqueResults.length,
            data: {
                results: uniqueResults
            }
        });

    } catch (err) {
        next(err);
    }
};
