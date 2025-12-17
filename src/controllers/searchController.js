import { resourceManager } from '../services/resources.js';
import Joi from 'joi';

const schema = Joi.object({ query: Joi.string().required() });

const buildSuggestions = (query) => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const baseTokens = trimmed.split(/\s+/);
    const variants = new Set();

    // Encourage simpler one-word searches
    if (baseTokens.length > 1) {
        variants.add(baseTokens[0]);
        variants.add(baseTokens.slice(0, 2).join(' '));
    } else if (trimmed.length > 2) {
        variants.add(trimmed.slice(0, 3));
        if (trimmed.length > 5) {
            variants.add(trimmed.slice(0, Math.ceil(trimmed.length / 2)));
        }
    }

    // Remove trailing context words like "news"/"blog"
    const withoutContext = trimmed.replace(/\b(news|blog)\b/gi, '').trim();
    if (withoutContext && withoutContext !== trimmed) {
        variants.add(withoutContext);
    }

    return Array.from(variants).filter(Boolean);
};

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

        const responsePayload = {
            success: uniqueResults.length > 0,
            type,
            query: modifiedQuery,
            count: uniqueResults.length,
            data: {
                results: uniqueResults
            }
        };

        if (uniqueResults.length === 0) {
            const suggestions = buildSuggestions(query);
            responsePayload.message = `No ${type} results found for "${query}". Try a broader keyword.`;
            if (suggestions.length) {
                responsePayload.suggestions = suggestions;
            }
        }

        res.status(uniqueResults.length ? 200 : 404).json(responsePayload);

    } catch (err) {
        next(err);
    }
};
