import axios from 'axios';
import * as cheerio from 'cheerio';
import Joi from 'joi';

const schema = Joi.object({ url: Joi.string().uri().required() });

export const sitemapController = async (req, res, next) => {
    try {
        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { url } = value;
        const response = await axios.get(url, { timeout: 10000 });
        const $ = cheerio.load(response.data, { xmlMode: true });

        const urls = [];
        $('url').each((i, el) => {
            if (urls.length > 200) return; // Limit
            urls.push({
                loc: $(el).find('loc').text(),
                lastmod: $(el).find('lastmod').text(),
                priority: $(el).find('priority').text()
            });
        });

        // Handle sitemapindex
        $('sitemap').each((i, el) => {
             urls.push({
                loc: $(el).find('loc').text(),
                isIndex: true
            });
        });

        res.json({ count: urls.length, urls });
    } catch (err) {
        next(err);
    }
};
