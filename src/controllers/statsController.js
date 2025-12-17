import { getDb, query } from '../utils/db.js';

export const statsController = async (req, res, next) => {
    try {
        const { period } = req.params;
        
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

        const results = await query(sql, [timeModifier]);
        const result = results[0] || { total_requests: 0, success: 0, failures: 0, avg_duration: 0 };

        res.json({
            period,
            data: result,
            note: "This API shows data for the last 6 months only."
        });

    } catch (err) {
        next(err);
    }
};

export const logRequest = async (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', async () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const endpoint = req.path;
        const ip = req.ip || req.connection.remoteAddress;

        try {
            await query(
                'INSERT INTO access_logs(endpoint, status, ip, duration) VALUES(?, ?, ?, ?)',
                [endpoint, status, ip, duration]
            );
        } catch (e) {
            console.error("Failed to log request", e);
        }
    });
    
    next();
};

export const cleanupLogs = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sql = "DELETE FROM access_logs WHERE created_at < datetime('now', '-6 months')";
        await query(sql);
        
        res.json({ message: 'Cleanup complete' });
    } catch (err) {
        next(err);
    }
};
