import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import { initDb } from './db';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import messageRoutes from './routes/messages';
import driverRoutes from './routes/drivers';
import addressRoutes from './routes/address';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import db from './db';
import {
  sendPushToUser,
  sendPushToRole,
  haversineDistance,
  hasNotificationBeenSent,
  markNotificationSent,
} from './services/pushNotifications';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

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
    // In-app notification for approvers
    io.to('role:approver').emit('notification', {
      title: '🆕 Neue Bestellung',
      body: `${order.consumer_name || order.customer_name || 'Kunde'} hat ${order.amount_grams}g ${order.product_name} bestellt`,
    });
    // Push notification for approvers
    sendPushToRole('approver', '🆕 Neue Bestellung', `${order.consumer_name || order.customer_name || 'Kunde'} hat ${order.amount_grams}g ${order.product_name} bestellt`, {
      type: 'new_order',
      orderId: order.id,
      screen: 'approver',
    });
    // Confirm to consumer via in-app
    if (order.consumer_id) {
      io.to(`user:${order.consumer_id}`).emit('notification', {
        title: '📦 Bestellung aufgegeben',
        body: `Deine Bestellung #${order.id} wurde erfolgreich aufgegeben und wartet auf Genehmigung.`,
      });
      sendPushToUser(order.consumer_id, '📦 Bestellung aufgegeben', `Deine Bestellung #${order.id} wurde aufgegeben und wartet auf Genehmigung.`, {
        type: 'order_placed',
        orderId: order.id,
        screen: 'consumer/tracking',
      });
    }
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
        // ── Consumer notifications ──
        const statusMessages: Record<string, { title: string; body: string; pushTitle: string; pushBody: string }> = {
          approved: {
            title: `Bestellung #${data.orderId}`,
            body: '✅ Deine Bestellung wurde genehmigt!',
            pushTitle: '✅ Bestellung genehmigt',
            pushBody: `Deine Bestellung #${data.orderId} (${order.amount_grams}g ${order.product_name}) wurde genehmigt!`,
          },
          rejected: {
            title: `Bestellung #${data.orderId}`,
            body: '❌ Deine Bestellung wurde leider abgelehnt.',
            pushTitle: '❌ Bestellung abgelehnt',
            pushBody: `Deine Bestellung #${data.orderId} wurde leider abgelehnt.`,
          },
          assigned: {
            title: `Bestellung #${data.orderId}`,
            body: `🚗 Fahrer ${order.driver_name || 'wurde'} zugewiesen!`,
            pushTitle: '🚗 Fahrer zugewiesen',
            pushBody: `${order.driver_name || 'Ein Fahrer'} wurde deiner Bestellung #${data.orderId} zugewiesen!`,
          },
          delivering: {
            title: `Bestellung #${data.orderId}`,
            body: '🚗 Deine Bestellung ist unterwegs!',
            pushTitle: '🚗 Bestellung unterwegs!',
            pushBody: `Deine Bestellung #${data.orderId} ist jetzt auf dem Weg zu dir!`,
          },
          delivered: {
            title: `Bestellung #${data.orderId}`,
            body: '🎉 Deine Bestellung wurde geliefert!',
            pushTitle: '🎉 Bestellung geliefert!',
            pushBody: `Deine Bestellung #${data.orderId} wurde erfolgreich geliefert. Geniess es!`,
          },
        };

        const msg = statusMessages[data.status];
        if (msg) {
          // In-app notification
          io.to(`user:${order.consumer_id}`).emit('notification', {
            title: msg.title,
            body: msg.body,
          });
          // Push notification
          sendPushToUser(order.consumer_id, msg.pushTitle, msg.pushBody, {
            type: 'order_status',
            orderId: data.orderId,
            status: data.status,
            screen: 'consumer/tracking',
          });
        }

        // ── Driver notifications ──
        if (data.status === 'assigned' && order.driver_id) {
          // In-app notification
          io.to(`user:${order.driver_id}`).emit('notification', {
            title: '🆕 Neue Lieferung',
            body: `Bestellung #${data.orderId} zugewiesen — ${order.amount_grams}g ${order.product_name} an ${order.consumer_name || 'Kunde'}`,
          });
          io.to(`user:${order.driver_id}`).emit('order:updated', data);
          // Push notification
          sendPushToUser(order.driver_id, '🆕 Neue Lieferung zugewiesen', `Bestellung #${data.orderId}: ${order.amount_grams}g ${order.product_name} an ${order.consumer_name || 'Kunde'}`, {
            type: 'new_delivery',
            orderId: data.orderId,
            screen: 'driver',
          });
        }

        // ── Approver notifications for status changes ──
        io.to('role:approver').emit('order:updated', data);

        if (data.status === 'delivering') {
          io.to('role:approver').emit('notification', {
            title: `📦 Bestellung #${data.orderId}`,
            body: `${order.driver_name || 'Fahrer'} ist jetzt unterwegs zu ${order.consumer_name || 'Kunde'}`,
          });
          sendPushToRole('approver', '📦 Lieferung gestartet', `${order.driver_name || 'Fahrer'} liefert Bestellung #${data.orderId} an ${order.consumer_name || 'Kunde'}`, {
            type: 'delivery_started',
            orderId: data.orderId,
            screen: 'approver/active',
          });
        }

        if (data.status === 'delivered') {
          io.to('role:approver').emit('notification', {
            title: `✅ Bestellung #${data.orderId}`,
            body: `Erfolgreich an ${order.consumer_name || 'Kunde'} geliefert`,
          });
          sendPushToRole('approver', '✅ Lieferung abgeschlossen', `Bestellung #${data.orderId} erfolgreich an ${order.consumer_name || 'Kunde'} geliefert`, {
            type: 'delivery_completed',
            orderId: data.orderId,
            screen: 'approver/active',
          });
        }
      }
    } catch (e) {
      console.error('Failed to send notifications:', e);
    }
  });

  // Chat message
  socket.on('chat:message', (message: any) => {
    io.to(`order:${message.order_id}`).emit('chat:new-message', message);

    // Send push notifications for chat messages to other participants
    try {
      const order = db.prepare(`
        SELECT o.consumer_id, o.driver_id, u.name as consumer_name, d.name as driver_name
        FROM orders o
        JOIN users u ON o.consumer_id = u.id
        LEFT JOIN users d ON o.driver_id = d.id
        WHERE o.id = ?
      `).get(message.order_id) as any;

      if (order) {
        const senderName = message.sender_name || 'Jemand';
        const msgPreview = (message.text || '').substring(0, 100);
        const isStaffMessage = message.visibility === 'staff';

        // Only notify consumer if NOT a staff-only message
        if (!isStaffMessage && message.sender_id !== order.consumer_id) {
          io.to(`user:${order.consumer_id}`).emit('notification', {
            title: `💬 Nachricht zu Bestellung #${message.order_id}`,
            body: `${senderName}: ${msgPreview}`,
          });
          sendPushToUser(order.consumer_id, `💬 Neue Nachricht`, `${senderName}: ${msgPreview}`, {
            type: 'chat_message',
            orderId: message.order_id,
            screen: 'consumer/tracking',
          });
        }

        // Notify driver if assigned and sender is not the driver
        if (order.driver_id && message.sender_id !== order.driver_id) {
          io.to(`user:${order.driver_id}`).emit('notification', {
            title: `💬 Nachricht zu Bestellung #${message.order_id}`,
            body: `${senderName}: ${msgPreview}`,
          });
          sendPushToUser(order.driver_id, `💬 Neue Nachricht`, `${senderName}: ${msgPreview}`, {
            type: 'chat_message',
            orderId: message.order_id,
            screen: 'driver',
          });
        }

        // Notify approvers if sender is not an approver
        const sender = db.prepare('SELECT role FROM users WHERE id = ?').get(message.sender_id) as any;
        if (sender && sender.role !== 'approver') {
          io.to('role:approver').emit('notification', {
            title: `💬 Nachricht zu Bestellung #${message.order_id}`,
            body: `${senderName}: ${msgPreview}`,
          });
          sendPushToRole('approver', `💬 Neue Nachricht - Bestellung #${message.order_id}`, `${senderName}: ${msgPreview}`, {
            type: 'chat_message',
            orderId: message.order_id,
            screen: 'approver',
          });
        }
      }
    } catch (e) {
      console.error('Failed to send chat notifications:', e);
    }
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

    // Broadcast enriched data to all
    try {
      const driverInfo = db.prepare(`
        SELECT u.name as driver_name,
               (SELECT COUNT(*) FROM orders WHERE driver_id = u.id AND status IN ('assigned','delivering')) as active_orders
        FROM users u WHERE u.id = ?
      `).get(data.driver_id) as any;
      io.emit('driver:location-update', {
        ...data,
        driver_name: driverInfo?.driver_name || null,
        active_orders: driverInfo?.active_orders || 0,
      });
    } catch (_e) {
      io.emit('driver:location-update', data);
    }

    // ── "5 minutes away" / "arriving" notification ──
    try {
      // Find active deliveries for this driver
      const activeOrders = db.prepare(`
        SELECT o.id, o.consumer_id, o.delivery_lat, o.delivery_lng,
               u.name as consumer_name, p.name as product_name
        FROM orders o
        JOIN users u ON o.consumer_id = u.id
        JOIN products p ON o.product_id = p.id
        WHERE o.driver_id = ? AND o.status = 'delivering'
          AND o.delivery_lat IS NOT NULL AND o.delivery_lng IS NOT NULL
      `).all(data.driver_id) as any[];

      for (const order of activeOrders) {
        const distance = haversineDistance(
          data.lat, data.lng,
          order.delivery_lat, order.delivery_lng,
        );

        // ~2km ≈ roughly 5 minutes in urban driving
        if (distance <= 2.0 && !hasNotificationBeenSent(order.id, 'approaching')) {
          markNotificationSent(order.id, 'approaching');

          // In-app notification
          io.to(`user:${order.consumer_id}`).emit('notification', {
            title: '🚗💨 Fahrer kommt gleich!',
            body: `Dein Fahrer ist weniger als 5 Minuten entfernt!`,
          });
          // Push notification
          sendPushToUser(order.consumer_id, '🚗💨 Fahrer kommt gleich!', 'Dein Fahrer ist weniger als 5 Minuten entfernt! Bitte sei bereit.', {
            type: 'driver_approaching',
            orderId: order.id,
            screen: 'consumer/tracking',
          });

          // Also notify approvers
          io.to('role:approver').emit('notification', {
            title: `🚗 Bestellung #${order.id}`,
            body: `Fahrer ist fast bei ${order.consumer_name || 'Kunde'} (< 2km)`,
          });

          console.log(`📍 Driver ${data.driver_id} is ~${distance.toFixed(1)}km from delivery #${order.id}`);
        }

        // ~0.3km ≈ arrived / very close
        if (distance <= 0.3 && !hasNotificationBeenSent(order.id, 'arrived')) {
          markNotificationSent(order.id, 'arrived');

          io.to(`user:${order.consumer_id}`).emit('notification', {
            title: '📍 Fahrer ist da!',
            body: 'Dein Fahrer ist gerade angekommen!',
          });
          sendPushToUser(order.consumer_id, '📍 Fahrer ist da!', 'Dein Fahrer ist gerade bei dir angekommen!', {
            type: 'driver_arrived',
            orderId: order.id,
            screen: 'consumer/tracking',
          });
        }
      }
    } catch (e) {
      console.error('Failed to check driver proximity:', e);
    }
  });

  // Notification (manual / support messages)
  socket.on('notify', (data: { userId: number; title: string; body: string; pushData?: Record<string, any> }) => {
    io.to(`user:${data.userId}`).emit('notification', { title: data.title, body: data.body });
    // Also send as push notification
    sendPushToUser(data.userId, data.title, data.body, data.pushData || { type: 'general' });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Initialize DB and start
const PORT = process.env.PORT || 3001;
initDb().then(() => {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
    console.log(`📡 WebSocket ready`);
  });
}).catch((err) => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});
