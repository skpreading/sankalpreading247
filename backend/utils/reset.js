const { Seat, Booking, Request, Settings, Review, Feedback } = require('../models');
const { generateSeats } = require('./seatGenerator');

// Full factory reset — wipes every piece of business data (bookings,
// requests, seats, reviews, feedback) and every branding/settings field,
// then reseeds a brand-new default state — exactly like a freshly
// installed app. Admin LOGIN credentials are deliberately left untouched
// so the admin who triggers this doesn't get locked out of their own
// dashboard immediately afterwards.
async function resetAllData() {
  await Promise.all([
    Booking.deleteMany({}),
    Request.deleteMany({}),
    Seat.deleteMany({}),
    Review.deleteMany({}),
    Feedback.deleteMany({}),
    Settings.deleteMany({}),
  ]);

  // recreate Settings with nothing but schema defaults — fresh branding,
  // fresh contact info, fresh seat ranges/prices, no QR codes, no socials
  const settings = await Settings.create({ key: 'main' });

  await Seat.insertMany(generateSeats(
    settings.acPrice, settings.nonAcPrice,
    settings.acSeatFrom, settings.acSeatTo,
    settings.nonAcSeatFrom, settings.nonAcSeatTo,
  ));

  // same starter reviews a brand-new install seeds, so the Home page isn't empty
  await Review.insertMany([
    { id: 'RV' + Date.now() + 1, name: 'Rohit Verma',    role: 'UPSC Aspirant',               text: 'ReadSpace has completely transformed my study routine. The AC zone is absolutely silent and perfect for long hours of preparation.', stars: 5, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face' },
    { id: 'RV' + Date.now() + 2, name: 'Priya Kulkarni', role: 'MBA Student, Pune University', text: 'The booking process is so smooth! I booked my seat from home, paid via QR code, and the admin confirmed it within minutes.', stars: 5, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face' },
    { id: 'RV' + Date.now() + 3, name: 'Arjun Sharma',   role: 'CA Final Candidate',           text: 'I have been a member for 8 months now. The non-AC zone is very budget-friendly and the library access alone is worth the fee.', stars: 5, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face' },
  ]);

  return settings;
}

module.exports = resetAllData;
