const mongoose = require('mongoose');

// Gallery images — fully admin-managed. Each image belongs to a "tag"
// (category), which is just a free-text string typed by the admin — e.g.
// "AC Zone", "Non-AC Zone", "Common Area", or any custom category they add
// later (e.g. "Rooftop", "Cabin Section"). The public Gallery page builds its
// filter buttons dynamically from whatever tags currently exist, so no code
// change is ever needed to add a new category.
const galleryImageSchema = new mongoose.Schema({
  id:        { type: String, unique: true },
  image:     { type: String, required: true }, // base64 data URI (admin upload) or plain URL
  tag:       { type: String, required: true, trim: true },
  label:     { type: String, default: '' },     // optional caption shown in the lightbox
  order:     { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('GalleryImage', galleryImageSchema);
