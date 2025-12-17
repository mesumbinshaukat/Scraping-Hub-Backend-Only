import axios from 'axios';
import * as cheerio from 'cheerio';
import Joi from 'joi';

const schema = Joi.object({ url: Joi.string().uri().required() });

export const rssController = async (req, res, next) => {
    try {
        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { url } = value;
        const response = await axios.get(url, { timeout: 10000 });
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
        next(err);
    }
};
