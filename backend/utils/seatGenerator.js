const Seat = require('../models/Seat');

// Used only to seed MongoDB on first run. Prices come from Settings so the
// admin's fee-customization values (if already set) are honored on seed too.
// Both AC and Non-AC seats are simple sequential number ranges (from..to) —
// no fixed floor-plan layout, no row letters, no upper limit.
function generateSeats(acPrice = 1499, nonAcPrice = 900, acFrom = 1, acTo = 60, nonAcFrom = 1, nonAcTo = 90) {
  const seats = [];
  // AC seats — simple numbered range, admin sets the "from" and "to"
  for (let n = acFrom; n <= acTo; n++) {
    seats.push({ id: `AC${n}`, number: n, type: 'AC', status: 'available', price: acPrice, studentName: null, bookingId: null });
  }
  // Non-AC seats — simple numbered range, admin sets the "from" and "to"
  for (let n = nonAcFrom; n <= nonAcTo; n++) {
    seats.push({ id: `NAC${n}`, number: n, type: 'NON_AC', status: 'available', price: nonAcPrice, studentName: null, bookingId: null });
  }
  return seats;
}

// Make sure a Seat document exists for every seat number in the admin-set
// acFrom..acTo range. Existing seats (and their booking status) are left
// untouched — this only ever ADDS missing seat documents, never deletes
// any, so shrinking the range and growing it back later never loses data.
async function ensureAcSeats(acFrom, acTo, acPrice = 1499) {
  const wanted = [];
  for (let n = acFrom; n <= acTo; n++) {
    wanted.push({ id: `AC${n}`, number: n, type: 'AC', status: 'available', price: acPrice, studentName: null, bookingId: null });
  }
  const existingIds = new Set((await Seat.find({ type: 'AC' }, { id: 1 }).lean()).map(s => s.id));
  const missing = wanted.filter(s => !existingIds.has(s.id));
  if (missing.length) await Seat.insertMany(missing);
  return missing.length;
}

// Make sure a Seat document exists for every seat number in the admin-set
// nonAcFrom..nonAcTo range. Existing seats (and their booking status) are
// left untouched — this only ever ADDS missing seat documents, never
// deletes any, so shrinking the range and growing it back later never
// loses data.
async function ensureNonAcSeats(nonAcFrom, nonAcTo, nonAcPrice = 900) {
  const wanted = [];
  for (let n = nonAcFrom; n <= nonAcTo; n++) {
    wanted.push({ id: `NAC${n}`, number: n, type: 'NON_AC', status: 'available', price: nonAcPrice, studentName: null, bookingId: null });
  }
  const existingIds = new Set((await Seat.find({ type: 'NON_AC' }, { id: 1 }).lean()).map(s => s.id));
  const missing = wanted.filter(s => !existingIds.has(s.id));
  if (missing.length) await Seat.insertMany(missing);
  return missing.length;
}

// Floor-aware version of ensureAcSeats/ensureNonAcSeats: given the admin's
// full `floors` array (each with its own acFrom/acTo and nonAcFrom/nonAcTo),
// makes sure a Seat document exists for every seat number across every
// floor, tagged with that floor's id/name — and re-tags any seat whose
// floor was renamed or whose seat number now belongs to a different floor.
// Like the legacy functions above, this only ever ADDS seat documents, never
// deletes any, so booked seats are never lost even if a floor's range shrinks.
async function ensureFloorSeats(floors, acPrice = 1499, nonAcPrice = 900) {
  const toInsert = [];
  const existingIds = new Set((await Seat.find({}, { id: 1 }).lean()).map(s => s.id));

  for (const floor of floors || []) {
    const acFrom = Number(floor.acFrom) || 0, acTo = Number(floor.acTo) || 0;
    if (acFrom > 0 && acTo >= acFrom) {
      for (let n = acFrom; n <= acTo; n++) {
        const id = `AC${n}`;
        if (!existingIds.has(id)) {
          toInsert.push({ id, number: n, type: 'AC', status: 'available', price: acPrice, studentName: null, bookingId: null, floorId: floor.id, floorName: floor.name });
          existingIds.add(id);
        }
      }
      // keep floorId/floorName in sync for seats that already existed under this range (e.g. a rename)
      await Seat.updateMany({ type: 'AC', number: { $gte: acFrom, $lte: acTo } }, { $set: { floorId: floor.id, floorName: floor.name } });
    }

    const nonAcFrom = Number(floor.nonAcFrom) || 0, nonAcTo = Number(floor.nonAcTo) || 0;
    if (nonAcFrom > 0 && nonAcTo >= nonAcFrom) {
      for (let n = nonAcFrom; n <= nonAcTo; n++) {
        const id = `NAC${n}`;
        if (!existingIds.has(id)) {
          toInsert.push({ id, number: n, type: 'NON_AC', status: 'available', price: nonAcPrice, studentName: null, bookingId: null, floorId: floor.id, floorName: floor.name });
          existingIds.add(id);
        }
      }
      await Seat.updateMany({ type: 'NON_AC', number: { $gte: nonAcFrom, $lte: nonAcTo } }, { $set: { floorId: floor.id, floorName: floor.name } });
    }
  }

  if (toInsert.length) await Seat.insertMany(toInsert);
  return toInsert.length;
}

module.exports = { generateSeats, ensureAcSeats, ensureNonAcSeats, ensureFloorSeats };
