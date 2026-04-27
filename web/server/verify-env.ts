import 'dotenv/config';
console.log('DATABASE_URL:', typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined);
