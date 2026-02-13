import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE available = 1').all();
  res.json(products);
});

router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

export default router;
