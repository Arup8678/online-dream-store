import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { config } from './config.js';

/** Ensure there is always an admin account to log in with. */
export function ensureAdmin() {
  const exists = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
  if (exists) return;
  db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES ('Shop Admin',?,?,'admin')").run(config.adminEmail, bcrypt.hashSync(config.adminPassword, 10));
  console.log(`✔ Created admin account ${config.adminEmail} (change the password in Admin → Settings)`);
}
