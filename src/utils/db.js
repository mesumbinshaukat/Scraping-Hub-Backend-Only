import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;

const getDataPath = (filename) => {
    const dataDir = process.env.NODE_ENV === 'production'
        ? '/tmp'
        : path.join(process.cwd(), 'data');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    return path.join(dataDir, filename);
};

// Initialize DB
export const initDb = async () => {
    if (isVercel && process.env.KV_URL) {
        console.log('Vercel KV detected, skipping local DB init');
        return;
    }

    const logsPath = getDataPath('access_logs.json');
    const keysPath = getDataPath('api_keys.json');

    if (!fs.existsSync(logsPath)) fs.writeFileSync(logsPath, JSON.stringify([]));
    if (!fs.existsSync(keysPath)) fs.writeFileSync(keysPath, JSON.stringify([]));

    console.log('JSON storage initialized');
};

// Helper to interact with Vercel KV or Local JSON
const getCollection = async (name) => {
    if (isVercel && process.env.KV_URL) {
        return (await kv.get(name)) || [];
    }
    try {
        const data = fs.readFileSync(getDataPath(`${name}.json`), 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
};

const saveCollection = async (name, data) => {
    if (isVercel && process.env.KV_URL) {
        await kv.set(name, data);
        return;
    }
    fs.writeFileSync(getDataPath(`${name}.json`), JSON.stringify(data, null, 2));
};

export const query = async (sql, params = []) => {
    const sqlUpper = sql.trim().toUpperCase();

    // INSERT into access_logs
    if (sqlUpper.startsWith('INSERT INTO ACCESS_LOGS')) {
        const logs = await getCollection('access_logs');
        const newLog = {
            id: Date.now(),
            endpoint: params[0],
            status: params[1],
            ip: params[2],
            duration: params[3],
            created_at: new Date().toISOString()
        };
        logs.push(newLog);
        await saveCollection('access_logs', logs);
        return [];
    }

    // INSERT into api_keys
    if (sqlUpper.startsWith('INSERT INTO API_KEYS')) {
        const keys = await getCollection('api_keys');
        const newKey = {
            id: Date.now(),
            key_hash: params[0],
            name: params[1],
            created_at: new Date().toISOString()
        };
        keys.push(newKey);
        await saveCollection('api_keys', keys);
        return [];
    }

    // SELECT from api_keys
    if (sqlUpper.includes('FROM API_KEYS')) {
        const keys = await getCollection('api_keys');
        if (params.length > 0) {
            return keys.filter(k => k.key_hash === params[0]);
        }
        return keys;
    }

    // SELECT stats from access_logs
    if (sqlUpper.includes('FROM ACCESS_LOGS')) {
        const logs = await getCollection('access_logs');
        const timeModifier = params[0];

        let threshold = new Date();
        if (timeModifier === '-1 day') threshold.setDate(threshold.getDate() - 1);
        else if (timeModifier === '-7 days') threshold.setDate(threshold.getDate() - 7);
        else if (timeModifier === '-1 month') threshold.setMonth(threshold.getMonth() - 1);
        else if (timeModifier === '-6 months') threshold.setMonth(threshold.getMonth() - 6);

        const filteredLogs = logs.filter(log => new Date(log.created_at) > threshold);

        const total_requests = filteredLogs.length;
        const success = filteredLogs.filter(l => l.status >= 200 && l.status < 300).length;
        const failures = filteredLogs.filter(l => l.status >= 400).length;
        const avg_duration = filteredLogs.length > 0
            ? filteredLogs.reduce((sum, l) => sum + l.duration, 0) / filteredLogs.length
            : 0;

        return [{ total_requests, success, failures, avg_duration }];
    }

    // DELETE old logs
    if (sqlUpper.includes('DELETE FROM ACCESS_LOGS')) {
        const logs = await getCollection('access_logs');
        const threshold = new Date();
        threshold.setMonth(threshold.getMonth() - 6);

        const filtered = logs.filter(log => new Date(log.created_at) > threshold);
        await saveCollection('access_logs', filtered);
        return [];
    }

    return [];
};

export const getDb = async () => ({ query });
