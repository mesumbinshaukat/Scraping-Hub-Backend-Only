import axios from 'axios';
import * as cheerio from 'cheerio';
import Joi from 'joi';
import { logger } from '../utils/logger.js';
import { UserAgent } from '../utils/userAgents.js';

const schema = Joi.object({ url: Joi.string().uri().required() });

export const rssController = async (req, res, next) => {
    try {
        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { url } = value;

        // Add User-Agent to mimic a browser
        const headers = { 'User-Agent': UserAgent.getRandom() };

        let response;
        try {
            response = await axios.get(url, {
                timeout: 10000,
                headers
            });
        } catch (axiosError) {
            logger.error({
                message: 'RSS Fetch Failed',
                url,
                status: axiosError.response?.status,
                code: axiosError.code
            });

            if (axiosError.response) {
                // Downstream server error
                if (axiosError.response.status === 404) {
                    return res.status(404).json({ error: "RSS Feed source not found (404)" });
                }
                return res.status(502).json({ error: `Upstream error: ${axiosError.response.status}` });
            } else if (axiosError.request) {
                // No response received
                return res.status(504).json({ error: "Upstream timeout or no response" });
            } else {
                // Request setup error
                throw axiosError;
            }
        }

        const $ = cheerio.load(response.data, { xmlMode: true });

        const items = [];
        $('item, entry').each((i, el) => {
            if (items.length > 50) return;
            items.push({
                title: $(el).find('title').text(),
                link: $(el).find('link').text() || $(el).find('link').attr('href'),
                pubDate: $(el).find('pubDate').text() || $(el).find('updated').text(),
                description: $(el).find('description').text() || $(el).find('summary').text(),
            });
        });

        res.json({
            title: $('channel > title').text() || $('feed > title').text(),
            items
        });
    } catch (err) {
        logger.error({ message: 'RSS Controller Internal Error', error: err.message });
        next(err);
    }
};
