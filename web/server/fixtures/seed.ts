import { db, initDb } from '../src/db.js';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

async function seed() {
  console.log('Starting database seeding...');
  
  await initDb();

  const roomId = 'demo-room';
  const password = 'password123';
  const adminPassword = 'admin123';
  const homeZoneId = '7004'; // Martlock for example, or a roads zone

  const passwordHash = await bcrypt.hash(password, 10);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  try {
    // Check if room exists
    const { rows } = await db.query('SELECT 1 FROM rooms WHERE id = $1', [roomId]);
    
    if (rows.length === 0) {
      console.log(`Creating demo room: ${roomId}`);
      await db.query(
        'INSERT INTO rooms (id, password_hash, admin_password_hash, home_zone_id, created_at) VALUES ($1, $2, $3, $4, $5)',
        [roomId, passwordHash, adminPasswordHash, homeZoneId, new Date().toISOString()]
      );

      // Add some sample connections
      const connId = nanoid();
      await db.query(
        'INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, expires_at, reported_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [connId, roomId, homeZoneId, '3004', new Date(Date.now() + 3600000).toISOString(), new Date().toISOString()]
      );

      console.log('Seeding completed successfully.');
      console.log(`Room ID: ${roomId}`);
      console.log(`Password: ${password}`);
      console.log(`Admin Password: ${adminPassword}`);
    } else {
      console.log('Demo room already exists. Skipping seeding.');
    }
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await db.end();
  }
}

seed();
