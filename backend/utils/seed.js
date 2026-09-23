const bcrypt = require('bcryptjs');
const { Seat, Settings, Review, Admin, GalleryImage } = require('../models');
const { generateSeats, ensureFloorSeats } = require('./seatGenerator');

// seed seats + default settings + starter reviews if the collections are empty
async function seedDatabase() {
  // settings first, so seat prices can be seeded from the configured fees
  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) {
    settings = await Settings.create({ key: 'main' });
    console.log('🌱 Default settings created');
  }

  // one-time migration: a settings document created before acEnabled/
  // nonAcEnabled existed has neither field stored in MongoDB at all, which
  // caused the two zone toggles to behave as if coupled together. Backfill
  // both explicitly here so every existing deployment self-heals on restart,
  // without needing the admin to open Settings and hit Save first.
  let needsMigrationSave = false;
  if (settings.acEnabled === undefined)    { settings.acEnabled    = true; needsMigrationSave = true; }
  if (settings.nonAcEnabled === undefined) { settings.nonAcEnabled = true; needsMigrationSave = true; }
  if (needsMigrationSave) {
    await settings.save();
    console.log('🌱 Backfilled acEnabled/nonAcEnabled on existing settings document');
  }

  // admin credentials — seeded once from .env; after that the admin can
  // change email/password from the dashboard and this is skipped forever
  const admin = await Admin.findOne({ key: 'main' });
  if (!admin) {
    const email    = process.env.ADMIN_EMAIL    || 'admin@readspace.in';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);
    await Admin.create({ key: 'main', email, passwordHash });
    console.log(`🌱 Admin credentials seeded for ${email} (change from Admin → Settings → Account)`);
  }

  // one-time migration: every install — new or years-old — ends up with at
  // least one entry in `floors`. A brand-new install gets a single "Floor 1"
  // built from whatever acSeatFrom/acSeatTo/nonAcSeatFrom/nonAcSeatTo already
  // resolved to (the old defaults, or an admin's already-customized range).
  // From this point on, `floors` is the one and only source of truth for
  // which seats exist — the booking page only shows a floor filter once a
  // second floor is added, so a single-floor reading room notices no change.
  if (!settings.floors || settings.floors.length === 0) {
    settings.floors = [{
      id: 'floor1',
      name: 'Floor 1',
      acFrom: settings.acSeatFrom, acTo: settings.acSeatTo,
      nonAcFrom: settings.nonAcSeatFrom, nonAcTo: settings.nonAcSeatTo,
    }];
    await settings.save();
    console.log('🌱 Migrated existing seat ranges into a default "Floor 1" entry');
  }

  const seatCount = await Seat.countDocuments();
  if (seatCount === 0) {
    // first-ever seed: still uses the flat generator (slightly faster, no
    // per-floor DB lookups needed on an empty collection) but tags every
    // seat with the default floor so it's consistent with ensureFloorSeats
    const flatSeats = generateSeats(settings.acPrice, settings.nonAcPrice, settings.acSeatFrom, settings.acSeatTo, settings.nonAcSeatFrom, settings.nonAcSeatTo)
      .map(s => ({ ...s, floorId: 'floor1', floorName: 'Floor 1' }));
    await Seat.insertMany(flatSeats);
    console.log('🌱 Seats seeded into MongoDB');
  } else {
    // existing install: make sure a seat document exists for every number
    // across every floor (covers seats added via floors that predate this
    // deploy, or any admin edits made directly in the database)
    await ensureFloorSeats(settings.floors, settings.acPrice, settings.nonAcPrice);
  }

  const reviewCount = await Review.countDocuments();
  if (reviewCount === 0) {
    await Review.insertMany([
      { id: 'RV' + Date.now() + 1, name: 'Rohit Verma',    role: 'UPSC Aspirant',               text: 'ReadSpace has completely transformed my study routine. The AC zone is absolutely silent and perfect for long hours of preparation.', stars: 5, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face' },
      { id: 'RV' + Date.now() + 2, name: 'Priya Kulkarni', role: 'MBA Student, Pune University', text: 'The booking process is so smooth! I booked my seat from home, paid via QR code, and the admin confirmed it within minutes.', stars: 5, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face' },
      { id: 'RV' + Date.now() + 3, name: 'Arjun Sharma',   role: 'CA Final Candidate',           text: 'I have been a member for 8 months now. The non-AC zone is very budget-friendly and the library access alone is worth the fee.', stars: 5, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face' },
    ]);
    console.log('🌱 Starter reviews seeded (edit or remove these from the admin panel)');
  }

  // gallery — seeded once from the images that used to be hardcoded on the
  // Gallery page, so the page isn't empty on first run. From here on the
  // admin fully owns this list from Admin → Settings → Gallery.
  const galleryCount = await GalleryImage.countDocuments();
  if (galleryCount === 0) {
    const starterImages = [
      { src: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop', tag: 'AC Zone',     label: 'Main AC Reading Hall' },
      { src: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&h=500&fit=crop', tag: 'Common Area', label: 'Library Wall' },
      { src: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&h=350&fit=crop', tag: 'AC Zone',     label: 'Focused Study Area' },
      { src: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600&h=400&fit=crop', tag: 'Non-AC Zone', label: 'Non-AC Reading Room' },
      { src: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=450&fit=crop', tag: 'AC Zone',     label: 'Premium AC Zone' },
      { src: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&h=380&fit=crop', tag: 'Common Area', label: 'Group Study Lounge' },
      { src: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600&h=420&fit=crop', tag: 'Common Area', label: 'Open Bookshelves' },
      { src: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=600&h=360&fit=crop', tag: 'Non-AC Zone', label: 'Window Study Spots' },
      { src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=480&fit=crop', tag: 'Common Area', label: 'Refreshment Corner' },
      { src: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&h=400&fit=crop', tag: 'Non-AC Zone', label: 'Non-AC Quiet Zone' },
      { src: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&h=350&fit=crop', tag: 'AC Zone',     label: 'Individual Study Desk' },
      { src: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=440&fit=crop', tag: 'Common Area', label: 'Digital Resource Center' },
    ];
    await GalleryImage.insertMany(starterImages.map((item, i) => ({
      id: 'GI' + Date.now() + i,
      image: item.src,
      tag: item.tag,
      label: item.label,
      order: i,
    })));
    console.log('🌱 Starter gallery images seeded (manage these from Admin → Settings → Gallery)');
  }
}

module.exports = seedDatabase;
