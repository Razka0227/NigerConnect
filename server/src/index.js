import http from 'node:http';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import { config, isProd } from './config.js';
import { prisma } from './db.js';
import { setupSocket } from './socket/index.js';
import { ok } from './utils.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import adRoutes from './routes/ads.js';
import rideRoutes from './routes/transport.js';
import paymentRoutes from './routes/payments.js';
import newsRoutes from './routes/news.js';

const app = express();
app.disable('x-powered-by');

// --- Security & perf for low-bandwidth clients ---
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression()); // gzip/br: big win on 2G/3G
// Dev: accept any origin (localhost, 127.0.0.1, IP LAN, port différent).
// Prod: restrict to the configured allowlist.
app.use(cors(isProd()
  ? { origin: config.corsOrigins.length ? config.corsOrigins : true }
  : { origin: true }));
app.use(express.json({ limit: '150kb' })); // keep payloads small

app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true }));
app.use('/api/messages', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true }));

// --- Routes ---
app.get('/health', (req, res) => ok(res, { status: 'ok', ts: new Date().toISOString() }));
app.get('/api/version', (req, res) => ok(res, { name: 'nigerconnect-api', version: '0.1.0' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/news', newsRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: { message: 'Route introuvable' } });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Erreur interne' : err.message;
  res.status(status).json({ ok: false, error: { message } });
});

const server = http.createServer(app);
const io = setupSocket(server);
app.set('io', io);

server.listen(config.port, config.host, () => {
  console.log(`[NigerConnect] API + Socket.IO on http://${config.host}:${config.port}`);
});

const shutdown = async (signal) => {
  console.log(`[NigerConnect] ${signal} – arrêt propre`);
  io.close();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server, io };
