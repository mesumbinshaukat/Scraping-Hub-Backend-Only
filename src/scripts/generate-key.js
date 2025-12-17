import { initDb, query } from '../utils/db.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const generateKey = async () => {
    const key = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    
    await initDb();
    await query('INSERT INTO api_keys (key_hash, name) VALUES (?, ?)', [hash, 'generated_key_' + Date.now()]);
    
    console.log('\n==================================================');
    console.log('API KEY GENERATED SUCCESSFULLY');
    console.log('==================================================');
    console.log(`\nKEY: ${key}`);
    console.log('\nCopy this key immediately. It is not stored in plain text.');
    console.log('\nUsage via Header:');
    console.log(`Authorization: Bearer ${key}`);
    console.log('\n[Vercel Deployment Tip]');
    console.log('Set this key as MASTER_KEY in your Vercel Project Settings');
    console.log('to ensure access persists across deployments.');
    console.log('==================================================\n');
    process.exit(0);
};

generateKey();
