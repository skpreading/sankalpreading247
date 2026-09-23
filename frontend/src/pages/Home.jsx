import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import { Helmet } from 'react-helmet-async';
import { useBranding, BrandMark } from '../context/BrandingContext.jsx';

import { API_URL, SOCKET_URL } from '../config.js';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const FEATURES = [
  { icon: '❄️', bg: '#eef2ff', title: 'AC Comfort Zone', desc: 'Premium air-conditioned halls with ergonomic chairs, ample lighting and zero disturbance policy.', zone: 'AC' },
  { icon: '🌿', bg: '#f0fdf4', title: 'Non-AC Budget Zone', desc: 'Well-ventilated, naturally lit spaces perfect for focused study at an affordable price.', zone: 'NON_AC' },
  { icon: '⚡', bg: '#fffbeb', title: 'Power & Wi-Fi', desc: 'Every seat has a charging point. High-speed Wi-Fi included in all plans.' },
  { icon: '🔒', bg: '#fdf4ff', title: 'Secure Lockers', desc: 'Free lockers for your belongings. 24/7 CCTV surveillance for your peace of mind.' },
  { icon: '📖', bg: '#f0fdf4', title: 'Curated Library', desc: 'Access to 3000+ books, competitive exam guides, and study material — free for all members.' },
  { icon: '☕', bg: '#fff7ed', title: 'Café & Refreshments', desc: 'On-site refreshment counter with tea, coffee, snacks, and healthy meals.' },
];

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=280&fit=crop',
  'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=300&h=220&fit=crop',
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=260&h=190&fit=crop',
];

export default function Home() {
  const navigate = useNavigate();
  const { companyName, city } = useBranding();
  const [reviews, setReviews] = useState([]);
  const [settings, setSettings] = useState({ acPrice: 1499, nonAcPrice: 900, acEnabled: true, nonAcEnabled: true });

  useEffect(() => {
    fetch(`${API_URL}/api/reviews`).then(r => r.json()).then(setReviews).catch(() => {});
    fetch(`${API_URL}/api/settings`).then(r => r.json()).then(setSettings).catch(() => {});
    const s = io(SOCKET_URL);
    s.on('settings_updated', setSettings);
    return () => s.disconnect();
  }, []);

  const acOn    = settings.acEnabled    !== false;
  const nonAcOn = settings.nonAcEnabled !== false;
  const bothZones = acOn && nonAcOn;
  const availablePrices = [acOn && settings.acPrice, nonAcOn && settings.nonAcPrice].filter(p => typeof p === 'number');
  const startingPrice = availablePrices.length ? Math.min(...availablePrices) : (settings.acPrice ?? settings.nonAcPrice ?? 0);
  const zoneStatLabel = bothZones ? 'AC & Non-AC' : (acOn ? 'AC Zone' : 'Non-AC Zone');

  return (
    <main className="page">
      <Helmet>
        <title>{`${companyName} by Sankalp Education, ${city} — Best AC & Non-AC Reading Room / Library | Book Seat Online`}</title>
        <meta name="description" content={`Book your AC or Non-AC study seat online at ${companyName}, an initiative by Sankalp Education in ${city}. High-speed Wi-Fi, curated library, 24/7 CCTV security & real-time seat booking. Ideal for UPSC, MPSC & competitive exam preparation.`} />
        <meta name="keywords" content={`Sankalp Education, Sankalp Education ${city}, Sankalp Education reading room, Sankalp Education library, reading room in ${city}, library in ${city}, AC reading room ${city}, non AC reading room ${city}, study room ${city}, best library for UPSC preparation, MPSC study room, monthly seat booking library`} />
        <link rel="canonical" href="https://readspace.example.com/" />
      </Helmet>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-content">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: .6 }}>
            <span className="hero-tag">✦ Premium Study Destination · {city}</span>
            <h1>Your Perfect <span>Study Space</span> Awaits</h1>
            <p className="hero-desc">
              {bothZones
                ? "India's most modern reading rooms with dedicated AC & Non-AC zones, high-speed Wi-Fi, curated library and real-time seat booking — right at your fingertips."
                : `India's most modern ${acOn ? 'air-conditioned' : 'naturally ventilated'} reading room with high-speed Wi-Fi, curated library and real-time seat booking — right at your fingertips.`}
            </p>
            <div className="hero-btns">
              <button className="btn btn-primary" onClick={() => navigate('/book')}>Book Your Seat →</button>
              <button className="btn btn-secondary" style={{ borderColor: 'rgba(255,255,255,.25)', color: '#fff' }} onClick={() => navigate('/gallery')}>View Gallery</button>
            </div>
            <div className="hero-stats">
              {[['120+', 'Total Seats'], [zoneStatLabel, bothZones ? 'Two Zones' : 'One Zone'], [`₹${startingPrice}/mo`, 'Starting at'], ['24/7', 'CCTV Security']].map(([val, label]) => (
                <div key={label} className="hstat">
                  <div className="hstat-val">{val}</div>
                  <div className="hstat-label">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div className="hero-visual" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .8, delay: .2 }}>
            <div className="hero-card-stack">
              {HERO_IMAGES.map((src, i) => (
                <div key={i} className="hero-img-card">
                  <img src={src} alt="Reading room" loading="lazy" />
                </div>
              ))}
              <div className="hero-badge b1">{acOn ? '❄️ AC Zone Available' : '🌿 Non-AC Zone Available'}</div>
              <div className="hero-badge b2">📚 3000+ Books Access</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ZONES */}
      <section className="section" style={{ background: '#fff' }}>
        <div className="section-inner">
          <div className="section-header">
            <span className="section-eyebrow">{bothZones ? 'Choose Your Zone' : 'Our Study Zone'}</span>
            <h2>{bothZones ? 'Two Zones, One Goal — Your Success' : 'Built for Your Success'}</h2>
            <p>{bothZones
              ? 'Pick the environment that suits your study style and budget. Both zones include Wi-Fi, lockers, and library access.'
              : 'A focused study environment with Wi-Fi, lockers, and library access included.'}</p>
          </div>
          <div className={`zone-cards${bothZones ? '' : ' zone-cards-single'}`}>
            {acOn && (
              <motion.div className="zone-card ac" whileHover={{ scale: 1.01 }} onClick={() => navigate('/book')}>
                <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&h=400&fit=crop" alt="AC Reading Zone" className="zone-card-img" loading="lazy" />
                <div className="zone-card-overlay">
                  <span className="zone-badge">❄️ PREMIUM AC ZONE</span>
                  <h3>Air-Conditioned Hall</h3>
                  <p>Climate-controlled, whisper-quiet, premium ergonomic seating</p>
                  <div className="zone-price">₹{settings.acPrice?.toLocaleString()} <span>/ month</span></div>
                </div>
              </motion.div>
            )}
            {nonAcOn && (
              <motion.div className="zone-card nonac" whileHover={{ scale: 1.01 }} onClick={() => navigate('/book')}>
                <img src="https://images.unsplash.com/photo-1568667256549-094345857637?w=700&h=400&fit=crop" alt="Non-AC Reading Zone" className="zone-card-img" loading="lazy" />
                <div className="zone-card-overlay">
                  <span className="zone-badge">🌿 BUDGET NON-AC ZONE</span>
                  <h3>Natural Ventilation Hall</h3>
                  <p>Spacious windows, natural light, budget-friendly comfort</p>
                  <div className="zone-price">₹{settings.nonAcPrice?.toLocaleString()} <span>/ month</span></div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" style={{ background: 'var(--lighter)' }}>
        <div className="section-inner">
          <div className="section-header">
            <span className="section-eyebrow">Everything You Need</span>
            <h2>Facilities That Fuel Focus</h2>
            <p>Everything you need to study smarter and longer — all under one roof.</p>
          </div>
          <div className="features-grid">
            {FEATURES.filter(f => (f.zone === 'AC' ? acOn : f.zone === 'NON_AC' ? nonAcOn : true)).map((f, i) => (
              <motion.div key={i} className="feat-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .08 }}>
                <div className="feat-icon" style={{ background: f.bg }}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" style={{ background: '#fff' }}>
        <div className="section-inner">
          <div className="section-header">
            <span className="section-eyebrow">How It Works</span>
            <h2>Book a Seat in 4 Easy Steps</h2>
          </div>
          <div className="how-grid">
            {[
              { step: '01', icon: '🗺️', title: 'Choose Your Seat', desc: 'Browse the seat map and pick your preferred AC or Non-AC seat like a movie ticket.' },
              { step: '02', icon: '📝', title: 'Fill Your Details', desc: 'Enter your name and mobile number. No lengthy forms — takes 30 seconds.' },
              { step: '03', icon: '📱', title: 'Scan & Pay', desc: 'Scan the UPI QR code and make payment via GPay, PhonePe or Paytm.' },
              { step: '04', icon: '✅', title: 'Get Confirmed', desc: 'Admin verifies your payment and confirms your seat. You get notified instantly.' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .1 }} style={{ textAlign: 'center', padding: '1.5rem 1rem', background: 'var(--lighter)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--brand)', letterSpacing: '.1em', marginBottom: '.5rem' }}>{s.step}</div>
                <div style={{ fontSize: '2rem', marginBottom: '.75rem' }}>{s.icon}</div>
                <h3 style={{ fontSize: '1rem', fontFamily: "'Inter',sans-serif", fontWeight: 600, marginBottom: '.4rem' }}>{s.title}</h3>
                <p style={{ fontSize: '.83rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/book')}>Book Your Seat Now →</button>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {reviews.length > 0 && (
        <section className="section" style={{ background: 'var(--lighter)' }}>
          <div className="section-inner">
            <div className="section-header">
              <span className="section-eyebrow">Student Stories</span>
              <h2>Loved by 500+ Students</h2>
              <p>Real reviews from students who have found their perfect study space at {companyName}.</p>
            </div>
            <div className="testimonials-grid">
              {reviews.map((t, i) => (
                <motion.div key={t.id || i} className="testimonial-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .08 }}>
                  <div className="testimonial-stars">{Array(t.stars).fill(0).map((_, j) => <span key={j}>★</span>)}{Array(5 - t.stars).fill(0).map((_, j) => <span key={j} style={{ opacity: .25 }}>★</span>)}</div>
                  <p className="testimonial-text">"{t.text}"</p>
                  <div className="testimonial-author">
                    {t.avatar
                      ? <img src={t.avatar} alt={t.name} className="testimonial-avatar" loading="lazy" />
                      : <div className="testimonial-avatar" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:'.9rem' }}>{t.name.slice(0,2).toUpperCase()}</div>}
                    <div>
                      <div className="testimonial-name">{t.name}</div>
                      <div className="testimonial-role">{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section" style={{ background: '#fff' }}>
        <div className="section-inner">
          <div className="cta-section">
            <h2>Ready to Transform Your Study Life?</h2>
            <p>Join 500+ students already studying at {companyName} {city}. Book your seat today.</p>
            <button className="btn btn-primary" onClick={() => navigate('/book')} style={{ fontSize: '1rem', padding: '1rem 2.5rem' }}>Book a Seat — Starting ₹{startingPrice}/mo</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--dark)', color: 'rgba(255,255,255,.5)', padding: '2rem', textAlign: 'center', fontSize: '.82rem' }}>
        <div style={{ color: '#fff', fontFamily: "'Playfair Display',serif", fontSize: '1.2rem', marginBottom: '.5rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'.4rem' }}><span className="footer-logo-icon"><BrandMark size="100%" /></span>{companyName}</div>
        <div>Premium Reading Rooms · {city}, Maharashtra</div>
        <div style={{ marginTop: '.5rem' }}>© 2025 {companyName}. All rights reserved.</div>
      </footer>
    </main>
  );
}
