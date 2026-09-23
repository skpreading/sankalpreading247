const express = require('express');
const router = express.Router();
const Seat     = require('../models/Seat');
const Settings = require('../models/Settings');
const authAdmin = require('../middleware/auth');
const { getIO } = require('../socket');
const { ensureAcSeats, ensureNonAcSeats, ensureFloorSeats } = require('../utils/seatGenerator');

// GET /api/settings — public; the booking page needs this to know how many
// seats to show and which QR code / UPI id to display for each zone.
router.get('/', async (req, res) => {
  let settings = await Settings.findOne({ key: 'main' }).lean();
  if (!settings) settings = (await Settings.create({ key: 'main' })).toObject();
  // .lean() returns the document exactly as stored in MongoDB — a document
  // saved before acEnabled/nonAcEnabled existed simply won't have these keys
  // at all (not even `true`), so resolve them explicitly here rather than
  // ever sending `undefined` to the frontend.
  if (settings.acEnabled === undefined)    settings.acEnabled    = true;
  if (settings.nonAcEnabled === undefined) settings.nonAcEnabled = true;
  res.json(settings);
});

// PATCH /api/settings — admin only. Body may include any of: companyName,
// logoImage, city, address, contactEmail, contactPhone, contactHours,
// instagramUrl, linkedinUrl, facebookUrl, youtubeUrl, mapEmbedUrl,
// acSeatFrom, acSeatTo, nonAcSeatFrom, nonAcSeatTo, acQrImage, nonAcQrImage,
// upiId, acPrice, nonAcPrice, acEnabled, nonAcEnabled, floors.
// acEnabled/nonAcEnabled let an owner who only runs one zone hide the other
// entirely from the public site — at least one must always stay true.
// floors is the full replacement array of { id?, name, acFrom, acTo,
// nonAcFrom, nonAcTo } — every owner has at least one floor (auto-migrated
// from the old single-range fields on first run of this feature); the
// booking page only shows a floor filter once a second floor exists.
// acQrImage/nonAcQrImage/logoImage should be base64 data URIs (send `null` to clear).
// acSeatFrom/acSeatTo and nonAcSeatFrom/nonAcSeatTo define simple seat-number
// ranges — there is no upper cap, so a reading room with 500 AC seats can
// set e.g. 1 to 500, or 400 to 500 for an extension room.
router.patch('/', authAdmin, async (req, res) => {
  const { companyName, logoImage, city, address, contactEmail, contactPhone, contactHours, instagramUrl, linkedinUrl, facebookUrl, youtubeUrl, mapEmbedUrl, acSeatFrom, acSeatTo, nonAcSeatFrom, nonAcSeatTo, acQrImage, nonAcQrImage, upiId, acPrice, nonAcPrice, acEnabled, nonAcEnabled, floors } = req.body;

  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) settings = await Settings.create({ key: 'main' });

  // ── FLOORS/HALLS — validate before touching anything else ───────────
  // floors is the source of truth for every seat number that exists, so a
  // bad array here (missing name, overlapping numbers, no seats at all) has
  // to be rejected outright rather than partially applied.
  let nextFloors = null;
  if (floors !== undefined) {
    if (!Array.isArray(floors) || floors.length === 0) {
      return res.status(400).json({ error: 'At least one floor is required' });
    }
    try {
      const acRanges = [], nonAcRanges = [];
      nextFloors = floors.map((f, i) => {
        const name = String(f.name || '').trim();
        if (!name) throw new Error(`Floor ${i + 1} needs a name`);
        const acFrom = Math.max(0, Number(f.acFrom) || 0), acTo = Math.max(0, Number(f.acTo) || 0);
        const nonAcFrom = Math.max(0, Number(f.nonAcFrom) || 0), nonAcTo = Math.max(0, Number(f.nonAcTo) || 0);
        const hasAc    = acFrom > 0 && acTo >= acFrom;
        const hasNonAc = nonAcFrom > 0 && nonAcTo >= nonAcFrom;
        if (!hasAc && !hasNonAc) throw new Error(`"${name}" needs at least one valid AC or Non-AC seat range`);
        if (hasAc)    acRanges.push([acFrom, acTo, name]);
        if (hasNonAc) nonAcRanges.push([nonAcFrom, nonAcTo, name]);
        return {
          id: f.id && String(f.id).trim() ? String(f.id).trim() : 'floor' + Date.now() + i,
          name,
          acFrom: hasAc ? acFrom : 0, acTo: hasAc ? acTo : 0,
          nonAcFrom: hasNonAc ? nonAcFrom : 0, nonAcTo: hasNonAc ? nonAcTo : 0,
        };
      });
      // no two floors may claim the same seat number within the same zone —
      // that would make two different seats resolve to the same id (e.g. AC105)
      const overlaps = (ranges) => {
        const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i][0] <= sorted[i - 1][1]) return [sorted[i][2], sorted[i - 1][2]];
        }
        return null;
      };
      const acClash = overlaps(acRanges);
      if (acClash) throw new Error(`"${acClash[0]}" and "${acClash[1]}" have overlapping AC seat numbers`);
      const nonAcClash = overlaps(nonAcRanges);
      if (nonAcClash) throw new Error(`"${nonAcClash[0]}" and "${nonAcClash[1]}" have overlapping Non-AC seat numbers`);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  // at least one zone must stay enabled — a reading room can't offer nothing.
  // `!== false` (not a straight boolean check) so a legacy document where
  // this field was never saved at all (undefined) still resolves to "on",
  // instead of silently behaving as off/coupled-to-the-other-toggle.
  const nextAcEnabled    = acEnabled    !== undefined ? Boolean(acEnabled)    : settings.acEnabled    !== false;
  const nextNonAcEnabled = nonAcEnabled !== undefined ? Boolean(nonAcEnabled) : settings.nonAcEnabled !== false;
  if (!nextAcEnabled && !nextNonAcEnabled) {
    return res.status(400).json({ error: 'At least one zone (AC or Non-AC) must stay enabled' });
  }

  if (companyName !== undefined) settings.companyName = String(companyName).trim() || 'ReadSpace';
  if (logoImage !== undefined)   settings.logoImage    = logoImage;
  if (city !== undefined)          settings.city          = String(city).trim();
  if (address !== undefined)       settings.address       = String(address).trim();
  if (contactEmail !== undefined)  settings.contactEmail  = String(contactEmail).trim();
  if (contactPhone !== undefined)  settings.contactPhone  = String(contactPhone).trim();
  if (contactHours !== undefined)  settings.contactHours  = String(contactHours).trim();
  if (instagramUrl !== undefined)  settings.instagramUrl  = String(instagramUrl).trim();
  if (linkedinUrl !== undefined)   settings.linkedinUrl   = String(linkedinUrl).trim();
  if (facebookUrl !== undefined)   settings.facebookUrl   = String(facebookUrl).trim();
  if (youtubeUrl !== undefined)    settings.youtubeUrl    = String(youtubeUrl).trim();
  if (mapEmbedUrl !== undefined)   settings.mapEmbedUrl   = String(mapEmbedUrl).trim();
  if (acSeatFrom !== undefined)    settings.acSeatFrom    = Math.max(1, Number(acSeatFrom));
  if (acSeatTo !== undefined)      settings.acSeatTo      = Math.max(1, Number(acSeatTo));
  if (nonAcSeatFrom !== undefined) settings.nonAcSeatFrom = Math.max(1, Number(nonAcSeatFrom));
  if (nonAcSeatTo !== undefined)   settings.nonAcSeatTo   = Math.max(1, Number(nonAcSeatTo));
  if (acQrImage !== undefined)     settings.acQrImage     = acQrImage;
  if (nonAcQrImage !== undefined)  settings.nonAcQrImage  = nonAcQrImage;
  if (upiId !== undefined)         settings.upiId         = upiId;
  if (acPrice !== undefined)       settings.acPrice       = Math.max(0, Number(acPrice));
  if (nonAcPrice !== undefined)    settings.nonAcPrice    = Math.max(0, Number(nonAcPrice));
  // written unconditionally (unlike the fields above) so that every save
  // fully resolves and persists both flags — this is what actually backfills
  // a legacy document that never had these keys, permanently fixing the
  // "toggling one flips both" bug for good after the very first save
  settings.acEnabled    = nextAcEnabled;
  settings.nonAcEnabled = nextNonAcEnabled;
  if (nextFloors) settings.floors = nextFloors;

  // keep the ranges sane if "from" ends up above "to" after a partial update
  if (settings.acSeatFrom > settings.acSeatTo)       settings.acSeatTo    = settings.acSeatFrom;
  if (settings.nonAcSeatFrom > settings.nonAcSeatTo) settings.nonAcSeatTo = settings.nonAcSeatFrom;

  await settings.save();

  // if the AC range grew, make sure the new seats actually exist
  if (acSeatFrom !== undefined || acSeatTo !== undefined) {
    await ensureAcSeats(settings.acSeatFrom, settings.acSeatTo, settings.acPrice);
  }

  // if the Non-AC range grew, make sure the new seats actually exist
  if (nonAcSeatFrom !== undefined || nonAcSeatTo !== undefined) {
    await ensureNonAcSeats(settings.nonAcSeatFrom, settings.nonAcSeatTo, settings.nonAcPrice);
  }

  // floors changed — make sure every seat number across every floor exists,
  // tagged with its floor's id/name (never deletes a seat that a shrunk or
  // removed floor no longer covers, so no booking history is ever lost)
  if (nextFloors) await ensureFloorSeats(settings.floors, settings.acPrice, settings.nonAcPrice);

  // fee customization: push the new price onto every seat of that zone so the
  // change reflects on the public booking page without touching any code
  if (acPrice !== undefined)    await Seat.updateMany({ type: 'AC' },     { $set: { price: settings.acPrice } });
  if (nonAcPrice !== undefined) await Seat.updateMany({ type: 'NON_AC' }, { $set: { price: settings.nonAcPrice } });

  const allSeats = await Seat.find().lean();
  getIO().emit('settings_updated', settings.toObject());
  getIO().emit('seats_updated', allSeats);
  res.json(settings.toObject());
});

module.exports = router;
