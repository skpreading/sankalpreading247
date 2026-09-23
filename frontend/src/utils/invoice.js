import jsPDF from 'jspdf';

// Figures out the jsPDF image format string from a base64 data URI.
// Returns null (and the caller should skip the logo) for formats jsPDF
// can't embed, like webp.
function detectImageFormat(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') return null;
  if (dataUri.startsWith('data:image/png')) return 'PNG';
  if (dataUri.startsWith('data:image/jpeg') || dataUri.startsWith('data:image/jpg')) return 'JPEG';
  return null; // webp / svg / unknown — jsPDF can't embed these reliably
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function fmtTime(d) {
  return d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
}

// Builds and downloads a one-page PDF invoice for a confirmed booking.
// `booking` is the raw Booking record (id, seatId, seatType, name, mobile,
// price, confirmedAt, expiresAt, renewalCount…) and `settings` is the
// admin's branding/contact Settings record.
export function downloadInvoicePDF(booking, settings = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const company = settings.companyName || 'ReadSpace';
  const brand = [79, 70, 229]; // matches --brand

  // ── HEADER BAR ──
  doc.setFillColor(...brand);
  doc.rect(0, 0, pageWidth, 96, 'F');

  const logoFormat = detectImageFormat(settings.logoImage);
  const textStartX = logoFormat ? margin + 60 : margin;
  if (logoFormat) {
    try { doc.addImage(settings.logoImage, logoFormat, margin, 22, 48, 48); } catch (e) { /* skip a broken image quietly */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
  doc.text(company, textStartX, 46);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  if (settings.address)  doc.text(settings.address, textStartX, 62, { maxWidth: 300 });
  const contactLine = [settings.contactPhone, settings.contactEmail].filter(Boolean).join('   ·   ');
  if (contactLine) doc.text(contactLine, textStartX, 76);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('INVOICE', pageWidth - margin, 46, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Seat Booking Receipt', pageWidth - margin, 62, { align: 'right' });

  doc.setTextColor(30, 30, 30);

  // ── META (right) + BILLED TO (left) ──
  const confirmedDate = booking.confirmedAt ? new Date(booking.confirmedAt) : new Date();
  let y = 132;
  const metaRows = [
    ['Invoice No.', booking.id],
    ['Date',        fmtDate(confirmedDate)],
    ['Time',        fmtTime(confirmedDate)],
  ];
  doc.setFontSize(10);
  metaRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');   doc.text(label, pageWidth - margin - 150, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(value), pageWidth - margin, y, { align: 'right' });
    y += 16;
  });

  let leftY = 132;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Billed To', margin, leftY); leftY += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(booking.name || '—', margin, leftY); leftY += 14;
  doc.text(`Mobile: ${booking.mobile || '—'}`, margin, leftY); leftY += 14;

  y = Math.max(y, leftY) + 26;

  // ── TABLE ──
  const colDesc = margin + 10, colZone = margin + 250, colValid = margin + 340, colAmt = pageWidth - margin - 10;
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, pageWidth - margin * 2, 26, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(75, 85, 99);
  doc.text('DESCRIPTION', colDesc, y + 17);
  doc.text('ZONE', colZone, y + 17);
  doc.text('VALID TILL', colValid, y + 17);
  doc.text('AMOUNT', colAmt, y + 17, { align: 'right' });
  y += 26;

  const zoneLabel = booking.seatType === 'AC' ? 'AC Zone' : 'Non-AC Zone';
  const seatNum = (booking.seatId || '').replace(/^AC|^NAC/, '');
  const rowY = y + 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
  doc.text(`Reading Room Seat #${seatNum} — Monthly Membership`, colDesc, rowY, { maxWidth: 220 });
  doc.text(zoneLabel, colZone, rowY);
  doc.text(fmtDate(booking.expiresAt), colValid, rowY);
  doc.text(`Rs. ${Number(booking.price || 0).toLocaleString('en-IN')}`, colAmt, rowY, { align: 'right' });
  y = rowY + 14;
  doc.line(margin, y, pageWidth - margin, y);

  if (booking.renewalCount > 0) {
    y += 18;
    doc.setFontSize(9); doc.setTextColor(120, 120, 120);
    doc.text(`Renewal #${booking.renewalCount}`, colDesc, y);
  }

  // ── TOTAL ──
  y += 40;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 30, 30);
  doc.text('Total Paid', colValid, y);
  doc.text(`Rs. ${Number(booking.price || 0).toLocaleString('en-IN')}`, colAmt, y, { align: 'right' });

  // ── STATUS BADGE ──
  y += 34;
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(margin, y - 15, 128, 22, 5, 5, 'F');
  doc.setTextColor(22, 101, 52); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.text('PAID / CONFIRMED', margin + 10, y + 1);

  // ── FOOTER ──
  const footerY = pageHeight - 60;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12);
  doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`Thank you for choosing ${company}. This is a system-generated invoice and does not require a signature.`, margin, footerY + 4);
  if (contactLine) doc.text(`For queries, contact: ${contactLine}`, margin, footerY + 16);

  doc.save(`${company.replace(/\s+/g, '_')}_Invoice_${booking.id}.pdf`);
}
