const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const authAdmin = require('../middleware/auth');
const { getIO } = require('../socket');

// GET /api/reviews — public, only visible reviews, newest first.
router.get('/reviews', async (req, res) => {
  const reviews = await Review.find({ visible: true }).sort({ createdAt: -1 }).lean();
  res.json(reviews);
});

// GET /api/admin/reviews — admin, full list including hidden ones.
router.get('/admin/reviews', authAdmin, async (req, res) => {
  const reviews = await Review.find().sort({ createdAt: -1 }).lean();
  res.json(reviews);
});

// POST /api/admin/reviews — create a review.
router.post('/admin/reviews', authAdmin, async (req, res) => {
  const { name, role, text, stars, avatar } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Name and review text are required' });
  const review = await Review.create({
    id: 'RV' + Date.now(), name, role: role || '', text,
    stars: Math.max(1, Math.min(5, Number(stars) || 5)), avatar: avatar || null,
  });
  getIO().emit('reviews_updated');
  res.json(review.toObject());
});

// PATCH /api/admin/reviews/:id — update a review.
router.patch('/admin/reviews/:id', authAdmin, async (req, res) => {
  const review = await Review.findOne({ id: req.params.id });
  if (!review) return res.status(404).json({ error: 'Review not found' });
  const { name, role, text, stars, avatar, visible } = req.body;
  if (name !== undefined)    review.name    = name;
  if (role !== undefined)    review.role    = role;
  if (text !== undefined)    review.text    = text;
  if (stars !== undefined)   review.stars   = Math.max(1, Math.min(5, Number(stars)));
  if (avatar !== undefined)  review.avatar  = avatar;
  if (visible !== undefined) review.visible = visible;
  await review.save();
  getIO().emit('reviews_updated');
  res.json(review.toObject());
});

// DELETE /api/admin/reviews/:id
router.delete('/admin/reviews/:id', authAdmin, async (req, res) => {
  const result = await Review.deleteOne({ id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Review not found' });
  getIO().emit('reviews_updated');
  res.json({ success: true });
});

module.exports = router;
