import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, 'shisha.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      role TEXT CHECK(role IN ('consumer', 'approver', 'driver')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price_per_gram REAL NOT NULL,
      image_url TEXT,
      category TEXT DEFAULT 'tobacco',
      available INTEGER DEFAULT 1
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
  `);

  // Seed products if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM products').get() as any;
  if (count.c === 0) {
    const insert = db.prepare(
      'INSERT INTO products (name, description, price_per_gram, image_url, category) VALUES (?, ?, ?, ?, ?)'
    );
    const products = [
      // Classic 🍎
      ['Al Fakher Double Apple', 'Classic double apple flavor — the most popular shisha tobacco worldwide. Rich, sweet, and aromatic.', 0.08, '🍎', 'classic'],
      ['Al Fakher Grape', 'Traditional grape flavor with rich, wine-like notes. Smooth and well-balanced classic.', 0.08, '🍇', 'classic'],
      ['Adalya The Two Apples', 'Premium double apple with enhanced flavor depth. Perfect balance of sweet and spice.', 0.09, '🍎', 'classic'],
      
      // Fruity 🍓
      ['Adalya Love 66', 'Sweet and fruity blend with passion fruit, melon, and a hint of mint. Smooth and refreshing.', 0.10, '💕', 'fruity'],
      ['Adalya Lady Killer', 'Exotic fruity cocktail with tropical notes. Sweet, vibrant, and incredibly smooth.', 0.10, '💋', 'fruity'],
      ['Holster Ice Kaktus', 'Refreshing cactus fruit with cooling finish. Unique, exotic, and perfectly balanced.', 0.09, '🌵', 'fruity'],
      ['Fumari Tangelo', 'Citrus burst with sweet tangelo flavor. Bright, zesty, and energizing experience.', 0.11, '🍊', 'fruity'],
      
      // Mint & Fresh 🌿
      ['Tangiers Cane Mint', 'Intense pure peppermint flavor. Strong buzz, bold taste. For experienced smokers.', 0.12, '🌿', 'mint'],
      ['Al Fakher Mint', 'Classic cooling mint. Clean, crisp, and refreshing with perfect menthol balance.', 0.07, '🌿', 'mint'],
      
      // Sweet & Candy 🍬
      ['Fumari White Gummy Bear', 'Sweet gummy bear candy flavor. Light, fun, and incredibly smooth clouds.', 0.11, '🐻', 'sweet'],
      ['Fumari Blueberry Muffin', 'Bakery-fresh blueberry muffin flavor. Sweet, creamy, and dessert-like experience.', 0.11, '🧁', 'sweet'],
      
      // Mix & Cocktail 🍹
      ['Starbuzz Blue Mist', 'Berry cocktail with mysterious blue flavor. Complex, layered, and captivating taste.', 0.12, '💙', 'mix'],
      ['Al Fakher Watermelon Mint', 'Perfect summer blend of juicy watermelon and cooling mint. Refreshing and balanced.', 0.08, '🍉', 'mix'],
      ['Starbuzz Pirates Cave', 'Adventurous mix of tropical fruits and spices. Bold, complex, and unforgettable.', 0.12, '🏴‍☠️', 'mix'],
      
      // Premium ⭐
      ['Darkside Supernova', 'Cosmic blend of exotic fruits and premium tobacco. Intense flavor, premium quality.', 0.14, '🌟', 'premium'],
      ['Tangiers Kashmir Peach', 'Sophisticated peach with complex undertones. Rich, bold, and distinctly premium.', 0.13, '🍑', 'premium'],
      ['Darkside Deep Dive', 'Deep ocean of flavor with mysterious blend. Premium tobacco for connoisseurs only.', 0.14, '🌊', 'premium'],
    ];
    for (const p of products) {
      insert.run(...p);
    }
    console.log('✅ Seeded 5 products');
  }

  // Seed staff users and credentials
  const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff_credentials').get() as any;
  if (staffCount.c === 0) {
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (phone, name, role) VALUES (?, ?, ?)');
    const insertCred = db.prepare('INSERT OR IGNORE INTO staff_credentials (username, password, user_id) VALUES (?, ?, ?)');

    // Approver
    insertUser.run('+41700000001', 'Omar', 'approver');
    const approver = db.prepare("SELECT id FROM users WHERE phone = '+41700000001'").get() as any;
    if (approver) insertCred.run('approver1', 'admin123', approver.id);

    // Driver 1
    insertUser.run('+41700000002', 'Khalid', 'driver');
    const driver1 = db.prepare("SELECT id FROM users WHERE phone = '+41700000002'").get() as any;
    if (driver1) insertCred.run('driver1', 'driver123', driver1.id);

    // Driver 2
    insertUser.run('+41700000003', 'Youssef', 'driver');
    const driver2 = db.prepare("SELECT id FROM users WHERE phone = '+41700000003'").get() as any;
    if (driver2) insertCred.run('driver2', 'driver123', driver2.id);

    console.log('✅ Seeded staff credentials');
  }
}

export default db;
