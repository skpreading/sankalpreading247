require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');

const connectDB     = require('./config/db');
const { initSocket } = require('./socket');
const seedDatabase  = require('./utils/seed');

const dns = require("dns");

dns.setServers([
  "1.1.1.1",
  "8.8.8.8"
]);

const mongoose = require("mongoose");

// ── ENV VARS ──────────────────────────────────────────────
const PORT         = process.env.PORT         || 5000;
// FRONTEND_URL can be a single origin or a comma-separated list, e.g.
// "https://readspace.netlify.app,https://www.readspace.in" — handy since
// Netlify gives you a *.netlify.app URL plus your own custom domain.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// .replace strips any trailing slash — "https://x.netlify.app/" and
// "https://x.netlify.app" must be treated as the same origin, since browsers
// never send a trailing slash in the Origin header but it's an easy typo to
// make when copy-pasting a URL into an env var.
const ALLOWED_ORIGINS = FRONTEND_URL.split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean);
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL   || 'admin@readspace.in';
const MONGODB_URI  = process.env.MONGODB_URI   || '';

const app = express();
const httpServer = createServer(app);

// ── CORS / SOCKET ─────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    // allow non-browser tools (curl, health checks) that send no Origin header
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '6mb' })); // higher limit so base64 QR-code / avatar images can be saved

initSocket(httpServer, ALLOWED_ORIGINS);

// ── DATABASE ──────────────────────────────────────────────
connectDB(MONGODB_URI).then(seedDatabase);

// ── ROUTES ────────────────────────────────────────────────
app.use('/api', require('./routes/auth'));           // POST /api/admin/login
app.use('/api/seats', require('./routes/seats'));    // GET /api/seats, PATCH /api/seats/:id/toggle
app.use('/api', require('./routes/bookings'));       // POST /api/book, GET /api/bookings, POST /api/admin/book
app.use('/api/requests', require('./routes/requests'));   // GET/PATCH /api/requests…
app.use('/api/settings', require('./routes/settings'));   // GET/PATCH /api/settings
app.use('/api', require('./routes/reviews'));         // GET /api/reviews, /api/admin/reviews…
app.use('/api/feedback', require('./routes/feedback'));   // POST/GET/PATCH/DELETE /api/feedback…
app.use('/api/analytics', require('./routes/analytics')); // GET /api/analytics
app.use('/api/gallery', require('./routes/gallery'));      // GET /api/gallery, admin POST/PATCH/DELETE /api/gallery/:id

// ── HEALTH CHECK ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'mongodb', time: new Date().toISOString() });
});

// ── START ─────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🚀 ReadSpace Server running on http://localhost:${PORT}`);
  console.log(`📦 Database mode : mongodb`);
  console.log(`🔐 Admin email   : ${ADMIN_EMAIL}`);
  console.log(`🌐 Frontend URL  : ${ALLOWED_ORIGINS.join(', ')}\n`);
});
