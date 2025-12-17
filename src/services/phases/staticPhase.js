import axios from 'axios';
import * as cheerio from 'cheerio';
import { UserAgent } from '../../utils/userAgents.js'; // We'll create this later

export const staticScrape = async (url) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': UserAgent.getRandom(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000, // 10s timeout for static
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Basic Validation: Check if body is empty or very small
    if ($('body').text().trim().length < 50) {
        throw new Error('Content too short, possibly blocked or JS rendered');
    }

    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const mainContent = $('main').text().trim() || $('article').text().trim() || $('body').text().trim().substring(0, 200000); // Fail-safe (increased limit)
    
    // Extract Image
    const image = $('meta[property="og:image"]').attr('content') || '';

    // Extract Links (limit to 50)
    const links = [];
    $('a').each((i, el) => {
        if (links.length >= 50) return;
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) {
            links.push(href);
        }
    });

    return {
      title,
      description,
      content: mainContent,
      image,
      links,
      method: 'static_phase_1'
    };

  } catch (error) {
    throw error; // Let the orchestrator handle the fallback
  }
};
