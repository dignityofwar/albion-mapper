import bcrypt from 'bcrypt';

const password = process.argv.slice(2).join(' ');
if (!password) {
  console.error('Usage: npx tsx scripts/generate-hash.ts <password>');
  process.exit(1);
}

const saltRounds = 12;
bcrypt.hash(password, saltRounds).then((hash) => {
  console.log(hash);
});
