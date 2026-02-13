// @ts-ignore -- sql.js has no bundled type declarations
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, 'shisha.db');

let sqlDb: any;
let inTransaction = false;

function saveDb() {
  if (inTransaction || !sqlDb) return;
  const data = sqlDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

class PreparedStatement {
  constructor(private sql: string) {}

  get(...params: any[]): any {
    const stmt = sqlDb.prepare(this.sql);
    try {
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: any = {};
        columns.forEach((col: string, i: number) => { row[col] = values[i]; });
        return row;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  all(...params: any[]): any[] {
    const stmt = sqlDb.prepare(this.sql);
    try {
      if (params.length > 0) stmt.bind(params);
      const rows: any[] = [];
      while (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: any = {};
        columns.forEach((col: string, i: number) => { row[col] = values[i]; });
        rows.push(row);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  run(...params: any[]): { lastInsertRowid: number; changes: number } {
    sqlDb.run(this.sql, params);
    const lastRow = sqlDb.exec("SELECT last_insert_rowid()");
    const changesRow = sqlDb.exec("SELECT changes()");
    const lastInsertRowid = (lastRow[0]?.values[0]?.[0] as number) ?? 0;
    const changes = (changesRow[0]?.values[0]?.[0] as number) ?? 0;
    saveDb();
    return { lastInsertRowid, changes };
  }
}

class DatabaseWrapper {
  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(sql);
  }

  exec(sql: string): void {
    sqlDb.exec(sql);
    saveDb();
  }

  pragma(pragma: string): void {
    sqlDb.exec(`PRAGMA ${pragma}`);
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      sqlDb.exec('BEGIN TRANSACTION');
      inTransaction = true;
      try {
        const result = fn(...args);
        inTransaction = false;
        sqlDb.exec('COMMIT');
        saveDb();
        return result;
      } catch (e) {
        inTransaction = false;
        sqlDb.exec('ROLLBACK');
        throw e;
      }
    }) as unknown as T;
  }
}

const db = new DatabaseWrapper();

export async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      role TEXT CHECK(role IN ('consumer', 'approver', 'driver', 'admin')),
      region TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price_per_gram REAL NOT NULL,
      image_url TEXT,
      category TEXT DEFAULT 'tobacco',
      category_id INTEGER,
      available INTEGER DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      amount_grams INTEGER NOT NULL,
      total_price REAL NOT NULL,
      delivery_address TEXT,
      delivery_lat REAL,
      delivery_lng REAL,
      customer_name TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','assigned','delivering','delivered','rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      driver_id INTEGER,
      FOREIGN KEY (consumer_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS driver_locations (
      driver_id INTEGER PRIMARY KEY,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notification_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      notification_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_id, notification_type)
    );
  `);

  // Migration: add visibility column to messages if missing
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN visibility TEXT DEFAULT 'all'`);
  } catch (_e) {
    // column already exists – ignore
  }

  // Migration: add region column if missing
  try {
    db.exec(`ALTER TABLE users ADD COLUMN region TEXT`);
  } catch (_e) {
    // column already exists – ignore
  }

  // Migration: add category_id column to products if missing
  try {
    db.exec(`ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)`);
  } catch (_e) {
    // column already exists – ignore
  }

  // Migration: update users role CHECK to include 'admin' for existing databases
  // SQLite doesn't support ALTER CHECK, so we recreate the table
  try {
    const testAdmin = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
    if (testAdmin && testAdmin.sql && !testAdmin.sql.includes("'admin'")) {
      db.exec(`PRAGMA foreign_keys = OFF`);
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT UNIQUE,
          name TEXT,
          role TEXT CHECK(role IN ('consumer', 'approver', 'driver', 'admin')),
          region TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users_new (id, phone, name, role, region, created_at)
          SELECT id, phone, name, role, region, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
      db.exec(`PRAGMA foreign_keys = ON`);
      console.log('✅ Migrated users table to include admin role');
    }
  } catch (_e) {
    console.log('Users migration skipped or already done');
  }

  // Seed categories if empty
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get() as any;
  if (catCount.c === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, display_order) VALUES (?, ?)');
    const categories = [
      ['Classic', 1],
      ['Fruity', 2],
      ['Mint', 3],
      ['Sweet', 4],
      ['Mix', 5],
      ['Premium', 6],
    ];
    for (const c of categories) {
      insertCat.run(...c);
    }
    console.log('✅ Seeded categories');

    // Backfill category_id on existing products
    const cats = db.prepare('SELECT id, name FROM categories').all() as any[];
    for (const cat of cats) {
      db.prepare('UPDATE products SET category_id = ? WHERE LOWER(category) = LOWER(?)').run(cat.id, cat.name);
    }
    console.log('✅ Backfilled product category_id');
  }

  // Seed products if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM products').get() as any;
  if (count.c === 0) {
    const insert = db.prepare(
      'INSERT INTO products (name, description, price_per_gram, image_url, category, category_id) VALUES (?, ?, ?, ?, ?, ?)'
    );
    // Helper to get category_id by name
    const getCatId = (name: string) => {
      const cat = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(name) as any;
      return cat ? cat.id : null;
    };
    const products: [string, string, number, string, string][] = [
      ['Al Fakher Double Apple', 'Classic double apple flavor — the most popular shisha tobacco worldwide. Rich, sweet, and aromatic.', 0.08, '🍎', 'classic'],
      ['Al Fakher Grape', 'Traditional grape flavor with rich, wine-like notes. Smooth and well-balanced classic.', 0.08, '🍇', 'classic'],
      ['Adalya The Two Apples', 'Premium double apple with enhanced flavor depth. Perfect balance of sweet and spice.', 0.09, '🍎', 'classic'],
      ['Adalya Love 66', 'Sweet and fruity blend with passion fruit, melon, and a hint of mint. Smooth and refreshing.', 0.10, '💕', 'fruity'],
      ['Adalya Lady Killer', 'Exotic fruity cocktail with tropical notes. Sweet, vibrant, and incredibly smooth.', 0.10, '💋', 'fruity'],
      ['Holster Ice Kaktus', 'Refreshing cactus fruit with cooling finish. Unique, exotic, and perfectly balanced.', 0.09, '🌵', 'fruity'],
      ['Fumari Tangelo', 'Citrus burst with sweet tangelo flavor. Bright, zesty, and energizing experience.', 0.11, '🍊', 'fruity'],
      ['Tangiers Cane Mint', 'Intense pure peppermint flavor. Strong buzz, bold taste. For experienced smokers.', 0.12, '🌿', 'mint'],
      ['Al Fakher Mint', 'Classic cooling mint. Clean, crisp, and refreshing with perfect menthol balance.', 0.07, '🌿', 'mint'],
      ['Fumari White Gummy Bear', 'Sweet gummy bear candy flavor. Light, fun, and incredibly smooth clouds.', 0.11, '🐻', 'sweet'],
      ['Fumari Blueberry Muffin', 'Bakery-fresh blueberry muffin flavor. Sweet, creamy, and dessert-like experience.', 0.11, '🧁', 'sweet'],
      ['Starbuzz Blue Mist', 'Berry cocktail with mysterious blue flavor. Complex, layered, and captivating taste.', 0.12, '💙', 'mix'],
      ['Al Fakher Watermelon Mint', 'Perfect summer blend of juicy watermelon and cooling mint. Refreshing and balanced.', 0.08, '🍉', 'mix'],
      ['Starbuzz Pirates Cave', 'Adventurous mix of tropical fruits and spices. Bold, complex, and unforgettable.', 0.12, '🏴‍☠️', 'mix'],
      ['Darkside Supernova', 'Cosmic blend of exotic fruits and premium tobacco. Intense flavor, premium quality.', 0.14, '🌟', 'premium'],
      ['Tangiers Kashmir Peach', 'Sophisticated peach with complex undertones. Rich, bold, and distinctly premium.', 0.13, '🍑', 'premium'],
      ['Darkside Deep Dive', 'Deep ocean of flavor with mysterious blend. Premium tobacco for connoisseurs only.', 0.14, '🌊', 'premium'],
    ];
    for (const p of products) {
      insert.run(p[0], p[1], p[2], p[3], p[4], getCatId(p[4]));
    }
    console.log('✅ Seeded products');
  }

  // Seed staff users and credentials
  const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff_credentials').get() as any;
  if (staffCount.c === 0) {
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (phone, name, role, region) VALUES (?, ?, ?, ?)');
    const insertCred = db.prepare('INSERT OR IGNORE INTO staff_credentials (username, password, user_id) VALUES (?, ?, ?)');

    insertUser.run('+41700000001', 'Omar', 'approver', null);
    const approver = db.prepare("SELECT id FROM users WHERE phone = '+41700000001'").get() as any;
    if (approver) insertCred.run('approver1', 'admin123', approver.id);

    insertUser.run('+41700000002', 'Khalid', 'driver', 'Basel');
    const driver1 = db.prepare("SELECT id FROM users WHERE phone = '+41700000002'").get() as any;
    if (driver1) insertCred.run('driver1', 'driver123', driver1.id);

    insertUser.run('+41700000003', 'Youssef', 'driver', 'Zürich');
    const driver2 = db.prepare("SELECT id FROM users WHERE phone = '+41700000003'").get() as any;
    if (driver2) insertCred.run('driver2', 'driver123', driver2.id);

    console.log('✅ Seeded staff credentials');

    // Backfill region for existing drivers
    db.prepare("UPDATE users SET region = 'Basel' WHERE phone = '+41700000002' AND region IS NULL").run();
    db.prepare("UPDATE users SET region = 'Zürich' WHERE phone = '+41700000003' AND region IS NULL").run();
  }

  // Seed admin user if not exists
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get() as any;
  if (!adminExists) {
    db.prepare('INSERT OR IGNORE INTO users (phone, name, role, region) VALUES (?, ?, ?, ?)').run('+41700000000', 'Admin', 'admin', null);
    const admin = db.prepare("SELECT id FROM users WHERE phone = '+41700000000'").get() as any;
    if (admin) {
      const adminCredExists = db.prepare("SELECT id FROM staff_credentials WHERE username = 'admin'").get() as any;
      if (!adminCredExists) {
        db.prepare('INSERT OR IGNORE INTO staff_credentials (username, password, user_id) VALUES (?, ?, ?)').run('admin', 'admin123', admin.id);
      }
    }
    console.log('✅ Seeded admin user (username: admin, password: admin123)');
  }

  // Fix: repair drivers whose region column contains a datetime (from the column-order migration bug)
  try {
    const badDrivers = db.prepare(`
      SELECT id, region, created_at FROM users
      WHERE role = 'driver' AND region IS NOT NULL AND region LIKE '____-__-__ __:__:__'
    `).all() as any[];
    if (badDrivers.length > 0) {
      for (const d of badDrivers) {
        // region has the old created_at, created_at has the old region (or null)
        const realCreatedAt = d.region;
        const realRegion = d.created_at;
        db.prepare('UPDATE users SET region = ?, created_at = ? WHERE id = ?').run(
          realRegion || null,
          realCreatedAt,
          d.id,
        );
      }
      console.log(`✅ Fixed ${badDrivers.length} drivers with swapped region/created_at`);
    }
  } catch (_e) {
    // ignore
  }

  // Ensure seeded drivers have correct region values
  db.prepare("UPDATE users SET region = 'Basel' WHERE phone = '+41700000002' AND (region IS NULL OR region LIKE '____-__-__ __:__:__')").run();
  db.prepare("UPDATE users SET region = 'Zürich' WHERE phone = '+41700000003' AND (region IS NULL OR region LIKE '____-__-__ __:__:__')").run();
}

export default db;
