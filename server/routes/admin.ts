import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';

const router = Router();

// ── Multer config for product image uploads ──
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `product-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ═══════════════════════════════════════════════
//  DASHBOARD / STATS
// ═══════════════════════════════════════════════

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get() as any;
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get() as any;
    const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products').get() as any;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_price), 0) as total FROM orders WHERE status = 'delivered'").get() as any;

    const ordersByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM orders GROUP BY status
    `).all();

    const usersByRole = db.prepare(`
      SELECT role, COUNT(*) as count FROM users GROUP BY role
    `).all();

    const recentOrders = db.prepare(`
      SELECT o.*, u.name as consumer_name, p.name as product_name, d.name as driver_name
      FROM orders o
      JOIN users u ON o.consumer_id = u.id
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users d ON o.driver_id = d.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `).all();

    const todayOrders = db.prepare(`
      SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = DATE('now')
    `).get() as any;

    const todayRevenue = db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as total FROM orders
      WHERE DATE(created_at) = DATE('now') AND status = 'delivered'
    `).get() as any;

    res.json({
      totalUsers: totalUsers.c,
      totalOrders: totalOrders.c,
      totalProducts: totalProducts.c,
      totalRevenue: totalRevenue.total,
      todayOrders: todayOrders.c,
      todayRevenue: todayRevenue.total,
      ordersByStatus,
      usersByRole,
      recentOrders,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  PRODUCTS CRUD
// ═══════════════════════════════════════════════

router.get('/products', (req: Request, res: Response) => {
  try {
    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.category_id) {
      conditions.push('p.category_id = ?');
      params.push(Number(req.query.category_id));
    }
    if (req.query.available !== undefined) {
      conditions.push('p.available = ?');
      params.push(Number(req.query.available));
    }
    if (req.query.search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      const term = `%${req.query.search}%`;
      params.push(term, term);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY p.id DESC';

    const products = db.prepare(sql).all(...params);
    res.json(products);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/products', (req: Request, res: Response) => {
  try {
    const { name, description, price_per_gram, image_url, category, category_id, available } = req.body;
    if (!name || price_per_gram === undefined) {
      return res.status(400).json({ error: 'name and price_per_gram are required' });
    }
    const result = db.prepare(`
      INSERT INTO products (name, description, price_per_gram, image_url, category, category_id, available)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description || null,
      price_per_gram,
      image_url || null,
      category || null,
      category_id || null,
      available !== undefined ? (available ? 1 : 0) : 1,
    );
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/products/:id', (req: Request, res: Response) => {
  try {
    const { name, description, price_per_gram, image_url, category, category_id, available } = req.body;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    db.prepare(`
      UPDATE products SET
        name = ?,
        description = ?,
        price_per_gram = ?,
        image_url = ?,
        category = ?,
        category_id = ?,
        available = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      description !== undefined ? description : existing.description,
      price_per_gram ?? existing.price_per_gram,
      image_url !== undefined ? image_url : existing.image_url,
      category !== undefined ? category : existing.category,
      category_id !== undefined ? category_id : existing.category_id,
      available !== undefined ? (available ? 1 : 0) : existing.available,
      req.params.id,
    );

    const updated = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/products/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    // Check if product has orders - soft delete instead
    const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE product_id = ?').get(req.params.id) as any;
    if (orderCount.c > 0) {
      db.prepare('UPDATE products SET available = 0 WHERE id = ?').run(req.params.id);
      res.json({ message: 'Product has orders, soft-deleted (marked unavailable)' });
    } else {
      // Delete old image file if it's a path
      if (existing.image_url && existing.image_url.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', existing.image_url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
      res.json({ message: 'Product deleted' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Product image upload
router.post('/products/:id/image', upload.single('image'), (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    // Delete old image file if it was an upload
    if (existing.image_url && existing.image_url.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', existing.image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(imageUrl, req.params.id);

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  CATEGORIES CRUD
// ═══════════════════════════════════════════════

router.get('/categories', (_req: Request, res: Response) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `).all();
    res.json(categories);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/categories', (req: Request, res: Response) => {
  try {
    const { name, display_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = db.prepare('INSERT INTO categories (name, display_order) VALUES (?, ?)').run(
      name,
      display_order ?? 0,
    );
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.put('/categories/:id', (req: Request, res: Response) => {
  try {
    const { name, display_order } = req.body;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    db.prepare('UPDATE categories SET name = ?, display_order = ? WHERE id = ?').run(
      name ?? existing.name,
      display_order !== undefined ? display_order : existing.display_order,
      req.params.id,
    );

    // Also update the legacy category text field on products
    if (name && name !== existing.name) {
      db.prepare('UPDATE products SET category = ? WHERE category_id = ?').run(name.toLowerCase(), req.params.id);
    }

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/categories/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const productCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?').get(req.params.id) as any;
    if (productCount.c > 0) {
      return res.status(409).json({ error: `Cannot delete: ${productCount.c} products use this category` });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  USERS / ACCOUNTS
// ═══════════════════════════════════════════════

router.get('/users', (req: Request, res: Response) => {
  try {
    let sql = `
      SELECT u.*,
        (SELECT COUNT(*) FROM orders WHERE consumer_id = u.id) as order_count,
        (SELECT COUNT(*) FROM orders WHERE driver_id = u.id) as delivery_count
      FROM users u
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.role) {
      conditions.push('u.role = ?');
      params.push(req.query.role);
    }
    if (req.query.search) {
      conditions.push('(u.name LIKE ? OR u.phone LIKE ?)');
      const term = `%${req.query.search}%`;
      params.push(term, term);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY u.created_at DESC';

    const users = db.prepare(sql).all(...params);
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users/:id', (req: Request, res: Response) => {
  try {
    const user = db.prepare(`
      SELECT u.*,
        (SELECT COUNT(*) FROM orders WHERE consumer_id = u.id) as order_count,
        (SELECT COUNT(*) FROM orders WHERE driver_id = u.id) as delivery_count,
        (SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE consumer_id = u.id AND status = 'delivered') as total_spent
      FROM users u WHERE u.id = ?
    `).get(req.params.id) as any;

    if (!user) return res.status(404).json({ error: 'User not found' });

    const recentOrders = db.prepare(`
      SELECT o.*, p.name as product_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.consumer_id = ? OR o.driver_id = ?
      ORDER BY o.created_at DESC
      LIMIT 20
    `).all(req.params.id, req.params.id);

    res.json({ ...user, recentOrders });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/users/:id', (req: Request, res: Response) => {
  try {
    const { name, role, region } = req.body;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET name = ?, role = ?, region = ? WHERE id = ?').run(
      name ?? existing.name,
      role ?? existing.role,
      region !== undefined ? region : existing.region,
      req.params.id,
    );

    const updated = db.prepare(`
      SELECT u.*,
        (SELECT COUNT(*) FROM orders WHERE consumer_id = u.id) as order_count,
        (SELECT COUNT(*) FROM orders WHERE driver_id = u.id) as delivery_count
      FROM users u WHERE u.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'User not found' });

    // Prevent deleting the last admin
    if (existing.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as any;
      if (adminCount.c <= 1) {
        return res.status(409).json({ error: 'Cannot delete the last admin user' });
      }
    }

    // Clean up related data
    db.prepare('DELETE FROM staff_credentials WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM push_tokens WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM driver_locations WHERE driver_id = ?').run(req.params.id);
    db.prepare('DELETE FROM messages WHERE sender_id = ?').run(req.params.id);

    // Nullify driver_id on orders instead of deleting orders
    db.prepare('UPDATE orders SET driver_id = NULL WHERE driver_id = ?').run(req.params.id);

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  DRIVERS
// ═══════════════════════════════════════════════

router.get('/drivers', (_req: Request, res: Response) => {
  try {
    const drivers = db.prepare(`
      SELECT u.*,
        dl.lat, dl.lng, dl.updated_at as location_updated_at,
        (SELECT COUNT(*) FROM orders WHERE driver_id = u.id AND status IN ('assigned','delivering')) as active_orders,
        (SELECT COUNT(*) FROM orders WHERE driver_id = u.id AND status = 'delivered') as completed_deliveries
      FROM users u
      LEFT JOIN driver_locations dl ON dl.driver_id = u.id
      WHERE u.role = 'driver'
      ORDER BY u.name ASC
    `).all();
    res.json(drivers);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/drivers/:id/region', (req: Request, res: Response) => {
  try {
    const { region } = req.body;
    const driver = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'driver'").get(req.params.id) as any;
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    db.prepare('UPDATE users SET region = ? WHERE id = ?').run(region || null, req.params.id);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  ORDERS
// ═══════════════════════════════════════════════

router.get('/orders', (req: Request, res: Response) => {
  try {
    let sql = `
      SELECT o.*, u.name as consumer_name, u.phone as consumer_phone,
        p.name as product_name, p.image_url as product_image,
        d.name as driver_name, d.region as driver_region
      FROM orders o
      JOIN users u ON o.consumer_id = u.id
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users d ON o.driver_id = d.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.status) {
      conditions.push('o.status = ?');
      params.push(req.query.status);
    }
    if (req.query.driver_id) {
      conditions.push('o.driver_id = ?');
      params.push(Number(req.query.driver_id));
    }
    if (req.query.consumer_id) {
      conditions.push('o.consumer_id = ?');
      params.push(Number(req.query.consumer_id));
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY o.created_at DESC';

    if (req.query.limit) {
      sql += ' LIMIT ?';
      params.push(Number(req.query.limit));
    }
    if (req.query.offset) {
      sql += ' OFFSET ?';
      params.push(Number(req.query.offset));
    }

    const orders = db.prepare(sql).all(...params);

    // Also return total count for pagination
    let countSql = 'SELECT COUNT(*) as c FROM orders o';
    const countParams: any[] = [];
    const countConditions: string[] = [];

    if (req.query.status) {
      countConditions.push('o.status = ?');
      countParams.push(req.query.status);
    }
    if (req.query.driver_id) {
      countConditions.push('o.driver_id = ?');
      countParams.push(Number(req.query.driver_id));
    }
    if (req.query.consumer_id) {
      countConditions.push('o.consumer_id = ?');
      countParams.push(Number(req.query.consumer_id));
    }

    if (countConditions.length > 0) {
      countSql += ' WHERE ' + countConditions.join(' AND ');
    }

    const total = db.prepare(countSql).get(...countParams) as any;

    res.json({ orders, total: total.c });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
