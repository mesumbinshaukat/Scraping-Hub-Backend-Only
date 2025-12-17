import { query } from '../utils/db.js';
import crypto from 'crypto';

export const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    }

    const token = authHeader.split(' ')[1];

    // Check against MASTER_KEY
    if (process.env.MASTER_KEY && token === process.env.MASTER_KEY) {
        return next();
    }

    // Check against Database
    try {
        const inboundHash = crypto.createHash('sha256').update(token).digest('hex');
        const rows = await query('SELECT * FROM api_keys WHERE key_hash = ?', [inboundHash]);
        
        if (rows.length > 0) {
            return next();
        }
    } catch (err) {
        console.error("Auth DB error:", err);
    }

    return res.status(403).json({ error: 'Forbidden: Invalid token' });
};
