import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { io } from 'socket.io-client';
import { useBranding, BrandMark } from '../context/BrandingContext.jsx';
import { API_URL, SOCKET_URL } from '../config.js';

// Category icons are just cosmetic — matched loosely against the admin's
// tag text so common categories (AC/Non-AC/Common) get a nice emoji, while
// any brand new custom category the admin types still works fine with a
// sensible default icon.
function iconFor(tag) {
  const t = tag.toLowerCase();
  if (t.includes('non') && t.includes('ac')) return '🌿';
  if (t.includes('ac')) return '❄️';
  if (t.includes('common')) return '📚';
  return '🏷️';
}

// picks a CSS color class for the little corner badge — the 3 original
// categories keep their original colors, anything custom the admin adds
// gets a neutral color so it still looks intentional
function colorClassFor(tag) {
  const t = tag.toLowerCase();
  if (t.includes('non') && t.includes('ac')) return 'nonac';
  if (t.includes('ac')) return 'ac';
  if (t.includes('common')) return 'common';
  return 'custom';
}

export default function Gallery() {
  const { companyName, city } = useBranding();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/gallery`).then(r => r.json()).then(setItems).catch(() => {});
    const s = io(SOCKET_URL);
    s.on('gallery_updated', setItems);
    return () => s.disconnect();
  }, []);

  // filter buttons are built from whatever categories actually exist in the
  // admin-managed images, in the order they first appear
  const categories = [...new Set(items.map(i => i.tag))];
  const FILTERS = [
    { key: 'all', label: 'All Spaces' },
    ...categories.map(tag => ({ key: tag, label: `${iconFor(tag)} ${tag}` })),
  ];

  const filtered = filter === 'all' ? items : items.filter(i => i.tag === filter);

  return (
    <main className="page">
      <Helmet>
        <title>{`Reading Room Gallery — AC & Non-AC Study Spaces | ${companyName} ${city}`}</title>
        <meta name="description" content={`Take a visual tour of ${companyName} ${city}'s AC & Non-AC reading halls, library shelves, group study lounge and refreshment corner.`} />
        <meta name="keywords" content={`Sankalp Education, Sankalp Education ${city}, reading room photos ${city}, library gallery, AC study hall images, non AC reading room photos, study space ${city}`} />
        <link rel="canonical" href="https://readspace.example.com/gallery" />
      </Helmet>
      <section className="section">
        <div className="section-inner">
          <div className="section-header">
            <span className="section-eyebrow">Our Spaces</span>
            <h2>A Space Designed for Deep Work</h2>
            <p>Explore our thoughtfully designed reading rooms — every corner optimised for focus, comfort and productivity.</p>
          </div>
          <div className="gallery-filters">
            {FILTERS.map(f => (
              <button key={f.key} className={`gallery-filter-btn${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
          {items.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-3)' }}>No photos have been added yet.</p>
          ) : (
            <motion.div className="gallery-grid" layout>
              <AnimatePresence>
                {filtered.map((item, i) => (
                  <motion.div key={item.id} className="gallery-item" layout initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .92 }} transition={{ duration: .3, delay: i * .04 }} onClick={() => setLightbox(item)}>
                    <img src={item.image} alt={item.label || item.tag} loading="lazy" />
                    <div className="gallery-overlay">
                      <span className="gallery-overlay-icon">🔍</span>
                    </div>
                    <span className={`gallery-tag ${colorClassFor(item.tag)}`}>{item.tag}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>

      {/* LIGHTBOX */}
      <AnimatePresence>
        {lightbox && (
          <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(null)}>
            <motion.img src={lightbox.image.replace('w=600', 'w=1200')} alt={lightbox.label || lightbox.tag} className="lightbox-img" initial={{ scale: .85 }} animate={{ scale: 1 }} exit={{ scale: .85 }} onClick={e => e.stopPropagation()} loading="lazy" />
            <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
            <div style={{ position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)', color: '#fff', padding: '.5rem 1.25rem', borderRadius: 50, fontSize: '.85rem' }}>
              <span className={`gallery-tag ${colorClassFor(lightbox.tag)}`} style={{ marginRight: '.5rem', position: 'static' }}>{lightbox.tag}</span>
              {lightbox.label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer style={{ background: 'var(--dark)', color: 'rgba(255,255,255,.5)', padding: '2rem', textAlign: 'center', fontSize: '.82rem' }}>
        <div style={{ color: '#fff', fontFamily: "'Playfair Display',serif", fontSize: '1.2rem', marginBottom: '.5rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'.4rem' }}><span className="footer-logo-icon"><BrandMark size="100%" /></span>{companyName}</div>
        <div>Premium Reading Rooms · {city}, Maharashtra</div>
      </footer>
    </main>
  );
}
