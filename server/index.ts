import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initDb } from './db';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import messageRoutes from './routes/messages';
import driverRoutes from './routes/drivers';
import db from './db';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

app.use(cors());
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/drivers', driverRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Socket.io
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join rooms based on role
  socket.on('join', ({ userId, role }: { userId: number; role: string }) => {
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);
    console.log(`👤 User ${userId} (${role}) joined rooms`);
  });

  // Join order-specific room (for chat)
  socket.on('join-order', ({ orderId }: { orderId: number }) => {
    socket.join(`order:${orderId}`);
    console.log(`💬 Socket ${socket.id} joined order:${orderId}`);
  });

  // Order created - notify approvers
  socket.on('order:created', (order: any) => {
    console.log(`📦 New order #${order.id} from consumer ${order.consumer_id}`);
    io.to('role:approver').emit('order:new', order);
    // Notify approvers
    io.to('role:approver').emit('notification', {
      title: '🆕 New Order',
      body: `${order.consumer_name || 'Customer'} ordered ${order.amount_grams}g of ${order.product_name}`,
    });
  });

  // Order status update
  socket.on('order:status', (data: { orderId: number; status: string; order?: any }) => {
    console.log(`📋 Order #${data.orderId} → ${data.status}`);
    io.emit('order:updated', data);
    io.emit('order:status-changed', data);

    // Fetch full order to get consumer_id and driver_id
    try {
      const order = db.prepare(`
        SELECT o.*, u.name as consumer_name, p.name as product_name, d.name as driver_name
        FROM orders o
        JOIN users u ON o.consumer_id = u.id
        JOIN products p ON o.product_id = p.id
        LEFT JOIN users d ON o.driver_id = d.id
        WHERE o.id = ?
      `).get(data.orderId) as any;

      if (order) {
        // Notify consumer
        const statusMessages: Record<string, string> = {
          approved: '✅ Your order has been approved!',
          rejected: '❌ Your order was rejected.',
          assigned: `🚗 A driver (${order.driver_name || 'Driver'}) has been assigned!`,
          delivering: '🚗 Your order is on its way!',
          delivered: '🎉 Your order has been delivered!',
        };

        if (statusMessages[data.status]) {
          io.to(`user:${order.consumer_id}`).emit('notification', {
            title: `Order #${data.orderId}`,
            body: statusMessages[data.status],
          });
        }

        // Notify driver when assigned
        if (data.status === 'assigned' && order.driver_id) {
          io.to(`user:${order.driver_id}`).emit('notification', {
            title: '🆕 New Delivery',
            body: `You've been assigned order #${data.orderId} — ${order.amount_grams}g ${order.product_name}`,
          });
          io.to(`user:${order.driver_id}`).emit('order:updated', data);
        }

        // Notify approvers
        io.to('role:approver').emit('order:updated', data);
      }
    } catch (e) {
      console.error('Failed to send notifications:', e);
    }
  });

  // Chat message
  socket.on('chat:message', (message: any) => {
    io.to(`order:${message.order_id}`).emit('chat:new-message', message);
  });

  // Driver location update
  socket.on('driver:location', (data: { driver_id: number; lat: number; lng: number }) => {
    try {
      db.prepare(`
        INSERT INTO driver_locations (driver_id, lat, lng, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(driver_id) DO UPDATE SET lat = ?, lng = ?, updated_at = CURRENT_TIMESTAMP
      `).run(data.driver_id, data.lat, data.lng, data.lat, data.lng);
    } catch (e) {
      console.error('Failed to save driver location:', e);
    }

    // Broadcast to all
    io.emit('driver:location-update', data);
  });

  // Notification
  socket.on('notify', (data: { userId: number; title: string; body: string }) => {
    io.to(`user:${data.userId}`).emit('notification', { title: data.title, body: data.body });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Initialize DB and start
initDb();
const PORT = process.env.PORT || 3001;
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket ready`);
});
