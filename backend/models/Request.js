const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  id:        { type: String, unique: true },
  seatId:    String,
  seatType:  String,
  name:      String,
  mobile:    String,
  price:     Number,
  status:    { type: String, default: 'pending' }, // pending | approved | rejected
  createdAt: { type: Date, default: Date.now },
  type:      { type: String, default: 'new' }, // 'new' (first-time booking) | 'renewal' (continuing an existing seat)
  bookingId: { type: String, default: null },  // for renewals: the current/most-recent Booking id being renewed
});

module.exports = mongoose.model('Request', requestSchema);
