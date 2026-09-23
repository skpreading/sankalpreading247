const mongoose = require('mongoose');

// Reviews — posted by the admin only (genuine student reviews collected
// offline/verbally); shown on the public Home page.
const reviewSchema = new mongoose.Schema({
  id:        { type: String, unique: true },
  name:      String,
  role:      { type: String, default: '' },      // e.g. "UPSC Aspirant"
  text:      String,
  stars:     { type: Number, default: 5, min: 1, max: 5 },
  avatar:    { type: String, default: null },     // base64 data URI, or null → initials avatar
  visible:   { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Review', reviewSchema);
