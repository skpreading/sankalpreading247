const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  id:          { type: String, unique: true },
  row:         String,
  number:      Number,
  type:        { type: String, enum: ['AC', 'NON_AC'] },
  status:      { type: String, default: 'available' }, // available | pending | booked | unavailable
  price:       Number,
  studentName: { type: String, default: null },
  bookingId:   { type: String, default: null },
  expiresAt:   { type: Date,   default: null }, // mirrors the current booking's expiry for quick admin filtering
  floorId:     { type: String, default: 'floor1' },  // which Settings.floors entry this seat belongs to
  floorName:   { type: String, default: 'Floor 1' }, // denormalized so the booking page can label/filter without a join
});

module.exports = mongoose.model('Seat', seatSchema);
