import { resourceManager } from '../services/resources.js';
import Joi from 'joi';

const schema = Joi.object({ query: Joi.string().required() });

export const searchController = (type) => async (req, res, next) => {
    try {
        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { query } = value;
        
        // Use resource manager key 'search' or specific ones if we separated 'news'
        // For now, mapping 'news' and 'blog' to general search with query suffix
        const modifiedQuery = type === 'news' ? `${query} news` : `${query} blog`;
        
        const links = await resourceManager.search(modifiedQuery);

        res.json({
            type,
            query: modifiedQuery,
            results: links.map(link => ({ link })) // Simplified structure
        });

    } catch (err) {
        next(err);
    }
};
