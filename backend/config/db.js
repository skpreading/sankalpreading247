const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) {
    console.error('❌ MONGODB_URI is not set. Please add it to your .env file.');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
