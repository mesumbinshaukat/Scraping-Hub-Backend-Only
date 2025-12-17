import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

let db;
let SQL;

export const initDb = async () => {
    if (db) return db;

    // Initialize SQL.js with CDN-hosted WASM (Vercel compatible)
    if (!SQL) {
        SQL = await initSqlJs({
            locateFile: file => `https://sql.js.org/dist/${file}`
        });
    }

    const dbPath = process.env.NODE_ENV === 'production' 
        ? path.join('/tmp', 'scraping.db') 
        : path.join(process.cwd(), 'scraping.db');

    console.log(`Initializing SQL.js database at ${dbPath}`);
    
    // Load existing DB or create new
    let buffer;
    try {
        if (fs.existsSync(dbPath)) {
            buffer = fs.readFileSync(dbPath);
        }
    } catch (e) {
        console.log('Creating new database');
    }

    db = new SQL.Database(buffer);
    
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        status INTEGER,
        ip TEXT,
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Save to disk periodically
    saveDb(dbPath);
    
    return db;
};

const saveDb = (dbPath) => {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
};

export const getDb = async () => {
    if (!db) await initDb();
    return db;
};

export const query = async (sql, params = []) => {
    const database = await getDb();
    const stmt = database.prepare(sql);
    stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    
    // Save after write operations
    if (sql.trim().toUpperCase().startsWith('INSERT') || 
        sql.trim().toUpperCase().startsWith('UPDATE') ||
        sql.trim().toUpperCase().startsWith('DELETE')) {
        const dbPath = process.env.NODE_ENV === 'production' 
            ? path.join('/tmp', 'scraping.db') 
            : path.join(process.cwd(), 'scraping.db');
        saveDb(dbPath);
    }
    
    return results;
};
