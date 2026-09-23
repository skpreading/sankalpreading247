const mongoose = require('mongoose');

// Feedback — grievances / complaints / suggestions submitted by students.
// Only visible to admin.
const feedbackSchema = new mongoose.Schema({
  id:        { type: String, unique: true },
  name:      String,
  mobile:    String,
  email:     { type: String, default: '' },
  category:  { type: String, default: 'Suggestion' }, // 'Complaint' | 'Suggestion' | 'Grievance' | 'Other'
  message:   String,
  status:    { type: String, default: 'new' },        // 'new' | 'read'
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Feedback', feedbackSchema);
