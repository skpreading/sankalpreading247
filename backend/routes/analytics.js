const express = require('express');
const router = express.Router();
const Seat     = require('../models/Seat');
const Booking  = require('../models/Booking');
const Request  = require('../models/Request');
const authAdmin = require('../middleware/auth');

function buildAnalytics(bookings, seats, pendingCount, allBookings) {
  const now = new Date();
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86400000);
    const dayBk = allBookings.filter(b => b.confirmedAt && new Date(b.confirmedAt).toDateString() === d.toDateString());
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), revenue: dayBk.reduce((s, b) => s + b.price, 0), count: dayBk.length };
  });
  return {
    revenue: bookings.reduce((s, b) => s + b.price, 0),
    totalSeats: seats.length,
    bookedSeats: seats.filter(s => s.status === 'booked').length,
    availableSeats: seats.filter(s => s.status === 'available').length,
    acBooked: seats.filter(s => s.type === 'AC' && s.status === 'booked').length,
    nonAcBooked: seats.filter(s => s.type === 'NON_AC' && s.status === 'booked').length,
    pendingRequests: pendingCount,
    chartData,
  };
}

// GET /api/analytics?filter=today|week|month|all
router.get('/', authAdmin, async (req, res) => {
  const { filter } = req.query;
  const now = new Date();

  let matchStage = {};
  if (filter === 'today') matchStage = { confirmedAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) } };
  else if (filter === 'week') matchStage = { confirmedAt: { $gte: new Date(now - 7 * 86400000) } };
  else if (filter === 'month') matchStage = { confirmedAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };

  const [bookings, seats, pendingRequests, allBookings] = await Promise.all([
    Booking.find(matchStage).lean(),
    Seat.find().lean(),
    Request.countDocuments({ status: 'pending' }),
    Booking.find().lean(),
  ]);
  res.json(buildAnalytics(bookings, seats, pendingRequests, allBookings));
});

module.exports = router;
