import Joi from 'joi';
import { scraperService } from '../services/scraper.js';
import { scrapeQueue } from '../services/queue.js';

const scrapeSchema = Joi.object({
  url: Joi.string().uri().required(),
});

export const scrapeController = async (req, res, next) => {
  try {
    const { error, value } = scrapeSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { url } = value;

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
      // We write the "start" of the JSON
      res.write('{"message": "Scraping in progress", "url": "' + url + '", "data": ');

      const data = await scraperService.scrape(url);

      // Write the data chunk
      res.write(JSON.stringify(data));

      // Write the "end" of the JSON
      res.write('}');
      res.end();
    } catch (scrapeError) {
      // If we already started writing, we can't change status code
      if (res.headersSent) {
        res.write(', "error": "' + scrapeError.message + '"}');
        res.end();
      } else {
        next(scrapeError);
      }
    }
  } catch (err) {
    next(err);
  }
};
