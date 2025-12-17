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
    


    try {
        const data = await scrapeQueue.add(() => scraperService.scrape(url));
        res.json({
            message: 'Scraping successful',
            url: url,
            data: data
        });
    } catch (scrapeError) {
        next(scrapeError);
    }


  } catch (err) {
    next(err);
  }
};
