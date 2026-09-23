const express = require('express');
const router = express.Router();
const Seat     = require('../models/Seat');
const Booking  = require('../models/Booking');
const Request  = require('../models/Request');
const authAdmin = require('../middleware/auth');
const { getIO } = require('../socket');
const { addMonths } = require('../utils/dates');

// GET /api/requests
router.get('/', authAdmin, async (req, res) => {
  const requests = await Request.find().sort({ createdAt: -1 }).lean();
  res.json(requests);
});

// PATCH /api/requests/:id/approve
router.patch('/:id/approve', authAdmin, async (req, res) => {
  const request = await Request.findOne({ id: req.params.id });
  if (!request) return res.status(404).json({ error: 'Not found' });
  request.status = 'approved'; await request.save();

  // ── RENEWAL request: same seat continues, term is simply extended ──
  if (request.type === 'renewal') {
    const seat = await Seat.findOne({ id: request.seatId });
    if (!seat) return res.status(404).json({ error: 'Seat not found' });
    const prevBooking = request.bookingId ? await Booking.findOne({ id: request.bookingId }) : null;
    const base = prevBooking?.expiresAt && new Date(prevBooking.expiresAt) > new Date()
      ? new Date(prevBooking.expiresAt) : new Date();
    const expiresAt = addMonths(base, 1);

    const booking = await Booking.create({
      id: 'BK' + Date.now(), seatId: seat.id, seatType: seat.type,
      name: request.name, mobile: request.mobile, price: request.price,
      status: 'approved', confirmedAt: new Date(), expiresAt,
      renewalCount: (prevBooking?.renewalCount || 0) + 1,
      parentBookingId: prevBooking?.id || null,
    });

    seat.status = 'booked'; seat.studentName = request.name; seat.bookingId = booking.id; seat.expiresAt = expiresAt;
    await seat.save();

    const allSeats = await Seat.find().lean();
    getIO().emit('request_updated', request.toObject());
    getIO().emit('seats_updated', allSeats);
    getIO().emit('booking_confirmed_' + request.id, booking.toObject());
    return res.json(booking.toObject());
  }

  // ── NEW booking request (default flow) ──
  const seat = await Seat.findOne({ id: request.seatId });
  const expiresAt = addMonths(new Date(), 1);
  const booking = await Booking.create({ ...request.toObject(), confirmedAt: new Date(), expiresAt });
  if (seat) { seat.status = 'booked'; seat.expiresAt = expiresAt; seat.bookingId = booking.id; await seat.save(); }
  const allSeats = await Seat.find().lean();
  getIO().emit('request_updated', request.toObject());
  getIO().emit('seats_updated', allSeats);
  getIO().emit('booking_confirmed_' + request.id, booking.toObject());
  res.json(booking.toObject());
});

// PATCH /api/requests/:id/reject
router.patch('/:id/reject', authAdmin, async (req, res) => {
  const request = await Request.findOne({ id: req.params.id });
  if (!request) return res.status(404).json({ error: 'Not found' });
  request.status = 'rejected'; await request.save();

  // renewal requests never touched the seat's live status, so there's
  // nothing to roll back — the seat just stays booked as it already was.
  if (request.type !== 'renewal') {
    const seat = await Seat.findOne({ id: request.seatId });
    if (seat) { seat.status = 'available'; seat.studentName = null; seat.bookingId = null; await seat.save(); }
  }

  const allSeats = await Seat.find().lean();
  getIO().emit('request_updated', request.toObject());
  getIO().emit('seats_updated', allSeats);
  getIO().emit('booking_confirmed_' + request.id, { ...request.toObject(), status: 'rejected' });
  res.json(request.toObject());
});

module.exports = router;
