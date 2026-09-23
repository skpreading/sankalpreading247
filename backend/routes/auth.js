const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const Admin = require('../models/Admin');
const Seat = require('../models/Seat');
const Settings = require('../models/Settings');
const authAdmin = require('../middleware/auth');
const { getIO } = require('../socket');
const resetAllData = require('../utils/reset');
const { sendPasswordResetEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'readspace_jwt_secret';
// FRONTEND_URL may be a comma-separated list (see server.js) — the reset
// link only needs one working origin, so just take the first.
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

// POST /api/admin/login — checks against the DB-stored Admin record (seeded
// once from .env, then fully controlled from the dashboard afterwards).
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ key: 'main' });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const emailMatches    = String(username || '').trim().toLowerCase() === admin.email.toLowerCase();
    const passwordMatches = emailMatches && await bcrypt.compare(String(password || ''), admin.passwordHash);

    if (!emailMatches || !passwordMatches) return res.status(401).json({ error: 'Invalid credentials' });

    // session hard-expires 10 minutes after login, no matter how active the
    // admin is — this is intentionally an absolute cap, not a sliding/idle
    // timeout, since an admin dashboard with booking/payment data shouldn't
    // stay unlocked indefinitely on a shared or unattended computer
    const token = jwt.sign({ role: 'admin', email: admin.email }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ token, success: true, expiresIn: '10m', expiresAt: Date.now() + 10 * 60 * 1000 });
  } catch (e) {
    res.status(500).json({ error: 'Login failed, please try again' });
  }
});

// POST /api/admin/forgot-password — public. Body: { email }.
// Tells the admin directly if the email isn't registered — this is a
// single-admin app (not a multi-tenant service), so there's no meaningful
// user-enumeration risk here, and clear feedback is more useful than the
// generic "if this email is registered…" wording.
router.post('/admin/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim()) return res.status(400).json({ error: 'Email is required' });

  try {
    const admin = await Admin.findOne({ key: 'main' });
    if (!admin || admin.email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return res.status(404).json({ error: 'This email is not registered as the admin email' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    admin.resetTokenHash   = await bcrypt.hash(rawToken, 10);
    admin.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // valid for 1 hour
    await admin.save();

    const settings = await Settings.findOne({ key: 'main' });
    const resetUrl = `${FRONTEND_URL}/admin/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail({ to: admin.email, resetUrl, companyName: settings?.companyName });

    res.json({ success: true, message: 'A password reset link has been sent to your email.' });
  } catch (e) {
    console.error('forgot-password error:', e.message);
    res.status(500).json({ error: 'Could not send the reset email — please check the server\'s email configuration' });
  }
});

// POST /api/admin/reset-password — public. Body: { token, newPassword }.
// The token is the raw value emailed to the admin; we only ever stored its
// bcrypt hash, so this compares like a password check.
router.post('/admin/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Reset token and new password are required' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  try {
    const admin = await Admin.findOne({ key: 'main' });
    if (!admin || !admin.resetTokenHash || !admin.resetTokenExpiry || admin.resetTokenExpiry < new Date()) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }

    const validToken = await bcrypt.compare(String(token), admin.resetTokenHash);
    if (!validToken) return res.status(400).json({ error: 'This reset link is invalid or has expired' });

    admin.passwordHash     = await bcrypt.hash(String(newPassword), 10);
    admin.resetTokenHash   = null;
    admin.resetTokenExpiry = null;
    await admin.save();

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Could not reset password, please try again' });
  }
});

// PATCH /api/admin/credentials — admin only. Lets the logged-in admin
// change their login email/username and/or password. The CURRENT password
// is always required, even though the request is already authenticated —
// this stops someone from hijacking an unattended, still-logged-in tab.
// Body: { currentPassword, newEmail?, newPassword? }
router.patch('/admin/credentials', authAdmin, async (req, res) => {
  const { currentPassword, newEmail, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });

  try {
    const admin = await Admin.findOne({ key: 'main' });
    if (!admin) return res.status(404).json({ error: 'Admin account not found' });

    const ok = await bcrypt.compare(String(currentPassword), admin.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    if (newEmail !== undefined && String(newEmail).trim()) {
      admin.email = String(newEmail).trim().toLowerCase();
    }
    if (newPassword !== undefined && String(newPassword).trim()) {
      if (String(newPassword).length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
      admin.passwordHash = await bcrypt.hash(String(newPassword), 10);
    }

    await admin.save();
    res.json({ success: true, email: admin.email });
  } catch (e) {
    res.status(500).json({ error: 'Could not update credentials' });
  }
});

// POST /api/admin/reset-all — admin only, DESTRUCTIVE and IRREVERSIBLE.
// Wipes every booking, request, seat, review, and feedback entry, and
// resets all branding/location/pricing/payment settings back to factory
// defaults — like restoring the app to a fresh install. The admin's
// current password is required as an extra confirmation, on top of
// already being logged in, since this can't be undone.
router.post('/admin/reset-all', authAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required to confirm this reset' });

  try {
    const admin = await Admin.findOne({ key: 'main' });
    if (!admin) return res.status(404).json({ error: 'Admin account not found' });

    const ok = await bcrypt.compare(String(password), admin.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Incorrect password — reset cancelled' });

    const settings = await resetAllData();
    const seats = await Seat.find().lean();

    getIO().emit('settings_updated', settings.toObject ? settings.toObject() : settings);
    getIO().emit('seats_updated', seats);
    getIO().emit('data_reset'); // tells any connected admin dashboard to refetch bookings/requests/reviews/feedback

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Reset failed, please try again' });
  }
});

module.exports = router;
