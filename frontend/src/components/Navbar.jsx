import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useBranding, BrandMark } from '../context/BrandingContext.jsx';

export default function Navbar({ scrolled }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { companyName } = useBranding();

  const links = [
    ['/','Home'],
    ['/gallery','Gallery'],
    ['/book','Book a Seat'],
    ['/contact','Contact'],
  ];

  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        {/* BRAND */}
        <NavLink to="/" className="nav-brand">
          <div className="nav-logo-icon"><BrandMark size="100%" /></div>
          {companyName}
        </NavLink>

        {/* DESKTOP LINKS */}
        <div className="nav-links">
          {links.map(([to, label]) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* RIGHT ACTIONS */}
        <div className="nav-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/book')}>
            Book Now ✦
          </button>
        </div>

        {/* HAMBURGER */}
        <button className="nav-hamburger" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? '✕' : '☰'}
        </button>
      </nav>

      {/* MOBILE MENU */}
      {open && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0,
          background: 'var(--dark)', zIndex: 999, padding: '1rem',
          display: 'flex', flexDirection: 'column', gap: '.35rem',
          borderBottom: '1px solid rgba(255,255,255,.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {links.map(([to, label]) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
              style={{ display: 'block', padding: '.7rem 1rem' }}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}
