const express = require('express');
const router = express.Router();
const Seat     = require('../models/Seat');
const Booking  = require('../models/Booking');
const Request  = require('../models/Request');
const Settings = require('../models/Settings');
const authAdmin = require('../middleware/auth');
const { getIO } = require('../socket');
const { addMonths } = require('../utils/dates');

// POST /api/book — student starts a booking (creates a pending Request)
router.post('/book', async (req, res) => {
  const { seatId, name, mobile, type } = req.body;
  if (!seatId || !name || !mobile) return res.status(400).json({ error: 'Missing required fields' });

  const seat = await Seat.findOne({ id: seatId });
  if (!seat || seat.status !== 'available') return res.status(400).json({ error: 'Seat not available' });

  // belt-and-braces: the booking page already hides a disabled zone, but
  // also refuse it here in case of a direct API call
  const settings = await Settings.findOne({ key: 'main' }).lean();
  if (settings) {
    if (seat.type === 'AC'     && settings.acEnabled    === false) return res.status(400).json({ error: 'AC zone is not currently available' });
    if (seat.type === 'NON_AC' && settings.nonAcEnabled === false) return res.status(400).json({ error: 'Non-AC zone is not currently available' });
  }

  const bookingId = 'BK' + Date.now();
  const request = await Request.create({ id: bookingId, seatId, seatType: seat.type, name, mobile, type, price: seat.price, status: 'pending' });
  seat.status = 'pending'; seat.studentName = name; seat.bookingId = bookingId;
  await seat.save();
  const allSeats = await Seat.find().lean();
  getIO().emit('new_request', request.toObject());
  getIO().emit('seats_updated', allSeats);
  res.json({ bookingId, request: request.toObject() });
});

// GET /api/bookings — confirmed bookings (admin only)
router.get('/bookings', authAdmin, async (req, res) => {
  const bookings = await Booking.find().sort({ confirmedAt: -1 }).lean();
  res.json(bookings);
});

// POST /api/admin/book — admin books a seat directly, free, no payment/approval
router.post('/admin/book', authAdmin, async (req, res) => {
  const { seatId, name, mobile } = req.body;
  if (!seatId || !name || !mobile) return res.status(400).json({ error: 'Missing required fields' });

  const seat = await Seat.findOne({ id: seatId });
  if (!seat) return res.status(404).json({ error: 'Seat not found' });
  if (seat.status !== 'available') return res.status(400).json({ error: 'Seat not available' });

  const bookingId = 'ADMBK' + Date.now();
  const expiresAt = addMonths(new Date(), 1);
  seat.status = 'booked'; seat.studentName = name; seat.bookingId = bookingId; seat.expiresAt = expiresAt;
  await seat.save();

  const booking = await Booking.create({
    id: bookingId, seatId: seat.id, seatType: seat.type,
    name, mobile, price: 0, status: 'approved',
    confirmedAt: new Date(), bookedByAdmin: true, expiresAt,
  });

  const allSeats = await Seat.find().lean();
  getIO().emit('seats_updated', allSeats);
  getIO().emit('booking_confirmed_' + bookingId, booking.toObject());
  res.json(booking.toObject());
});

// GET /api/my-bookings?mobile=XXXXXXXXXX — public. Lets a student look up
// their currently-active seat(s) by mobile number, so they can renew without
// admin help. Only returns seats that are still actively booked (not
// released/expired-and-reassigned) so renewal always targets a live seat.
router.get('/my-bookings', async (req, res) => {
  const mobile = (req.query.mobile || '').trim();
  if (mobile.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Enter a valid mobile number' });

  const bookings = await Booking.find({ mobile, status: 'approved' }).sort({ confirmedAt: -1 }).lean();
  const latestBySeat = new Map();
  for (const b of bookings) if (!latestBySeat.has(b.seatId)) latestBySeat.set(b.seatId, b);

  const results = [];
  for (const booking of latestBySeat.values()) {
    const seat = await Seat.findOne({ id: booking.seatId }).lean();
    // still an active seat, and this booking is genuinely the current one for it
    if (seat && seat.status === 'booked' && seat.bookingId === booking.id) {
      results.push({
        bookingId: booking.id, seatId: seat.id, seatType: seat.type,
        name: booking.name, mobile: booking.mobile, price: seat.price,
        expiresAt: booking.expiresAt,
      });
    }
  }
  res.json(results);
});

// POST /api/renew-request — public. Student starts a renewal for a seat they
// already hold (verified by matching mobile number on the seat's current
// booking). Creates a pending Request of type 'renewal' — the seat's status
// and current occupant are left untouched until admin approves/rejects it,
// exactly like the normal booking-request flow.
router.post('/renew-request', async (req, res) => {
  const { seatId, name, mobile } = req.body;
  if (!seatId || !name || !mobile) return res.status(400).json({ error: 'Missing required fields' });

  const seat = await Seat.findOne({ id: seatId });
  if (!seat || seat.status !== 'booked') return res.status(400).json({ error: 'This seat is not currently active' });

  const currentBooking = seat.bookingId ? await Booking.findOne({ id: seat.bookingId }) : null;
  if (!currentBooking || currentBooking.mobile !== mobile.trim())
    return res.status(403).json({ error: 'Mobile number does not match this seat\'s current booking' });

  // block renewal requests submitted well before the current term is up —
  // matches the "not due yet" gating shown on the booking page, but
  // enforced here too so it can't be bypassed by calling the API directly.
  if (currentBooking.expiresAt && new Date(currentBooking.expiresAt) > new Date()) {
    const expLabel = new Date(currentBooking.expiresAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    return res.status(400).json({ error: `This seat isn't due for renewal yet — valid until ${expLabel}` });
  }

  const bookingId = 'RN' + Date.now();
  const request = await Request.create({
    id: bookingId, type: 'renewal', bookingId: currentBooking.id,
    seatId, seatType: seat.type, name: name.trim(), mobile: mobile.trim(),
    price: seat.price, status: 'pending',
  });

  getIO().emit('new_request', request.toObject());
  res.json({ bookingId, request: request.toObject() });
});

// PATCH /api/bookings/:id/renew — admin only. Admin has already collected
// payment (in person, or verified a QR scan) and directly extends the seat's
// term by one month, no pending-approval step needed.
router.patch('/bookings/:id/renew', authAdmin, async (req, res) => {
  const booking = await Booking.findOne({ id: req.params.id });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const seat = await Seat.findOne({ id: booking.seatId });
  if (!seat) return res.status(404).json({ error: 'Seat not found' });

  const price = req.body.price !== undefined ? Math.max(0, Number(req.body.price)) : (seat.price ?? booking.price);
  const base = booking.expiresAt && new Date(booking.expiresAt) > new Date() ? new Date(booking.expiresAt) : new Date();
  const expiresAt = addMonths(base, 1);

  const renewal = await Booking.create({
    id: 'BK' + Date.now(), seatId: seat.id, seatType: seat.type,
    name: booking.name, mobile: booking.mobile, price, status: 'approved',
    confirmedAt: new Date(), expiresAt, renewalCount: (booking.renewalCount || 0) + 1,
    parentBookingId: booking.id,
  });

  seat.status = 'booked'; seat.bookingId = renewal.id; seat.expiresAt = expiresAt;
  await seat.save();

  const allSeats = await Seat.find().lean();
  getIO().emit('seats_updated', allSeats);
  getIO().emit('booking_renewed', renewal.toObject());
  res.json(renewal.toObject());
});

module.exports = router;
