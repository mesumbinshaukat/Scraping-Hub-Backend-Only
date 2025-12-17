import { getDb } from '../utils/db.js';

export const statsController = async (req, res, next) => {
    try {
        const { period } = req.params; // daily, weekly, monthly
        const db = getDb();
        
        let timeModifier;
        switch(period) {
            case 'daily': timeModifier = '-1 day'; break;
            case 'weekly': timeModifier = '-7 days'; break;
            case 'monthly': 
            default: timeModifier = '-1 month'; break;
        }

        const sql = `
            SELECT 
                COUNT(*) as total_requests,
                COUNT(CASE WHEN status >= 200 AND status < 300 THEN 1 END) as success,
                COUNT(CASE WHEN status >= 400 THEN 1 END) as failures,
                AVG(duration) as avg_duration
            FROM access_logs
            WHERE created_at > datetime('now', ?)
        `;

        const stmt = db.prepare(sql);
        const result = stmt.get(timeModifier);

        res.json({
            period,
            data: result,
            note: "This API shows data for the last 6 months only."
        });

    } catch (err) {
        next(err);
    }
};

// Middleware to log requests
export const logRequest = async (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', async () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const endpoint = req.path;
        const ip = req.ip || req.connection.remoteAddress;

        try {
            const db = getDb();
            const stmt = db.prepare('INSERT INTO access_logs(endpoint, status, ip, duration) VALUES(?, ?, ?, ?)');
            stmt.run(endpoint, status, ip, duration);
        } catch (e) {
            console.error("Failed to log request", e);
        }
    });
    
    next();
};

export const cleanupLogs = async (req, res, next) => {
    // Vercel Cron verification
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const db = getDb();
        // Delete older than 6 months
        const stmt = db.prepare("DELETE FROM access_logs WHERE created_at < datetime('now', '-6 months')");
        const info = stmt.run();
        
        res.json({ message: 'Cleanup complete', deleted: info.changes });
    } catch (err) {
        next(err);
    }
};
