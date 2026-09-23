const express = require('express');
const router = express.Router();
const Seat = require('../models/Seat');
const authAdmin = require('../middleware/auth');
const { getIO } = require('../socket');

// GET /api/seats
router.get('/', async (req, res) => {
  const seats = await Seat.find().lean();
  res.json(seats);
});

// PATCH /api/seats/:id/toggle — block / unblock a seat
router.patch('/:id/toggle', authAdmin, async (req, res) => {
  const seat = await Seat.findOne({ id: req.params.id });
  if (!seat) return res.status(404).json({ error: 'Seat not found' });
  seat.status = seat.status === 'available' ? 'unavailable' : 'available';
  await seat.save();
  const allSeats = await Seat.find().lean();
  getIO().emit('seats_updated', allSeats);
  res.json(seat);
});

module.exports = router;
