import fs from 'fs';
import path from 'path';

const getDataPath = (filename) => {
    const dataDir = process.env.NODE_ENV === 'production' 
        ? '/tmp' 
        : path.join(process.cwd(), 'data');
    
    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    return path.join(dataDir, filename);
};

// Initialize JSON files
export const initDb = async () => {
    const logsPath = getDataPath('access_logs.json');
    const keysPath = getDataPath('api_keys.json');
    
    if (!fs.existsSync(logsPath)) {
        fs.writeFileSync(logsPath, JSON.stringify([]));
    }
    
    if (!fs.existsSync(keysPath)) {
        fs.writeFileSync(keysPath, JSON.stringify([]));
    }
    
    console.log('JSON storage initialized');
};

// Read JSON file
const readJSON = (filename) => {
    try {
        const data = fs.readFileSync(getDataPath(filename), 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
};

// Write JSON file
const writeJSON = (filename, data) => {
    fs.writeFileSync(getDataPath(filename), JSON.stringify(data, null, 2));
};

// Query helper for access logs
export const query = async (sql, params = []) => {
    const sqlUpper = sql.trim().toUpperCase();
    
    // INSERT into access_logs
    if (sqlUpper.startsWith('INSERT INTO ACCESS_LOGS')) {
        const logs = readJSON('access_logs.json');
        const newLog = {
            id: logs.length + 1,
            endpoint: params[0],
            status: params[1],
            ip: params[2],
            duration: params[3],
            created_at: new Date().toISOString()
        };
        logs.push(newLog);
        writeJSON('access_logs.json', logs);
        return [];
    }
    
    // INSERT into api_keys
    if (sqlUpper.startsWith('INSERT INTO API_KEYS')) {
        const keys = readJSON('api_keys.json');
        const newKey = {
            id: keys.length + 1,
            key_hash: params[0],
            name: params[1],
            created_at: new Date().toISOString()
        };
        keys.push(newKey);
        writeJSON('api_keys.json', keys);
        return [];
    }
    
    // SELECT from api_keys
    if (sqlUpper.includes('FROM API_KEYS')) {
        const keys = readJSON('api_keys.json');
        if (params.length > 0) {
            return keys.filter(k => k.key_hash === params[0]);
        }
        return keys;
    }
    
    // SELECT stats from access_logs
    if (sqlUpper.includes('FROM ACCESS_LOGS')) {
        const logs = readJSON('access_logs.json');
        const timeModifier = params[0];
        
        // Calculate time threshold
        let threshold = new Date();
        if (timeModifier === '-1 day') {
            threshold.setDate(threshold.getDate() - 1);
        } else if (timeModifier === '-7 days') {
            threshold.setDate(threshold.getDate() - 7);
        } else if (timeModifier === '-1 month') {
            threshold.setMonth(threshold.getMonth() - 1);
        }
        
        const filteredLogs = logs.filter(log => new Date(log.created_at) > threshold);
        
        const total_requests = filteredLogs.length;
        const success = filteredLogs.filter(l => l.status >= 200 && l.status < 300).length;
        const failures = filteredLogs.filter(l => l.status >= 400).length;
        const avg_duration = filteredLogs.length > 0 
            ? filteredLogs.reduce((sum, l) => sum + l.duration, 0) / filteredLogs.length 
            : 0;
        
        return [{
            total_requests,
            success,
            failures,
            avg_duration
        }];
    }
    
    // DELETE old logs
    if (sqlUpper.includes('DELETE FROM ACCESS_LOGS')) {
        const logs = readJSON('access_logs.json');
        const threshold = new Date();
        threshold.setMonth(threshold.getMonth() - 6);
        
        const filtered = logs.filter(log => new Date(log.created_at) > threshold);
        writeJSON('access_logs.json', filtered);
        return [];
    }
    
    return [];
};

export const getDb = async () => {
    return { query };
};
