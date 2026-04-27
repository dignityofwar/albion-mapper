import 'dotenv/config';
console.log('CWD:', typeof process !== 'undefined' ? process.cwd() : 'unknown');
console.log('DATABASE_URL:', typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined);
