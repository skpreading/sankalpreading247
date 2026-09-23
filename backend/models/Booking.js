const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  id:            { type: String, unique: true },
  seatId:        String,
  seatType:      String,
  name:          String,
  mobile:        String,
  price:         Number,
  status:        { type: String, default: 'pending' },
  createdAt:     { type: Date, default: Date.now },
  confirmedAt:   { type: Date, default: null },
  bookedByAdmin: { type: Boolean, default: false }, // true when admin booked the seat directly (free, no payment)
  expiresAt:       { type: Date,   default: null },  // when this month's seat term ends
  renewalCount:    { type: Number, default: 0 },      // how many times this seat has been renewed
  parentBookingId: { type: String, default: null },   // previous booking this one renewed, if any
});

module.exports = mongoose.model('Booking', bookingSchema);
