import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import { jsPDF } from 'jspdf';
import { BrandMark } from '../context/BrandingContext.jsx';

import { API_URL, SOCKET_URL } from '../config.js';

// Both AC and Non-AC seats are simple numbered ranges — no fixed floor
// plan, no upper limit. The admin sets acSeatFrom/acSeatTo and
// nonAcSeatFrom/nonAcSeatTo (e.g. 1–200, or 400–500 for an extension room)
// and that many seats are shown here, laid out in a simple grid.
const AC_SEATS_PER_ROW    = 10;
const NONAC_SEATS_PER_ROW = 10;

const DEFAULT_SETTINGS = {
  companyName: 'ReadSpace', logoImage: null,
  city: 'Chh Sambhajinagar', address: 'Ajab Nagar, Chh. Sambhajinagar, Maharashtra 431001',
  contactEmail: 'info@readspace.in', contactPhone: '+91 98765 43210', contactHours: 'Mon–Sat: 6:00 AM – 11:00 PM',
  acSeatFrom: 1, acSeatTo: 60, nonAcSeatFrom: 1, nonAcSeatTo: 90,
  acQrImage: null, nonAcQrImage: null, upiId: 'readspace@upi',
  acPrice: 1499, nonAcPrice: 900,
  acEnabled: true, nonAcEnabled: true,
  floors: [{ id: 'floor1', name: 'Floor 1', acFrom: 1, acTo: 60, nonAcFrom: 1, nonAcTo: 90 }],
};

function makeLocalSeats(settings) {
  const s = [];
  const acFrom = settings.acSeatFrom ?? 1;
  const acTo   = settings.acSeatTo   ?? 60;
  for (let n = acFrom; n <= acTo; n++)
    s.push({ id:`AC${n}`, number:n, type:'AC', status:'available', price:settings.acPrice });
  const from = settings.nonAcSeatFrom ?? 1;
  const to   = settings.nonAcSeatTo   ?? 90;
  for (let n = from; n <= to; n++)
    s.push({ id:`NAC${n}`, number:n, type:'NON_AC', status:'available', price:settings.nonAcPrice });
  return s;
}

// Generates and downloads a clean, printable PDF invoice for a confirmed
// booking or renewal — brand header (logo if the admin uploaded one),
// invoice number, booking date/time, student details, seat/zone, expiry
// date, and amount paid, with the reading room's contact details footer.
function downloadInvoicePDF(booking, settings) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  let y;

  // ── header band ──
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth, 92, 'F');

  let titleX = margin;
  if (settings.logoImage) {
    try {
      const fmt = settings.logoImage.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(settings.logoImage, fmt, margin, 21, 50, 50);
      titleX = margin + 62;
    } catch (e) { /* if the stored image can't be decoded, just skip it */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(20);
  doc.text(settings.companyName || 'ReadSpace', titleX, 47);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.text(settings.city || '', titleX, 64);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(13);
  doc.text('INVOICE', pageWidth - margin, 44, { align: 'right' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`#${booking.id || '-'}`, pageWidth - margin, 60, { align: 'right' });

  // ── date / time ──
  y = 122;
  const bookedOn = booking.confirmedAt ? new Date(booking.confirmedAt) : new Date();
  const dateStr = bookedOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = bookedOn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(10);
  doc.text(`Date: ${dateStr}`, margin, y);
  doc.text(`Time: ${timeStr}`, pageWidth - margin, y, { align: 'right' });

  y += 22;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 30;

  // ── bill to ──
  doc.setTextColor(30, 41, 59);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.text('Bill To', margin, y);
  y += 18;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(12);
  doc.text(booking.name || '-', margin, y);
  y += 17;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Mobile: ${booking.mobile || '-'}`, margin, y);
  y += 36;

  // ── line items ──
  const seatLabel = `${booking.seatType === 'AC' ? 'AC' : 'Non-AC'} #${String(booking.seatId || '').replace(/^AC|^NAC/, '')}`;
  const expiry = booking.expiresAt ? new Date(booking.expiresAt) : null;
  const rows = [
    ['Seat', seatLabel],
    ['Zone', booking.seatType === 'AC' ? '❄️ AC Zone' : '🌿 Non-AC Zone'],
    ['Booking Date', dateStr],
    ['Booking Time', timeStr],
    ['Valid Till (Expiry)', expiry ? expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'],
  ];
  doc.setFontSize(11);
  rows.forEach(([k, v]) => {
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(k, margin, y);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(String(v), pageWidth - margin, y, { align: 'right' });
    y += 24;
  });

  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 28;

  // ── total paid box ──
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 52, 8, 8, 'F');
  doc.setFont(undefined, 'bold');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(12);
  doc.text('Total Paid', margin + 18, y + 32);
  doc.setFontSize(17);
  doc.text(`Rs. ${Number(booking.price || 0).toLocaleString('en-IN')}`, pageWidth - margin - 18, y + 32, { align: 'right' });
  y += 90;

  // ── footer ──
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  const footerLines = [
    settings.address,
    [settings.contactPhone, settings.contactEmail].filter(Boolean).join('   ·   '),
    'This is a system-generated invoice and does not require a signature.',
  ].filter(Boolean);
  footerLines.forEach(line => { doc.text(line, pageWidth / 2, y, { align: 'center' }); y += 15; });

  doc.save(`Invoice-${booking.id || 'ReadSpace'}.pdf`);
}

const QR_SVG = `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<rect x="4" y="4" width="40" height="40" rx="5" fill="none" stroke="#0f172a" stroke-width="3.5"/>
<rect x="12" y="12" width="24" height="24" rx="3" fill="#0f172a"/>
<rect x="76" y="4" width="40" height="40" rx="5" fill="none" stroke="#0f172a" stroke-width="3.5"/>
<rect x="84" y="12" width="24" height="24" rx="3" fill="#0f172a"/>
<rect x="4" y="76" width="40" height="40" rx="5" fill="none" stroke="#0f172a" stroke-width="3.5"/>
<rect x="12" y="84" width="24" height="24" rx="3" fill="#0f172a"/>
<rect x="52" y="6" width="7" height="7" fill="#0f172a"/>
<rect x="61" y="6" width="7" height="7" fill="#0f172a"/>
<rect x="52" y="15" width="7" height="7" fill="#0f172a"/>
<rect x="61" y="24" width="7" height="7" fill="#0f172a"/>
<rect x="52" y="33" width="7" height="7" fill="#0f172a"/>
<rect x="52" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="61" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="70" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="6"  y="52" width="7" height="7" fill="#0f172a"/>
<rect x="15" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="24" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="33" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="52" y="61" width="7" height="7" fill="#0f172a"/>
<rect x="79" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="88" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="97" y="61" width="7" height="7" fill="#0f172a"/>
<rect x="106" y="52" width="7" height="7" fill="#0f172a"/>
<rect x="79" y="79" width="7" height="7" fill="#0f172a"/>
<rect x="88" y="88" width="7" height="7" fill="#0f172a"/>
<rect x="97" y="79" width="7" height="7" fill="#0f172a"/>
<rect x="106" y="88" width="7" height="7" fill="#0f172a"/>
<rect x="52" y="88" width="7" height="7" fill="#0f172a"/>
<rect x="61" y="97" width="7" height="7" fill="#0f172a"/>
<rect x="52" y="106" width="7" height="7" fill="#0f172a"/>
<rect x="70" y="106" width="7" height="7" fill="#0f172a"/>
<rect x="106" y="106" width="7" height="7" fill="#0f172a"/>
</svg>`;

const STEPS = ['Select Seat', 'Your Details', 'Scan & Pay', 'Confirmed'];

export default function BookPage() {
  const [step,      setStep]      = useState(0);
  const [settings,  setSettings]  = useState(DEFAULT_SETTINGS);
  const [seats,     setSeats]     = useState(makeLocalSeats(DEFAULT_SETTINGS));
  const [sel,       setSel]       = useState(null);
  const [zone,      setZone]      = useState(null);
  const [tab,       setTab]       = useState('nonac');
  const [selectedFloor, setSelectedFloor] = useState('all'); // 'all' or a floor's id
  const [form,      setForm]      = useState({ name:'', mobile:'' });
  const [bookingId, setBookingId] = useState(null);
  const [bkStatus,  setBkStatus]  = useState('pending');
  const [confirmedBooking, setConfirmedBooking] = useState(null); // full Booking object once approved — used for the invoice
  const [loading,   setLoading]   = useState(false);

  // ── Renew-your-seat modal state ──
  const [renewOpen,    setRenewOpen]    = useState(false);
  const [renewStage,   setRenewStage]   = useState('lookup'); // lookup | select | pay | done
  const [renewMobile,  setRenewMobile]  = useState('');
  const [renewOptions, setRenewOptions] = useState([]);
  const [renewSel,     setRenewSel]     = useState(null); // chosen seat option
  const [renewReqId,   setRenewReqId]   = useState(null);
  const [renewStatus,  setRenewStatus]  = useState('pending');
  const [renewBusy,    setRenewBusy]    = useState(false);
  const [renewBookingData, setRenewBookingData] = useState(null); // full Booking object once renewal is approved — used for the invoice

  useEffect(() => {
    fetch(`${API_URL}/api/seats`).then(r => r.json()).then(setSeats).catch(() => {});
    fetch(`${API_URL}/api/settings`).then(r => r.json()).then(setSettings).catch(() => {});
    const s = io(SOCKET_URL);
    s.on('seats_updated', setSeats);
    s.on('settings_updated', setSettings);
    return () => s.disconnect();
  }, []);

  // if the owner only offers one zone (or just switched off the one currently
  // shown), make sure the active tab always points at an enabled zone
  useEffect(() => {
    if (settings.nonAcEnabled === false && tab === 'nonac') setTab('ac');
    if (settings.acEnabled === false && tab === 'ac') setTab('nonac');
  }, [settings.acEnabled, settings.nonAcEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bookingId) return;
    const s = io(SOCKET_URL);
    s.on(`booking_confirmed_${bookingId}`, data => {
      setBkStatus(data.status);
      if (data.status === 'approved') { setConfirmedBooking(data); toast.success('🎉 Seat confirmed!'); setStep(3); }
      else toast.error('Booking rejected. Please try again.');
    });
    return () => s.disconnect();
  }, [bookingId]);

  const getSeat = id => seats.find(s => s.id === id);

  const selectNac = num => {
    const seat = getSeat(`NAC${num}`);
    if (!seat || seat.status !== 'available') return;
    setSel(seat); setZone('NON_AC');
  };

  const selectAc = seat => {
    if (seat.status !== 'available') return;
    setSel(seat); setZone('AC');
  };

  const handleBook = async () => {
    if (!form.name.trim()) return toast.error('Please enter your name');
    if (form.mobile.replace(/\D/g,'').length < 10) return toast.error('Enter a valid 10-digit mobile number');
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/book`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId: sel.id, name: form.name.trim(), mobile: form.mobile.trim(), type: zone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBookingId(data.bookingId);
      setStep(2);
    } catch (e) { toast.error(e.message || 'Booking failed. Try again.'); }
    setLoading(false);
  };

  const reset = () => {
    setStep(0); setSel(null); setZone(null);
    setForm({ name:'', mobile:'' }); setBookingId(null); setBkStatus('pending'); setConfirmedBooking(null);
  };

  /* ── Renew-your-seat modal handlers ── */
  const openRenew = () => {
    setRenewOpen(true); setRenewStage('lookup'); setRenewMobile('');
    setRenewOptions([]); setRenewSel(null); setRenewReqId(null); setRenewStatus('pending'); setRenewBookingData(null);
  };
  const closeRenew = () => setRenewOpen(false);

  const lookupRenew = async () => {
    if (renewMobile.replace(/\D/g,'').length < 10) return toast.error('Enter a valid 10-digit mobile number');
    setRenewBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/my-bookings?mobile=${encodeURIComponent(renewMobile.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.length) { toast.error('No active seat found for this number'); setRenewBusy(false); return; }
      setRenewOptions(data);
      setRenewStage('select');
    } catch (e) { toast.error(e.message || 'Could not look up your booking'); }
    setRenewBusy(false);
  };

  const submitRenew = async () => {
    if (!renewSel) return;
    const exp = renewSel.expiresAt ? new Date(renewSel.expiresAt) : null;
    if (exp && exp > new Date()) {
      return toast.error(`Not due for renewal yet — valid until ${exp.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`);
    }
    setRenewBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/renew-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId: renewSel.seatId, name: renewSel.name, mobile: renewSel.mobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRenewReqId(data.bookingId);
      setRenewStatus('pending');
      setRenewStage('pay');
    } catch (e) { toast.error(e.message || 'Could not start renewal'); }
    setRenewBusy(false);
  };

  useEffect(() => {
    if (!renewReqId) return;
    const s = io(SOCKET_URL);
    s.on(`booking_confirmed_${renewReqId}`, data => {
      setRenewStatus(data.status);
      if (data.status === 'approved') { setRenewBookingData(data); toast.success('🎉 Seat renewed!'); setRenewStage('done'); }
      else toast.error('Renewal rejected. Please contact admin.');
    });
    return () => s.disconnect();
  }, [renewReqId]);

  const price = sel?.price ?? (zone === 'AC' ? settings.acPrice : settings.nonAcPrice);

  // ── FLOORS — every install has at least one floor (auto-migrated on the
  // backend from the old single-range settings), so this always has entries.
  // The filter row on the booking page only appears once there's more than
  // one to choose between.
  const floorsList = (settings.floors && settings.floors.length)
    ? settings.floors
    : [{ id: 'floor1', name: 'Floor 1', acFrom: settings.acSeatFrom ?? 1, acTo: settings.acSeatTo ?? 60, nonAcFrom: settings.nonAcSeatFrom ?? 1, nonAcTo: settings.nonAcSeatTo ?? 90 }];
  const hasMultipleFloors = floorsList.length > 1;
  const getZoneNums = (zoneKey) => {
    const relevant = selectedFloor === 'all' ? floorsList : floorsList.filter(f => f.id === selectedFloor);
    const nums = [];
    relevant.forEach(f => {
      const from = zoneKey === 'AC' ? f.acFrom : f.nonAcFrom;
      const to   = zoneKey === 'AC' ? f.acTo   : f.nonAcTo;
      if (from > 0 && to >= from) for (let n = from; n <= to; n++) nums.push(n);
    });
    return [...new Set(nums)].sort((a, b) => a - b);
  };

  /* ══════════════════════════════════════════════════════
     NON-AC ROOM — simple seat grid, admin-set range(s) per floor
  ══════════════════════════════════════════════════════ */
  const NONAC_NUMS = getZoneNums('NON_AC');
  const NONAC_ROWS = [];
  for (let i = 0; i < NONAC_NUMS.length; i += NONAC_SEATS_PER_ROW)
    NONAC_ROWS.push(NONAC_NUMS.slice(i, i + NONAC_SEATS_PER_ROW));

  const NonAcRoom = () => (
    <div className="ac-wrap">
      <div className="ac-screen">📖 NOTICE BOARD — FRONT OF ROOM</div>
      {NONAC_NUMS.length === 0 && (
        <p style={{ textAlign:'center', color:'var(--text-3)', padding:'2rem 0' }}>No Non-AC seats on this floor.</p>
      )}
      {NONAC_ROWS.map((rowNums, ri) => (
        <div key={ri} className="ac-row">
          <span className="ac-lbl">{ri + 1}</span>
          {rowNums.map(num => {
            const seat = getSeat(`NAC${num}`) || { id: `NAC${num}`, status: 'available' };
            return (
              <button key={num}
                className={`ac-seat nac-seat-simple${sel?.id===seat.id?' ac-sel':seat.status==='booked'||seat.status==='pending'?' ac-booked':seat.status==='unavailable'?' ac-blocked':' nac-avail-simple'}`}
                onClick={() => selectNac(num)} title={`Seat ${num} · ${seat.status}`}>
                {num}
              </button>
            );
          })}
        </div>
      ))}
      <div className="ac-legend">
        {[['#d97706','Available'],['#10b981','Selected'],['#94a3b8','Booked'],['#f1f5f9','Blocked']].map(([c,l]) => (
          <span key={l} className="ac-leg-item">
            <span style={{ width:22, height:18, borderRadius:4, display:'inline-block', background:c }} />
            {l}
          </span>
        ))}
        <span className="ac-leg-item" style={{ marginLeft: 'auto', fontWeight: 600 }}>
          {seats.filter(s => s.type === 'NON_AC' && s.status === 'available' && NONAC_NUMS.includes(s.number)).length} / {NONAC_NUMS.length} available
        </span>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════
     AC ROOM — simple seat grid, admin-set range(s) per floor
  ══════════════════════════════════════════════════════ */
  const AC_NUMS = getZoneNums('AC');
  const AC_ROWS = [];
  for (let i = 0; i < AC_NUMS.length; i += AC_SEATS_PER_ROW)
    AC_ROWS.push(AC_NUMS.slice(i, i + AC_SEATS_PER_ROW));

  const AcRoom = () => (
    <div className="ac-wrap">
      <div className="ac-screen">🖥 WHITEBOARD / PROJECTOR — FRONT OF CLASS</div>
      {AC_NUMS.length === 0 && (
        <p style={{ textAlign:'center', color:'var(--text-3)', padding:'2rem 0' }}>No AC seats on this floor.</p>
      )}
      {AC_ROWS.map((rowNums, ri) => (
        <div key={ri} className="ac-row">
          <span className="ac-lbl">{ri + 1}</span>
          {rowNums.map(num => {
            const seat = getSeat(`AC${num}`) || { id: `AC${num}`, status: 'available' };
            return (
              <button key={num}
                className={`ac-seat${sel?.id===seat.id?' ac-sel':seat.status==='booked'||seat.status==='pending'?' ac-booked':seat.status==='unavailable'?' ac-blocked':' ac-avail'}`}
                onClick={() => selectAc(seat)} title={`Seat ${num} · ${seat.status}`}>
                {num}
              </button>
            );
          })}
        </div>
      ))}
      <div className="ac-legend">
        {[['#6366f1','Available'],['#10b981','Selected'],['#94a3b8','Booked'],['#f1f5f9','Blocked']].map(([c,l]) => (
          <span key={l} className="ac-leg-item">
            <span style={{ width:22, height:18, borderRadius:4, display:'inline-block', background:c }} />
            {l}
          </span>
        ))}
        <span className="ac-leg-item" style={{ marginLeft: 'auto', fontWeight: 600 }}>
          {seats.filter(s => s.type === 'AC' && s.status === 'available' && AC_NUMS.includes(s.number)).length} / {AC_NUMS.length} available
        </span>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <main className="page" style={{ background:'var(--lighter)' }}>
      <Helmet>
        <title>{`Book a Reading Room Seat Online — AC & Non-AC | ${settings.companyName} ${settings.city}`}</title>
        <meta name="description" content={`Book your AC or Non-AC reading room seat online in seconds. Real-time seat availability, instant UPI payment and monthly renewal — ${settings.companyName} ${settings.city}.`} />
        <meta name="keywords" content={`Sankalp Education, Sankalp Education ${settings.city}, book reading room seat online, library seat booking ${settings.city}, monthly reading room fees, AC seat booking, non AC seat booking, reading room availability`} />
        <link rel="canonical" href="https://readspace.example.com/book" />
      </Helmet>
      <div className="booking-layout">

        {/* TITLE */}
        <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
          <h2 style={{ fontSize:'clamp(1.3rem,3vw,1.9rem)', marginBottom:'.4rem' }}>
            Book Your Reading Seat
          </h2>
          <p style={{ color:'var(--text-2)', fontSize:'.9rem' }}>
            Browse the available seats and pick your spot
          </p>
          <button onClick={openRenew}
            style={{ marginTop:'.85rem', background:'none', border:'1px solid var(--border)', borderRadius:50,
                     padding:'.45rem 1.1rem', fontSize:'.82rem', fontWeight:600, color:'var(--brand)', cursor:'pointer' }}>
            🔄 Already have a seat? Renew it
          </button>
        </div>

        {/* STEP BAR */}
        <div className="bk-steps">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`bk-step ${i<step?'done':i===step?'active':'pend'}`}>
                <div className="bk-num">{i < step ? '✓' : i+1}</div>
                <span className="bk-lbl">{s}</span>
              </div>
              {i < STEPS.length-1 && <div className={`bk-line${i<step?' done':''}`} />}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 0: MAPS ── */}
          {step === 0 && (
            <motion.div key="s0"
              initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>

              {/* FLOOR FILTER — only shown once the owner has more than one
                  floor/hall configured; starts on "All Floors" so nothing
                  changes for a reading room that's never touched this */}
              {hasMultipleFloors && (
                <div className="zone-tabs" style={{ marginBottom:'1rem' }}>
                  <button
                    className={`zone-tab${selectedFloor==='all'?' zt-nonac':''}`}
                    onClick={() => { setSelectedFloor('all'); setSel(null); }}>
                    🏢 All Floors
                  </button>
                  {floorsList.map(f => (
                    <button key={f.id}
                      className={`zone-tab${selectedFloor===f.id?' zt-ac':''}`}
                      onClick={() => { setSelectedFloor(f.id); setSel(null); }}>
                      {f.name}
                    </button>
                  ))}
                </div>
              )}

              {/* ZONE TABS — hidden entirely when the owner only offers one zone,
                  since there's nothing to switch between */}
              {settings.acEnabled !== false && settings.nonAcEnabled !== false && (
                <div className="zone-tabs">
                  <button
                    className={`zone-tab${tab==='nonac'?' zt-nonac':''}`}
                    onClick={() => { setTab('nonac'); setSel(null); }}>
                    🌿 Non-AC Zone <span className="zt-price">₹{settings.nonAcPrice?.toLocaleString()}/mo</span>
                  </button>
                  <button
                    className={`zone-tab${tab==='ac'?' zt-ac':''}`}
                    onClick={() => { setTab('ac'); setSel(null); }}>
                    ❄️ AC Zone <span className="zt-price">₹{settings.acPrice?.toLocaleString()}/mo</span>
                  </button>
                </div>
              )}

              {/* SEAT MAP */}
              <AnimatePresence mode="wait">
                {tab === 'nonac'
                  ? <motion.div key="nm" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}><NonAcRoom /></motion.div>
                  : <motion.div key="am" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}><AcRoom /></motion.div>
                }
              </AnimatePresence>

              {/* SELECTED SEAT STRIP */}
              <AnimatePresence>
                {sel && (
                  <motion.div className="sel-strip"
                    style={{ borderColor: zone==='AC'?'var(--brand)':'var(--accent)' }}
                    initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                    <div>
                      <div className="sel-title">
                        ✅ {zone==='AC' ? `AC Seat #${sel.number}` : `Non-AC Seat #${sel.number}`} selected
                      </div>
                      <div className="sel-sub">
                        {zone==='AC'
                          ? `❄️ AC Zone — ₹${(sel?.price ?? settings.acPrice)?.toLocaleString()}/month`
                          : `🌿 Non-AC Zone — ₹${(sel?.price ?? settings.nonAcPrice)?.toLocaleString()}/month`}
                      </div>
                    </div>
                    <button className="btn btn-primary"
                      style={{ background: zone==='AC'?'var(--brand)':'var(--accent)', flexShrink:0 }}
                      onClick={() => setStep(1)}>
                      Continue →
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── STEP 1: DETAILS ── */}
          {step === 1 && (
            <motion.div key="s1"
              initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}
              className="step-card-wrap">
              <div className="step-card">
                <div className="step-card-head">
                  <h3>Your Details</h3>
                  <span className="seat-badge"
                    style={{ background:zone==='AC'?'var(--ac-bg)':'var(--nonac-bg)',
                             color:zone==='AC'?'var(--ac-color)':'var(--nonac-color)' }}>
                    {zone==='AC' ? `AC #${sel?.number}` : `Non-AC #${sel?.number}`}
                  </span>
                </div>

                <div className="zone-confirm-card"
                  style={{ background:zone==='AC'?'#eef2ff':'#fffbeb',
                           borderColor:zone==='AC'?'#c7d2fe':'#fde68a' }}>
                  <span style={{ fontSize:'1.8rem' }}>{zone==='AC'?'❄️':'🌿'}</span>
                  <div>
                    <div style={{ fontWeight:700, color:zone==='AC'?'var(--brand)':'var(--accent)', fontSize:'.9rem' }}>
                      {zone==='AC'?'AC Zone — Air Conditioned':'Non-AC Zone — Natural Ventilation'}
                    </div>
                    <div style={{ fontSize:'.8rem', color:'var(--text-2)', marginTop:'.1rem' }}>
                      Seat #{sel?.number} · ₹{price.toLocaleString()}/month
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input required placeholder="Enter your full name"
                    value={form.name} onChange={e => setForm({...form, name:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input required placeholder="+91 XXXXX XXXXX"
                    value={form.mobile} onChange={e => setForm({...form, mobile:e.target.value})} />
                </div>

                <div style={{ display:'flex', gap:'.75rem', marginTop:'.25rem' }}>
                  <button className="btn btn-secondary" onClick={() => setStep(0)}>← Back</button>
                  <button className="btn btn-primary"
                    style={{ flex:1, background:zone==='AC'?'var(--brand)':'var(--accent)' }}
                    onClick={handleBook} disabled={loading}>
                    {loading ? '⏳ Processing…' : 'Proceed to Payment →'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: QR ── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity:0, scale:.96 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}>
              <div className="qr-card">
                <p style={{ fontSize:'.78rem', color:'var(--text-3)', marginBottom:'.2rem' }}>Booking Reference</p>
                <div style={{ fontFamily:'monospace', fontWeight:700, color:'var(--brand)', fontSize:'.9rem', marginBottom:'.6rem' }}>{bookingId}</div>
                <h3 style={{ fontSize:'1.05rem', marginBottom:'.2rem' }}>Scan &amp; Pay to Confirm</h3>
                <p style={{ fontSize:'.8rem', color:'var(--text-2)', marginBottom:'.4rem' }}>
                  {zone==='AC' ? `AC Seat #${sel?.number}` : `Non-AC Seat #${sel?.number}`} · {form.name}
                </p>
                <div className="qr-amount">₹{price.toLocaleString()}</div>
                {(() => {
                  const zoneQr = zone === 'AC' ? settings.acQrImage : settings.nonAcQrImage;
                  return zoneQr
                    ? <div className="qr-image-wrap pulse-ring"><img src={zoneQr} alt={`${zone==='AC'?'AC':'Non-AC'} zone payment QR`} style={{ width:120, height:120, objectFit:'contain' }} /></div>
                    : <div className="qr-image-wrap pulse-ring" dangerouslySetInnerHTML={{ __html: QR_SVG }} />;
                })()}
                <div className="qr-upi-icons">
                  {['GPay','PhonePe','Paytm','BHIM UPI'].map(u => <span key={u} className="upi-badge">{u}</span>)}
                </div>
                <p style={{ fontSize:'.75rem', color:'var(--text-3)', margin:'.35rem 0' }}>
                  UPI ID: <strong>{settings.upiId}</strong>
                </p>
                <div className="wait-status"><div className="spinner" />Waiting for admin verification…</div>
                <p style={{ fontSize:'.75rem', color:'var(--text-3)', marginTop:'.6rem', lineHeight:1.6, maxWidth:260, textAlign:'center' }}>
                  Admin will verify your payment and confirm your seat in a few minutes.
                </p>
                {bkStatus === 'rejected' && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ marginTop:'1rem', width:'100%' }}>
                    <div style={{ background:'#fee2e2', borderRadius:8, padding:'.7rem', marginBottom:'.6rem', fontSize:'.83rem', color:'#991b1b', textAlign:'center' }}>
                      ❌ Booking rejected. Please try a different seat.
                    </div>
                    <button className="btn btn-primary" style={{ width:'100%' }} onClick={reset}>Try Again</button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: CONFIRMED ── */}
          {step === 3 && (
            <motion.div key="s3"
              initial={{ opacity:0, scale:.88 }} animate={{ opacity:1, scale:1 }}
              transition={{ type:'spring', stiffness:180 }}>
              <div className="success-card">
                <motion.div className="success-icon"
                  animate={{ scale:[1,1.2,1] }} transition={{ duration:.6, delay:.3 }}>🎉</motion.div>
                <h2>Seat Confirmed!</h2>
                <p>Admin has verified your payment. Here's your invoice.</p>

                {/* INVOICE */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:10, padding:'1.25rem', marginBottom:'1.1rem', textAlign:'left' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:'.9rem', marginBottom:'.75rem', borderBottom:'1px dashed var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                      <span style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center' }}><BrandMark size="100%" /></span>
                      <div>
                        <div style={{ fontWeight:800, fontSize:'1rem' }}>{settings.companyName}</div>
                        <div style={{ fontSize:'.72rem', color:'var(--text-3)' }}>{settings.city}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'.72rem', color:'var(--text-3)' }}>Invoice No.</div>
                      <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:'.8rem', color:'var(--brand)' }}>{confirmedBooking?.id || bookingId}</div>
                    </div>
                  </div>
                  {[
                    ['Student',     confirmedBooking?.name || form.name],
                    ['Mobile',      confirmedBooking?.mobile || form.mobile],
                    ['Seat',        zone==='AC' ? `AC #${sel?.number}` : `Non-AC #${sel?.number}`],
                    ['Zone',        zone==='AC' ? '❄️ AC Zone' : '🌿 Non-AC Zone'],
                    ['Booked On',   confirmedBooking?.confirmedAt ? new Date(confirmedBooking.confirmedAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'],
                    ['Valid Till',  confirmedBooking?.expiresAt ? new Date(confirmedBooking.expiresAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'],
                    ['Amount Paid', `₹${price.toLocaleString()}`],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'.35rem 0', fontSize:'.87rem' }}>
                      <span style={{ color:'var(--text-2)' }}>{k}</span><strong>{v}</strong>
                    </div>
                  ))}
                </div>

                <button className="btn btn-secondary" style={{ width:'100%', marginBottom:'.6rem' }}
                  onClick={() => downloadInvoicePDF(
                    confirmedBooking || { id: bookingId, name: form.name, mobile: form.mobile, seatId: sel?.id, seatType: zone, price, confirmedAt: new Date(), expiresAt: null },
                    settings
                  )}>
                  ⬇️ Download Invoice (PDF)
                </button>

                <button className="btn btn-primary" style={{ width:'100%' }} onClick={reset}>
                  Book Another Seat
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── RENEW-YOUR-SEAT MODAL ── */}
      <AnimatePresence>
        {renewOpen && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem' }}
            onClick={closeRenew}
          >
            <motion.div
              initial={{ opacity:0, scale:.94, y:10 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:.94 }}
              style={{ background:'var(--white)', borderRadius:'var(--radius)', padding:'1.75rem', width:400, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {renewStage === 'lookup' && (<>
                <h3 style={{ fontSize:'1.1rem', marginBottom:'.35rem' }}>🔄 Renew Your Seat</h3>
                <p style={{ fontSize:'.82rem', color:'var(--text-2)', marginBottom:'1.1rem' }}>
                  Enter the mobile number your seat is booked under to continue for another month.
                </p>
                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input required placeholder="+91 XXXXX XXXXX" value={renewMobile}
                    onChange={e=>setRenewMobile(e.target.value)} />
                </div>
                <div style={{ display:'flex', gap:'.6rem', marginTop:'1rem' }}>
                  <button className="btn btn-secondary" style={{ flex:1 }} onClick={closeRenew}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex:1 }} disabled={renewBusy} onClick={lookupRenew}>
                    {renewBusy ? 'Searching…' : 'Find My Seat'}
                  </button>
                </div>
              </>)}

              {renewStage === 'select' && (<>
                <h3 style={{ fontSize:'1.1rem', marginBottom:'.35rem' }}>Select a Seat to Renew</h3>
                <p style={{ fontSize:'.82rem', color:'var(--text-2)', marginBottom:'1.1rem' }}>
                  Found {renewOptions.length} active seat{renewOptions.length>1?'s':''} for this number.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'.6rem', marginBottom:'1rem' }}>
                  {renewOptions.map(opt => {
                    const exp = opt.expiresAt ? new Date(opt.expiresAt) : null;
                    const expLabel = exp ? exp.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : 'Unknown';
                    const isSel = renewSel?.seatId === opt.seatId;
                    const isDue = !exp || exp <= new Date(); // no expiry recorded, or already past it → renewal allowed
                    return (
                      <button key={opt.seatId} onClick={()=>setRenewSel(opt)}
                        style={{ textAlign:'left', border: isSel ? '2px solid var(--brand)' : '1px solid var(--border)',
                                 borderRadius:8, padding:'.75rem 1rem', background: isSel ? '#eef2ff' : 'var(--white)', cursor:'pointer' }}>
                        <div style={{ fontWeight:700, fontSize:'.92rem' }}>
                          {opt.seatType==='AC' ? `❄️ AC Seat #${opt.seatId.replace('AC','')}` : `🌿 Non-AC Seat #${opt.seatId.replace('NAC','')}`}
                        </div>
                        <div style={{ fontSize:'.78rem', color: isDue ? 'var(--text-2)' : '#b45309', marginTop:'.2rem', fontWeight: isDue ? 400 : 600 }}>
                          ₹{opt.price?.toLocaleString()}/month · {isDue ? `Expires ${expLabel}` : `Not due yet — expires ${expLabel}`}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {renewSel && (() => {
                  const exp = renewSel.expiresAt ? new Date(renewSel.expiresAt) : null;
                  const isDue = !exp || exp <= new Date();
                  if (isDue) return null;
                  const expLabel = exp.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
                  return (
                    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'.85rem 1rem', marginBottom:'1rem', fontSize:'.82rem', color:'#92400e', lineHeight:1.5 }}>
                      🔒 This seat isn't due for renewal yet — it's valid until <strong>{expLabel}</strong>. You can come back and renew closer to that date.
                    </div>
                  );
                })()}

                <div style={{ display:'flex', gap:'.6rem' }}>
                  <button className="btn btn-secondary" style={{ flex:1 }} onClick={()=>setRenewStage('lookup')}>← Back</button>
                  <button className="btn btn-primary" style={{ flex:1 }}
                    disabled={!renewSel || renewBusy || !(!renewSel.expiresAt || new Date(renewSel.expiresAt) <= new Date())}
                    onClick={submitRenew}>
                    {renewBusy ? 'Submitting…' : 'Continue →'}
                  </button>
                </div>
              </>)}

              {renewStage === 'pay' && renewSel && (<>
                <h3 style={{ fontSize:'1.1rem', marginBottom:'.2rem' }}>Scan &amp; Pay to Renew</h3>
                <p style={{ fontSize:'.8rem', color:'var(--text-2)', marginBottom:'.6rem' }}>
                  {renewSel.seatType==='AC' ? `AC Seat #${renewSel.seatId.replace('AC','')}` : `Non-AC Seat #${renewSel.seatId.replace('NAC','')}`} · {renewSel.name}
                </p>
                <div className="qr-amount">₹{renewSel.price?.toLocaleString()}</div>
                {(() => {
                  const zoneQr = renewSel.seatType === 'AC' ? settings.acQrImage : settings.nonAcQrImage;
                  return zoneQr
                    ? <div className="qr-image-wrap pulse-ring"><img src={zoneQr} alt="payment QR" style={{ width:120, height:120, objectFit:'contain' }} /></div>
                    : <div className="qr-image-wrap pulse-ring" dangerouslySetInnerHTML={{ __html: QR_SVG }} />;
                })()}
                <div className="qr-upi-icons">
                  {['GPay','PhonePe','Paytm','BHIM UPI'].map(u => <span key={u} className="upi-badge">{u}</span>)}
                </div>
                <p style={{ fontSize:'.75rem', color:'var(--text-3)', margin:'.35rem 0' }}>
                  UPI ID: <strong>{settings.upiId}</strong>
                </p>
                <div className="wait-status"><div className="spinner" />Waiting for admin verification…</div>
                <p style={{ fontSize:'.75rem', color:'var(--text-3)', marginTop:'.6rem', lineHeight:1.6, textAlign:'center' }}>
                  Admin will verify your payment and extend your seat by one month.
                </p>
                {renewStatus === 'rejected' && (
                  <div style={{ marginTop:'1rem' }}>
                    <div style={{ background:'#fee2e2', borderRadius:8, padding:'.7rem', marginBottom:'.6rem', fontSize:'.83rem', color:'#991b1b', textAlign:'center' }}>
                      ❌ Renewal rejected. Please contact admin.
                    </div>
                    <button className="btn btn-primary" style={{ width:'100%' }} onClick={closeRenew}>Close</button>
                  </div>
                )}
              </>)}

              {renewStage === 'done' && renewSel && (<>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>🎉</div>
                  <h3 style={{ marginBottom:'.4rem' }}>Seat Renewed!</h3>
                  <p style={{ fontSize:'.85rem', color:'var(--text-2)', marginBottom:'1.25rem' }}>
                    Your seat is confirmed for another month. Enjoy your study session!
                  </p>
                </div>

                {/* INVOICE */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:10, padding:'1.1rem', marginBottom:'1.1rem', textAlign:'left' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:'.8rem', marginBottom:'.7rem', borderBottom:'1px dashed var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                      <span style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center' }}><BrandMark size="100%" /></span>
                      <div>
                        <div style={{ fontWeight:800, fontSize:'.95rem' }}>{settings.companyName}</div>
                        <div style={{ fontSize:'.7rem', color:'var(--text-3)' }}>{settings.city}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'.7rem', color:'var(--text-3)' }}>Invoice No.</div>
                      <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:'.78rem', color:'var(--brand)' }}>{renewBookingData?.id || renewReqId}</div>
                    </div>
                  </div>
                  {[
                    ['Student',     renewBookingData?.name || renewSel.name],
                    ['Mobile',      renewBookingData?.mobile || renewSel.mobile],
                    ['Seat',        renewSel.seatType==='AC' ? `AC #${renewSel.seatId.replace('AC','')}` : `Non-AC #${renewSel.seatId.replace('NAC','')}`],
                    ['Zone',        renewSel.seatType==='AC' ? '❄️ AC Zone' : '🌿 Non-AC Zone'],
                    ['Renewed On',  renewBookingData?.confirmedAt ? new Date(renewBookingData.confirmedAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'],
                    ['Valid Till',  renewBookingData?.expiresAt ? new Date(renewBookingData.expiresAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'],
                    ['Amount Paid', `₹${renewSel.price?.toLocaleString()}`],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'.3rem 0', fontSize:'.85rem' }}>
                      <span style={{ color:'var(--text-2)' }}>{k}</span><strong>{v}</strong>
                    </div>
                  ))}
                </div>

                <button className="btn btn-secondary" style={{ width:'100%', marginBottom:'.6rem' }}
                  onClick={() => downloadInvoicePDF(
                    renewBookingData || { id: renewReqId, name: renewSel.name, mobile: renewSel.mobile, seatId: renewSel.seatId, seatType: renewSel.seatType, price: renewSel.price, confirmedAt: new Date(), expiresAt: null },
                    settings
                  )}>
                  ⬇️ Download Invoice (PDF)
                </button>

                <button className="btn btn-primary" style={{ width:'100%' }} onClick={closeRenew}>Done</button>
              </>)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
