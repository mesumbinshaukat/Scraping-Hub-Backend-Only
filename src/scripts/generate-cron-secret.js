import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');
console.log('\nGenerated CRON_SECRET:');
console.log('----------------------------------------------------------------');
console.log(secret);
console.log('----------------------------------------------------------------');
console.log('Add this to your .env file as CRON_SECRET=\n');
