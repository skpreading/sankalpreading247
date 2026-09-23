const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const authAdmin = require('../middleware/auth');
const { getIO } = require('../socket');

// POST /api/feedback — public; students submit grievances/complaints/suggestions.
router.post('/', async (req, res) => {
  const { name, mobile, email, category, message } = req.body;
  if (!name || !mobile || !message) return res.status(400).json({ error: 'Name, mobile and message are required' });
  const feedback = await Feedback.create({
    id: 'FB' + Date.now(), name, mobile, email: email || '',
    category: category || 'Suggestion', message,
  });
  getIO().emit('new_feedback', feedback.toObject());
  res.json({ success: true, id: feedback.id });
});

// GET /api/feedback — admin only.
router.get('/', authAdmin, async (req, res) => {
  const feedback = await Feedback.find().sort({ createdAt: -1 }).lean();
  res.json(feedback);
});

// PATCH /api/feedback/:id/read
router.patch('/:id/read', authAdmin, async (req, res) => {
  const feedback = await Feedback.findOne({ id: req.params.id });
  if (!feedback) return res.status(404).json({ error: 'Not found' });
  feedback.status = 'read';
  await feedback.save();
  getIO().emit('feedback_updated');
  res.json(feedback.toObject());
});

// DELETE /api/feedback/:id
router.delete('/:id', authAdmin, async (req, res) => {
  const result = await Feedback.deleteOne({ id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
  getIO().emit('feedback_updated');
  res.json({ success: true });
});

module.exports = router;
