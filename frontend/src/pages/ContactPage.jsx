import React, { useState } from 'react';
import Lottie from 'lottie-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import { useBranding, BrandMark } from '../context/BrandingContext.jsx';

import { API_URL } from '../config.js';

// Inline Lottie animation data (book/reading animation)
const BOOK_ANIM = {"v":"5.9.0","fr":30,"ip":0,"op":90,"w":400,"h":400,"nm":"Book Reading","ddd":0,"assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Book","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"i":{"x":[.833],"y":[.833]},"o":{"x":[.167],"y":[.167]},"t":0,"s":[0]},{"i":{"x":[.833],"y":[.833]},"o":{"x":[.167],"y":[.167]},"t":45,"s":[-8]},{"t":90,"s":[0]}]},"p":{"a":0,"k":[200,220,0]},"a":{"a":0,"k":[0,0,0]},"s":{"a":0,"k":[100,100,100]}},"ao":0,"shapes":[{"ty":"gr","it":[{"ty":"rc","p":{"a":0,"k":[0,0]},"s":{"a":0,"k":[160,200]},"r":{"a":0,"k":8}},{"ty":"fl","c":{"a":0,"k":[0.31,0.27,0.9,1]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]},{"ty":"gr","it":[{"ty":"rc","p":{"a":0,"k":[-2,0]},"s":{"a":0,"k":[4,200]},"r":{"a":0,"k":0}},{"ty":"fl","c":{"a":0,"k":[1,1,1,0.3]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]},{"ty":"gr","it":[{"ty":"rc","p":{"a":0,"k":[0,-60]},"s":{"a":0,"k":[120,8]},"r":{"a":0,"k":4}},{"ty":"fl","c":{"a":0,"k":[1,1,1,0.5]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]},{"ty":"gr","it":[{"ty":"rc","p":{"a":0,"k":[0,-40]},"s":{"a":0,"k":[100,8]},"r":{"a":0,"k":4}},{"ty":"fl","c":{"a":0,"k":[1,1,1,0.4]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]},{"ty":"gr","it":[{"ty":"rc","p":{"a":0,"k":[0,-20]},"s":{"a":0,"k":[110,8]},"r":{"a":0,"k":4}},{"ty":"fl","c":{"a":0,"k":[1,1,1,0.4]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]}],"ip":0,"op":90,"st":0,"bm":0}]};

const CONTACT_ANIM = {"v":"5.9.0","fr":30,"ip":0,"op":120,"w":400,"h":400,"nm":"Contact","ddd":0,"assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Envelope","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"i":{"x":[.833],"y":[.833]},"o":{"x":[.167],"y":[.167]},"t":0,"s":[-5]},{"i":{"x":[.833],"y":[.833]},"o":{"x":[.167],"y":[.167]},"t":30,"s":[5]},{"i":{"x":[.833],"y":[.833]},"o":{"x":[.167],"y":[.167]},"t":60,"s":[-5]},{"i":{"x":[.833],"y":[.833]},"o":{"x":[.167],"y":[.167]},"t":90,"s":[5]},{"t":120,"s":[-5]}]},"p":{"a":1,"k":[{"i":{"x":.5,"y":1},"o":{"x":.5,"y":0},"t":0,"s":[200,220,0],"to":[0,-5,0],"ti":[0,5,0]},{"t":60,"s":[200,190,0]},{"t":120,"s":[200,220,0]}]},"a":{"a":0,"k":[0,0,0]},"s":{"a":0,"k":[100,100,100]}},"ao":0,"shapes":[{"ty":"gr","it":[{"ty":"rc","p":{"a":0,"k":[0,10]},"s":{"a":0,"k":[200,140]},"r":{"a":0,"k":12}},{"ty":"fl","c":{"a":0,"k":[0.31,0.27,0.9,1]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]},{"ty":"gr","it":[{"ind":0,"ty":"sh","ks":{"a":0,"k":{"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]],"v":[[-100,-60],[0,20],[100,-60]],"c":false}}},{"ty":"st","c":{"a":0,"k":[1,1,1,0.7]},"o":{"a":0,"k":100},"w":{"a":0,"k":4}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]}],"ip":0,"op":120,"st":0,"bm":0},{"ddd":0,"ind":2,"ty":4,"nm":"Stars","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[0]},{"t":20,"s":[100]},{"t":100,"s":[100]},{"t":120,"s":[0]}]},"p":{"a":0,"k":[200,200,0]},"a":{"a":0,"k":[0,0,0]},"s":{"a":0,"k":[100,100,100]}},"ao":0,"shapes":[{"ty":"gr","it":[{"ty":"el","p":{"a":1,"k":[{"t":0,"s":[-80,-100]},{"t":60,"s":[-120,-130]},{"t":120,"s":[-80,-100]}]},"s":{"a":0,"k":[8,8]}},{"ty":"fl","c":{"a":0,"k":[0.96,0.62,0.04,1]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]},{"ty":"gr","it":[{"ty":"el","p":{"a":1,"k":[{"t":0,"s":[80,-80]},{"t":60,"s":[120,-110]},{"t":120,"s":[80,-80]}]},"s":{"a":0,"k":[6,6]}},{"ty":"fl","c":{"a":0,"k":[0.96,0.62,0.04,1]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]},{"ty":"gr","it":[{"ty":"el","p":{"a":1,"k":[{"t":0,"s":[0,-120]},{"t":60,"s":[20,-150]},{"t":120,"s":[0,-120]}]},"s":{"a":0,"k":[5,5]}},{"ty":"fl","c":{"a":0,"k":[0.31,0.76,0.51,1]},"o":{"a":0,"k":100}},{"ty":"tr","p":{"a":0,"k":[0,0]}}]}],"ip":0,"op":120,"st":0,"bm":0}]};

// Turns a regular (non-share) Google Maps link into one that renders inside
// an <iframe>. NOTE: this only works for full "google.com/maps/..." links —
// short maps.app.goo.gl share links get blocked by Google once the redirect
// lands, so those must be swapped for the dedicated "Embed a map" link
// instead (see the helper text in Admin → Settings → Location & Contact).
function toEmbeddableMapUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/maps/embed') || trimmed.includes('output=embed')) return trimmed;
  return trimmed.includes('?') ? `${trimmed}&output=embed` : `${trimmed}?output=embed`;
}

// Official brand SVG marks (Simple Icons, MIT licensed) — real logos, not emoji.
const IgIcon = p => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...p}><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227a3.81 3.81 0 0 1-.899 1.382c-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421a3.83 3.83 0 0 1-1.379-.899c-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.441 1.441 0 1 1-2.883 0 1.441 1.441 0 0 1 2.883 0z"/></svg>;
const LiIcon = p => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...p}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.554V9h3.565v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
const FbIcon = p => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...p}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const YtIcon = p => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...p}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;

// Only platforms the admin has actually pasted a link for show up — no
// placeholder/dead icons for socials that were never set. Instagram uses
// its real gradient background, same as the official app icon.
const SOCIAL_PLATFORMS = [
  { key: 'instagramUrl', label: 'Instagram', Icon: IgIcon, bg: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' },
  { key: 'linkedinUrl',  label: 'LinkedIn',  Icon: LiIcon, bg: '#0A66C2' },
  { key: 'facebookUrl',  label: 'Facebook',  Icon: FbIcon, bg: '#1877F2' },
  { key: 'youtubeUrl',   label: 'YouTube',   Icon: YtIcon, bg: '#FF0000' },
];

export default function ContactPage() {
  const { companyName, city, address, contactEmail, contactPhone, contactHours, instagramUrl, linkedinUrl, facebookUrl, youtubeUrl, mapEmbedUrl } = useBranding();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), mobile: form.mobile.trim(), email: form.email.trim(),
          category: form.subject || 'Other', message: form.message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Message sent! We will get back to you within 24 hours.');
      setForm({ name: '', email: '', mobile: '', subject: '', message: '' });
    } catch (err) {
      toast.error(err.message || 'Could not send message. Please try again.');
    }
    setSending(false);
  };

  return (
    <main className="page">
      <Helmet>
        <title>{`Contact Us — ${companyName} Reading Room & Library, ${city}`}</title>
        <meta name="description" content={`Get in touch with ${companyName}, ${city}'s premium AC & Non-AC reading room. Ask about seat availability, monthly fees, or visit us for a tour.`} />
        <meta name="keywords" content={`Sankalp Education, Sankalp Education ${city}, contact reading room ${city}, ${companyName} address, library contact ${city}, reading room enquiry`} />
        <link rel="canonical" href="https://readspace.example.com/contact" />
      </Helmet>
      {/* HERO */}
      <section style={{ background: 'var(--dark)', padding: '4rem 2rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(79,70,229,.3) 0%, transparent 65%)' }} />
        <motion.div style={{ position: 'relative' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="section-eyebrow" style={{ color: '#a5b4fc' }}>Get In Touch</span>
          <h2 style={{ color: '#fff', fontSize: 'clamp(1.8rem,3vw,2.5rem)', marginBottom: '.75rem' }}>We'd Love to Hear From You</h2>
          <p style={{ color: 'rgba(255,255,255,.6)', maxWidth: 480, margin: '0 auto' }}>Have a question about seats, membership plans, or just want to take a tour? Drop us a message!</p>
        </motion.div>
      </section>

      <section className="section" style={{ background: 'var(--lighter)' }}>
        <div className="section-inner">
          <div className="contact-layout">
            {/* FORM CARD */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2 }}>
              <div className="contact-form-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
                  <div style={{ width: 48, height: 48, flexShrink: 0 }}>
                    <Lottie animationData={CONTACT_ANIM} loop style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '.2rem' }}>Send a Message</h3>
                    <p style={{ fontSize: '.82rem', color: 'var(--text-2)' }}>We reply within 24 hours</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Full Name *</label>
                      <input required placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile Number *</label>
                      <input required placeholder="+91 9999999999" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input required type="email" placeholder="johndoe@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                      <option value="">Select a topic</option>
                      <option>Seat Availability Inquiry</option>
                      <option>Membership / Pricing</option>
                      <option>Booking Support</option>
                      <option>Facility Tour Request</option>
                      <option>Feedback / Suggestion</option>
                      <option>Complaint / Grievance</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your Message *</label>
                    <textarea required placeholder="Tell us what's on your mind..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={sending} style={{ width: '100%', padding: '.8rem' }}>
                    {sending ? '⏳ Sending...' : '📨 Send Message'}
                  </button>
                </form>
              </div>
            </motion.div>

            {/* INFO CARD + MAP */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 }}>
              <div className="contact-info-card" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                  <div style={{ width: 60, height: 60, flexShrink: 0 }}>
                    <Lottie animationData={BOOK_ANIM} loop style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontFamily: "'Playfair Display',serif", fontSize: '1.1rem', fontWeight: 700 }}>{companyName} {city}</div>
                    <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '.8rem' }}>Premium Reading & Study Rooms</div>
                  </div>
                </div>
                {[
                  { icon: '📍', label: 'Address', value: address },
                  { icon: '📞', label: 'Phone', value: contactPhone },
                  { icon: '📧', label: 'Email', value: contactEmail },
                  { icon: '🕐', label: 'Hours', value: contactHours },
                ].map((info, i) => (
                  <div key={i} className="contact-info-item">
                    <div className="contact-info-icon">{info.icon}</div>
                    <div>
                      <div className="contact-info-label">{info.label}</div>
                      <div className="contact-info-value" style={{ whiteSpace: 'pre-line' }}>{info.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* MAP */}
              <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ background: 'var(--dark)', color: 'rgba(255,255,255,.6)', fontSize: '.78rem', fontWeight: 600, padding: '.6rem 1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  📍 Find Us on Map
                </div>
                {mapEmbedUrl ? (
                  <iframe
                    title={`${companyName} Location`}
                    src={toEmbeddableMapUrl(mapEmbedUrl)}
                    width="100%"
                    height="260"
                    style={{ border: 0, display: 'block' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--lighter)', color: 'var(--text-3)', fontSize: '.82rem', textAlign: 'center', padding: '1.5rem' }}>
                    Map not set yet — add a Google Maps link in Admin → Settings → Location & Contact.
                  </div>
                )}
              </div>

              {/* SOCIAL */}
              {SOCIAL_PLATFORMS.some(p => ({ instagramUrl, linkedinUrl, facebookUrl, youtubeUrl }[p.key])) && (
                <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                  {SOCIAL_PLATFORMS
                    .filter(p => ({ instagramUrl, linkedinUrl, facebookUrl, youtubeUrl }[p.key]))
                    .map(({ key, label, Icon, bg }) => (
                      <a key={key} href={({ instagramUrl, linkedinUrl, facebookUrl, youtubeUrl })[key]} target="_blank" rel="noopener noreferrer"
                        title={label} aria-label={label}
                        style={{ width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.12)', transition: 'transform .2s, box-shadow .2s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.06)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)'; }}>
                        <Icon />
                      </a>
                    ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--dark)', color: 'rgba(255,255,255,.5)', padding: '2rem', textAlign: 'center', fontSize: '.82rem' }}>
        <div style={{ color: '#fff', fontFamily: "'Playfair Display',serif", fontSize: '1.2rem', marginBottom: '.5rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'.4rem' }}><span className="footer-logo-icon"><BrandMark size="100%" /></span>{companyName}</div>
        <div>Premium Reading Rooms · {city}, Maharashtra</div>
      </footer>
    </main>
  );
}
