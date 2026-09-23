const mongoose = require('mongoose');

// Single-document admin credentials store. Seeded once from
// ADMIN_EMAIL/ADMIN_PASSWORD in .env (see utils/seed.js) — after that,
// whatever the admin sets from the dashboard is authoritative and the
// .env values are ignored.
const adminSchema = new mongoose.Schema({
  key:          { type: String, unique: true, default: 'main' },
  email:        { type: String, required: true },
  passwordHash: { type: String, required: true },
  resetTokenHash:   { type: String, default: null }, // bcrypt hash of the one-time reset token emailed to the admin
  resetTokenExpiry: { type: Date,   default: null },  // token is only valid for 1 hour after "Forgot Password"
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
