import Database from 'better-sqlite3';
import path from 'path';

let db;

export const initDb = () => {
    if (db) return db;

    // Use /tmp in production (Vercel) to avoid readonly errors, though data is ephemeral
    // Locally use project root
    const dbPath = process.env.NODE_ENV === 'production' 
        ? path.join('/tmp', 'scraping.db') 
        : path.join(process.cwd(), 'scraping.db');

    console.log(`Initializing SQLite database at ${dbPath}`);
    
    db = new Database(dbPath);
    
    // basic wal mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        status INTEGER,
        ip TEXT,
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    return db;
};

// Wrapper ensuring DB is init
export const getDb = () => {
    if (!db) return initDb();
    return db;
};
