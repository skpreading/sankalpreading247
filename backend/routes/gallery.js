const express = require('express');
const router = express.Router();
const GalleryImage = require('../models/GalleryImage');
const authAdmin = require('../middleware/auth');
const { getIO } = require('../socket');

async function allImages() {
  return GalleryImage.find().sort({ order: 1, createdAt: 1 }).lean();
}

// GET /api/gallery — public; the Gallery page fetches this to render the
// grid and build its category filter buttons from whatever tags exist.
router.get('/', async (req, res) => {
  res.json(await allImages());
});

// POST /api/gallery — admin only. Body: { image, tag, label }.
// image should be a base64 data URI from an <input type="file"> upload.
// tag is the category name (existing or brand new, admin's choice).
router.post('/', authAdmin, async (req, res) => {
  const { image, tag, label } = req.body;
  if (!image) return res.status(400).json({ error: 'Image is required' });
  if (!tag || !String(tag).trim()) return res.status(400).json({ error: 'Category is required' });

  const count = await GalleryImage.countDocuments();
  const doc = await GalleryImage.create({
    id: 'GI' + Date.now(),
    image,
    tag: String(tag).trim(),
    label: String(label || '').trim(),
    order: count,
  });

  const images = await allImages();
  getIO().emit('gallery_updated', images);
  res.json(doc.toObject());
});

// PATCH /api/gallery/:id — admin only. Re-categorize or re-caption an
// existing image without needing to re-upload it.
router.patch('/:id', authAdmin, async (req, res) => {
  const img = await GalleryImage.findOne({ id: req.params.id });
  if (!img) return res.status(404).json({ error: 'Image not found' });

  const { tag, label } = req.body;
  if (tag !== undefined) {
    if (!String(tag).trim()) return res.status(400).json({ error: 'Category is required' });
    img.tag = String(tag).trim();
  }
  if (label !== undefined) img.label = String(label).trim();
  await img.save();

  const images = await allImages();
  getIO().emit('gallery_updated', images);
  res.json(img.toObject());
});

// DELETE /api/gallery/:id — admin only.
router.delete('/:id', authAdmin, async (req, res) => {
  const result = await GalleryImage.deleteOne({ id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Image not found' });

  const images = await allImages();
  getIO().emit('gallery_updated', images);
  res.json({ success: true });
});

module.exports = router;
