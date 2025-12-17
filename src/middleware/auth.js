import { getDb } from '../utils/db.js';
import crypto from 'crypto';

export const authenticate = (req, res, next) => {
    // 1. Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Check against MASTER_KEY (Environment Variable) - Recommended for Vercel
    if (process.env.MASTER_KEY && token === process.env.MASTER_KEY) {
        return next();
    }

    // 3. Check against Database (SQLite) - Good for local, ephemeral on Vercel
    try {
        const db = getDb();
        
        // In a production system, we would hash the incoming token and compare hashes
        // For simplicity with this randomly generated token approach, we can verify the hash
        // or if using JWT, verify signature. 
        // Here we assume the DB stores the Hash of the key.
        
        // Ideally we iterate known keys or look up if we can. 
        // To be secure, we shouldn't store plain text.
        // Let's assume the user generates a key, we store the SHA256 hash.
        
        const inboundHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(inboundHash);
        
        if (row) {
            return next();
        }
    } catch (err) {
        console.error("Auth DB error:", err);
    }

    return res.status(403).json({ error: 'Forbidden: Invalid token' });
};
