import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { initDb } from './utils/db.js';
import { resourceManager } from './services/resources.js';

dotenv.config();

// Initialize DB immediately (async)
initDb().catch(console.error);

// Initialize Resources (health check)
resourceManager.init().catch(err => console.error('Resource init failed:', err));

// Initial proxy refresh
import('./utils/proxyManager.js').then(m => m.proxyManager.refreshProxies().catch(console.error));

const app = express();

// Logger Configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'scraping-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
      ),
    }),
  ],
});

// Middleware
app.set('trust proxy', 1); // Trust first proxy (Vercel)
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT) || 100, // Limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Serverless Scraping API', version: '2.0.0', status: 'active' });
});

app.use('/api', apiRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err); // Log full error to console for Vercel logs
  logger.error(err.message, { stack: err.stack });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500,
    },
  });
});

// Export for Vercel
export default app;

// Start server if not running as a lambda (local dev)
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' && process.env.V_DEV !== 'true') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    console.log(`Local server: http://localhost:${PORT}`);
  });
}
