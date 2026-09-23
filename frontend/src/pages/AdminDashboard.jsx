import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useBranding, BrandMark } from '../context/BrandingContext.jsx';

import { API_URL, SOCKET_URL } from '../config.js';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
  };
}

const SIDEBAR = [
  { key:'analytics', icon:'📊', label:'Analytics' },
  { key:'seats',     icon:'💺', label:'Seats'     },
  { key:'requests',  icon:'🔔', label:'Requests'  },
  { key:'bookings',  icon:'📋', label:'Bookings'  },
  { key:'reviews',   icon:'⭐', label:'Reviews'   },
  { key:'feedback',  icon:'📮', label:'Feedback'  },
  { key:'settings',  icon:'⚙️', label:'Settings'  },
];

// Settings is its own mini-app with separate pages, same as a real product's
// account settings screen — each page owns one concern only.
const SETTINGS_TABS = [
  { key:'profile',  icon:'👤', label:'Profile'  },
  { key:'seats',    icon:'💺', label:'Seat Settings' },
  { key:'location', icon:'📍', label:'Location & Contact' },
  { key:'pricing',  icon:'💰', label:'Pricing' },
  { key:'payments', icon:'📱', label:'Payments' },
  { key:'gallery',  icon:'🖼️', label:'Gallery' },
];

// converts an uploaded <input type="file"> image into a base64 data URI
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminDashboard() {
  const { companyName } = useBranding();
  const [tab,        setTab       ] = useState('analytics');
  const [filter,     setFilter    ] = useState('month');
  const [analytics,  setAnalytics ] = useState(null);
  const [seats,      setSeats     ] = useState([]);
  const [requests,   setRequests  ] = useState([]);
  const [bookings,   setBookings  ] = useState([]);
  const [seatFilter, setSeatFilter] = useState('all');
  const [collapsed,  setCollapsed ] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // switch between the desktop push-sidebar and the mobile off-canvas drawer
  // as the viewport crosses 768px — e.g. rotating a tablet, or resizing a
  // browser window, not just the initial load
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [settings,   setSettings  ] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [credForm, setCredForm] = useState({ currentPassword: '', newEmail: '', newPassword: '', confirmPassword: '' });
  const [savingCreds, setSavingCreds] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile'); // profile | seats | location | pricing | payments
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [bookModal,  setBookModal ] = useState(null); // { seatId } | null
  const [bookForm,   setBookForm  ] = useState({ name:'', mobile:'' });
  const [booking,    setBookingBusy] = useState(false);
  const [bkFilter,     setBkFilter    ] = useState('all'); // all | active | today | soon | expired
  const [renewModal,   setRenewModal  ] = useState(null); // booking object | null
  const [renewPrice,   setRenewPrice  ] = useState('');
  const [renewBusy,    setRenewBusy   ] = useState(false);
  const [reviews,      setReviews     ] = useState([]);
  const [reviewModal,  setReviewModal ] = useState(null); // review object | 'new' | null
  const [reviewForm,   setReviewForm  ] = useState({ name:'', role:'', text:'', stars:5, avatar:null });
  const [savingReview,  setSavingReview] = useState(false);
  const [feedback,     setFeedback    ] = useState([]);
  const [galleryImages,     setGalleryImages    ] = useState([]);
  const [galleryForm,       setGalleryForm      ] = useState({ image: null, tag: '', label: '' });
  const [savingGalleryImage, setSavingGalleryImage] = useState(false);
  const navigate = useNavigate();

  const fetchAll = useCallback(async () => {
    const headers = authHeaders();
    try {
      const [ana, seatRes, reqRes, bkRes, setRes, revRes, fbRes, galRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics?filter=${filter}`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/seats`,    { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/requests`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/bookings`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/settings`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/admin/reviews`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/feedback`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/gallery`,  { headers }).then(r => r.json()),
      ]);
      // any of these can come back as { error: '...' } with a 401 status if
      // the token expired mid-session — not just analytics
      const results = [ana, seatRes, reqRes, bkRes, setRes, revRes, fbRes, galRes];
      if (results.some(r => r && r.error === 'Invalid or expired token')) {
        handleLogout('Session expired after 10 minutes — please log in again');
        return;
      }
      if (ana.error)    { toast.error('Session expired — please login again'); navigate('/admin'); return; }
      setAnalytics(ana); setSeats(seatRes); setRequests(reqRes); setBookings(bkRes);
      setSettings(setRes);
      setSettingsForm(f => f || setRes);
      setReviews(revRes); setFeedback(fbRes);
      setGalleryImages(galRes);
    } catch { toast.error('Could not reach server'); }
  }, [filter, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('seats_updated',    setSeats);
    socket.on('settings_updated', s => { setSettings(s); setSettingsForm(s); });
    socket.on('reviews_updated',  () => fetchAll());
    socket.on('new_feedback',     () => { fetchAll(); toast('📮 New feedback from a student!', { icon:'📨' }); });
    socket.on('feedback_updated', () => fetchAll());
    socket.on('new_request',    (req) => { fetchAll(); toast(req?.type==='renewal' ? '🔄 New renewal request!' : '🔔 New booking request!', { icon:'📬' }); });
    socket.on('request_updated',() => fetchAll());
    socket.on('booking_renewed',() => fetchAll());
    socket.on('gallery_updated', setGalleryImages);
    return () => socket.disconnect();
  }, [fetchAll]);

  const handleLogout = (message) => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminTokenExpiry');
    if (message) toast.error(message); else toast.success('Logged out successfully');
    navigate('/admin');
  };

  // ── SESSION TIMEOUT — hard cap at 10 minutes from login ──────────────
  // Two layers so this can't be silently missed: a setTimeout fires right at
  // the expiry moment, and a 15s interval double-checks in case the tab was
  // backgrounded/asleep and the browser throttled or skipped the timeout.
  useEffect(() => {
    const checkSession = () => {
      const expiry = Number(localStorage.getItem('adminTokenExpiry'));
      if (!expiry || Date.now() >= expiry) {
        handleLogout('Session expired after 10 minutes — please log in again');
        return true;
      }
      return false;
    };

    if (checkSession()) return; // already expired (e.g. tab reopened later)

    const msRemaining = Number(localStorage.getItem('adminTokenExpiry')) - Date.now();
    const timeoutId  = setTimeout(checkSession, msRemaining);
    const intervalId = setInterval(checkSession, 15000);
    return () => { clearTimeout(timeoutId); clearInterval(intervalId); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSeat = async (seatId) => {
    await fetch(`${API_URL}/api/seats/${seatId}/toggle`, { method:'PATCH', headers: authHeaders() });
    fetchAll();
  };

  const approve = async (id) => {
    await fetch(`${API_URL}/api/requests/${id}/approve`, { method:'PATCH', headers: authHeaders() });
    toast.success('✅ Booking approved!');
    fetchAll();
  };

  const reject = async (id) => {
    await fetch(`${API_URL}/api/requests/${id}/reject`, { method:'PATCH', headers: authHeaders() });
    toast.error('❌ Booking rejected');
    fetchAll();
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method:'PATCH', headers: authHeaders(), body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data); setSettingsForm(data);
      toast.success('✅ Settings saved');
      fetchAll();
    } catch (e) { toast.error(e.message || 'Could not save settings'); }
    setSavingSettings(false);
  };

  const saveCredentials = async () => {
    if (!credForm.currentPassword) return toast.error('Enter your current password to confirm');
    if (credForm.newPassword && credForm.newPassword !== credForm.confirmPassword) return toast.error('New password and confirm password do not match');
    if (!credForm.newEmail.trim() && !credForm.newPassword.trim()) return toast.error('Enter a new username/email or a new password to change');
    setSavingCreds(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/credentials`, {
        method:'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          currentPassword: credForm.currentPassword,
          newEmail: credForm.newEmail.trim() || undefined,
          newPassword: credForm.newPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('✅ Login credentials updated');
      setCredForm({ currentPassword: '', newEmail: '', newPassword: '', confirmPassword: '' });
    } catch (e) { toast.error(e.message || 'Could not update credentials'); }
    setSavingCreds(false);
  };

  const performReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') return toast.error('Type RESET to confirm');
    if (!resetPassword) return toast.error('Enter your password to confirm');
    setResetting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/reset-all`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('✅ Everything has been reset to a fresh install');
      setResetModalOpen(false);
      setResetPassword(''); setResetConfirmText('');
      setTimeout(() => window.location.reload(), 900);
    } catch (e) { toast.error(e.message || 'Reset failed'); }
    setResetting(false);
  };

  const handleQrUpload = async (zoneKey, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please upload an image file');
    try {
      const dataUri = await fileToBase64(file);
      setSettingsForm(f => ({ ...f, [zoneKey]: dataUri }));
      toast.success('QR loaded — click Save Settings to apply');
    } catch { toast.error('Could not read image'); }
  };

  const openBookModal = (seatId) => { setBookModal({ seatId }); setBookForm({ name:'', mobile:'' }); };

  const openRenewModal = (booking) => { setRenewModal(booking); setRenewPrice(String(booking.price ?? '')); };

  const submitRenew = async () => {
    if (!renewModal) return;
    setRenewBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/bookings/${renewModal.id}/renew`, {
        method:'PATCH', headers: authHeaders(),
        body: JSON.stringify({ price: renewPrice === '' ? undefined : Number(renewPrice) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`✅ Seat ${data.seatId} renewed until ${new Date(data.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`);
      setRenewModal(null);
      fetchAll();
    } catch (e) { toast.error(e.message || 'Could not renew seat'); }
    setRenewBusy(false);
  };

  const submitAdminBook = async () => {
    if (!bookForm.name.trim())                       return toast.error('Enter student name');
    if (bookForm.mobile.replace(/\D/g,'').length < 10) return toast.error('Enter a valid 10-digit mobile number');
    setBookingBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/book`, {
        method:'POST', headers: authHeaders(),
        body: JSON.stringify({ seatId: bookModal.seatId, name: bookForm.name.trim(), mobile: bookForm.mobile.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`✅ Seat ${bookModal.seatId} booked free for ${bookForm.name.trim()}`);
      setBookModal(null);
      fetchAll();
    } catch (e) { toast.error(e.message || 'Could not book seat'); }
    setBookingBusy(false);
  };

  const openReviewModal = (review) => {
    if (review === 'new') { setReviewForm({ name:'', role:'', text:'', stars:5, avatar:null }); setReviewModal('new'); }
    else { setReviewForm({ name:review.name, role:review.role||'', text:review.text, stars:review.stars, avatar:review.avatar||null }); setReviewModal(review); }
  };

  const handleReviewAvatarUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please upload an image file');
    try {
      const dataUri = await fileToBase64(file);
      setReviewForm(f => ({ ...f, avatar: dataUri }));
    } catch { toast.error('Could not read image'); }
  };

  const saveReview = async () => {
    if (!reviewForm.name.trim()) return toast.error('Enter student name');
    if (!reviewForm.text.trim()) return toast.error('Enter the review text');
    setSavingReview(true);
    try {
      const isNew = reviewModal === 'new';
      const url = isNew ? `${API_URL}/api/admin/reviews` : `${API_URL}/api/admin/reviews/${reviewModal.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ ...reviewForm, name: reviewForm.name.trim(), text: reviewForm.text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(isNew ? '✅ Review posted' : '✅ Review updated');
      setReviewModal(null);
      fetchAll();
    } catch (e) { toast.error(e.message || 'Could not save review'); }
    setSavingReview(false);
  };

  const toggleReviewVisible = async (review) => {
    await fetch(`${API_URL}/api/admin/reviews/${review.id}`, {
      method:'PATCH', headers: authHeaders(), body: JSON.stringify({ visible: !review.visible }),
    });
    fetchAll();
  };

  const deleteReview = async (id) => {
    if (!window.confirm('Delete this review permanently?')) return;
    await fetch(`${API_URL}/api/admin/reviews/${id}`, { method:'DELETE', headers: authHeaders() });
    toast.success('Review deleted');
    fetchAll();
  };

  const handleGalleryImageUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please upload an image file');
    try {
      const dataUri = await fileToBase64(file);
      setGalleryForm(f => ({ ...f, image: dataUri }));
    } catch { toast.error('Could not read image'); }
  };

  const addGalleryImage = async () => {
    if (!galleryForm.image) return toast.error('Choose a photo to upload');
    if (!galleryForm.tag.trim()) return toast.error('Pick or type a category for this photo');
    setSavingGalleryImage(true);
    try {
      const res = await fetch(`${API_URL}/api/gallery`, {
        method:'POST', headers: authHeaders(),
        body: JSON.stringify({ ...galleryForm, tag: galleryForm.tag.trim(), label: galleryForm.label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('✅ Photo added to gallery');
      setGalleryForm({ image: null, tag: galleryForm.tag.trim(), label: '' });
      fetchAll();
    } catch (e) { toast.error(e.message || 'Could not add photo'); }
    setSavingGalleryImage(false);
  };

  const deleteGalleryImage = async (id) => {
    if (!window.confirm('Remove this photo from the gallery?')) return;
    await fetch(`${API_URL}/api/gallery/${id}`, { method:'DELETE', headers: authHeaders() });
    toast.success('Photo removed');
    fetchAll();
  };

  const markFeedbackRead = async (id) => {
    await fetch(`${API_URL}/api/feedback/${id}/read`, { method:'PATCH', headers: authHeaders() });
    fetchAll();
  };

  const deleteFeedback = async (id) => {
    if (!window.confirm('Delete this feedback entry?')) return;
    await fetch(`${API_URL}/api/feedback/${id}`, { method:'DELETE', headers: authHeaders() });
    fetchAll();
  };

  const pending      = requests.filter(r => r.status === 'pending');
  const unreadFeedback = feedback.filter(f => f.status === 'new');
  const filteredSeats = seatFilter === 'all'       ? seats
                      : seatFilter === 'ac'        ? seats.filter(s => s.type==='AC')
                      : seatFilter === 'nonac'     ? seats.filter(s => s.type==='NON_AC')
                      : seats.filter(s => s.status === seatFilter);

  // the most recent booking record per seat — this is the "currently active"
  // booking that a Renew action should apply to (older rows are just history)
  const latestBookingIds = new Set();
  {
    const bySeat = new Map();
    for (const b of bookings) {
      const prev = bySeat.get(b.seatId);
      if (!prev || new Date(b.confirmedAt) > new Date(prev.confirmedAt)) bySeat.set(b.seatId, b);
    }
    for (const b of bySeat.values()) latestBookingIds.add(b.id);
  }

  const expiryStatus = (booking) => {
    if (!latestBookingIds.has(booking.id) || !booking.expiresAt) return null;
    const now = new Date();
    const exp = new Date(booking.expiresAt);
    const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);
    const weekEnd  = new Date(now); weekEnd.setDate(weekEnd.getDate()+3); weekEnd.setHours(23,59,59,999);
    if (exp < now)        return 'expired';
    if (exp <= todayEnd)  return 'today';
    if (exp <= weekEnd)   return 'soon';
    return 'active';
  };

  const filteredBookings = bkFilter === 'all' ? bookings : bookings.filter(b => expiryStatus(b) === bkFilter);

  const PIE_DATA = analytics ? [
    { name:'AC Booked',     value: analytics.acBooked,      color:'#6366f1' },
    { name:'Non-AC Booked', value: analytics.nonAcBooked,   color:'#f59e0b' },
    { name:'Available',     value: analytics.availableSeats, color:'#10b981' },
  ] : [];

  /* ─────────────────────────────── RENDER ─────────────────────────────── */
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>

      {/* TOP BAR */}
      <div style={{
        background:'var(--dark)', padding: isMobile ? '0 .75rem' : '0 1.5rem', height:56,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:100, flexShrink:0, gap:'.5rem',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? '.5rem' : '.75rem', minWidth:0 }}>
          <button onClick={() => isMobile ? setMobileSidebarOpen(o => !o) : setCollapsed(c => !c)}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,.5)', fontSize:'1.2rem', cursor:'pointer', padding:'.2rem', flexShrink:0 }}>☰</button>
          <span style={{ color:'#fff', fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', display:'flex', alignItems:'center', gap:'.4rem', minWidth:0, overflow:'hidden' }}>
            <span className="admin-logo-icon" style={{ flexShrink:0 }}><BrandMark size="100%" /></span>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{companyName}</span>
          </span>
          {!isMobile && <span style={{ fontSize:'.7rem', background:'rgba(99,102,241,.35)', color:'#a5b4fc', padding:'2px 9px', borderRadius:50, fontFamily:"'Inter',sans-serif", fontWeight:700, flexShrink:0 }}>ADMIN</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? '.5rem' : '1rem', flexShrink:0 }}>
          {!isMobile && (
            <>
              <span style={{ color:'rgba(255,255,255,.45)', fontSize:'.82rem', display:'flex', alignItems:'center', gap:'.4rem' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', display:'inline-block' }}/>
                Online
              </span>
              <span style={{ color:'rgba(255,255,255,.55)', fontSize:'.82rem' }}>Admin</span>
            </>
          )}
          <button onClick={() => handleLogout()} style={{ background:'#ef4444', color:'#fff', border:'none', padding: isMobile ? '.35rem .6rem' : '.35rem .9rem', borderRadius:8, fontSize:'.82rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
            🚪{!isMobile && ' Logout'}
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>

        {/* Backdrop — only rendered on mobile while the drawer is open;
            tapping it closes the menu, same as tapping outside any drawer */}
        {isMobile && mobileSidebarOpen && (
          <div onClick={() => setMobileSidebarOpen(false)}
            style={{ position:'fixed', inset:0, top:56, background:'rgba(0,0,0,.45)', zIndex:150 }} />
        )}

        {/* SIDEBAR — desktop: pushes content, toggles between 60px/220px.
            Mobile: an off-canvas drawer that overlays content instead of
            squeezing it, so the seat map/tables never get crushed to a sliver. */}
        <div style={{
          width: isMobile ? 240 : (collapsed ? 60 : 220),
          background:'var(--dark)', display:'flex', flexDirection:'column',
          padding:'1rem 0', flexShrink:0, transition: isMobile ? 'transform .25s ease' : 'width .25s ease',
          overflow:'hidden',
          ...(isMobile ? {
            position:'fixed', top:56, left:0, bottom:0, zIndex:200,
            transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          } : {}),
        }}>
          {(!collapsed || isMobile) && (
            <div style={{ padding:'0 1rem 1rem', borderBottom:'1px solid rgba(255,255,255,.06)', marginBottom:'1rem' }}>
              <div style={{ color:'rgba(255,255,255,.4)', fontSize:'.72rem' }}>Logged in as</div>
              <div style={{ color:'#fff', fontWeight:600, fontSize:'.9rem', marginTop:'.1rem' }}>Administrator</div>
            </div>
          )}
          {SIDEBAR.map(item => (
            <button key={item.key}
              className={`sidebar-link${tab===item.key?' active':''}`}
              onClick={() => { setTab(item.key); if (isMobile) setMobileSidebarOpen(false); }}
              style={{ justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start' }}
            >
              <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{item.icon}</span>
              {(!collapsed || isMobile) && <span>{item.label}</span>}
              {(!collapsed || isMobile) && item.key==='requests' && pending.length>0 && (
                <span className="badge-count">{pending.length}</span>
              )}
              {(!collapsed || isMobile) && item.key==='feedback' && unreadFeedback.length>0 && (
                <span className="badge-count">{unreadFeedback.length}</span>
              )}
            </button>
          ))}
          <div style={{ marginTop:'auto', padding:'0 .5rem' }}>
            <button className="sidebar-link" onClick={() => handleLogout()} style={{ justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start' }}>
              <span style={{ fontSize:'1.1rem' }}>🚪</span>
              {(!collapsed || isMobile) && <span>Logout</span>}
            </button>
          </div>
        </div>

        {/* MAIN */}
        <div className="admin-content" style={{ flex:1, overflowY:'auto', minWidth:0 }}>
          <AnimatePresence mode="wait">

            {/* ── ANALYTICS ── */}
            {tab==='analytics' && (
              <motion.div key="analytics" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <div className="dash-header">
                  <h2 className="dash-title">Analytics Overview</h2>
                  <div className="filter-group">
                    {['today','week','month','all'].map(f => (
                      <button key={f} className={`filter-btn${filter===f?' active':''}`} onClick={() => setFilter(f)}>
                        {f.charAt(0).toUpperCase()+f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {analytics && <>
                  <div className="metrics-grid">
                    {[
                      { cls:'revenue',   label:'Total Revenue',    val:`₹${analytics.revenue.toLocaleString()}`,   trend:'From confirmed bookings' },
                      { cls:'booked',    label:'Booked Seats',     val:analytics.bookedSeats,                      trend:`of ${analytics.totalSeats} total seats` },
                      { cls:'available', label:'Available Seats',  val:analytics.availableSeats,                   trend:'Ready to book', trendColor:'var(--accent)' },
                      { cls:'pending',   label:'Pending Requests', val:analytics.pendingRequests,                  trend: analytics.pendingRequests>0?'⚠️ Needs action':'✅ All clear', trendColor: analytics.pendingRequests>0?'var(--red)':'var(--green)' },
                    ].map(m => (
                      <div key={m.cls} className={`metric-card ${m.cls}`}>
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-val">{m.val}</div>
                        <div className="metric-trend" style={{ color: m.trendColor || 'var(--green)' }}>{m.trend}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1.25rem', marginBottom:'1.5rem' }}>
                    <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.25rem 1.5rem' }}>
                      <div style={{ fontWeight:600, marginBottom:'1rem', fontSize:'.95rem' }}>📈 Revenue (Last 7 Days)</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={analytics.chartData} barSize={28}>
                          <XAxis dataKey="day" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${v}`}/>
                          <Tooltip formatter={v=>[`₹${v}`,'Revenue']} contentStyle={{borderRadius:8,border:'1px solid var(--border)',fontSize:'.82rem'}}/>
                          <Bar dataKey="revenue" fill="#6366f1" radius={[5,5,0,0]}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.25rem 1.5rem' }}>
                      <div style={{ fontWeight:600, marginBottom:'1rem', fontSize:'.95rem' }}>🥧 Seat Distribution</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={3} dataKey="value">
                            {PIE_DATA.map((e,i) => <Cell key={i} fill={e.color}/>)}
                          </Pie>
                          <Tooltip contentStyle={{borderRadius:8,border:'1px solid var(--border)',fontSize:'.82rem'}}/>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display:'flex', flexDirection:'column', gap:'.35rem', marginTop:'.5rem' }}>
                        {PIE_DATA.map(d=>(
                          <div key={d.name} style={{ display:'flex', alignItems:'center', gap:'.5rem', fontSize:'.78rem', color:'var(--text-2)' }}>
                            <div style={{ width:10,height:10,borderRadius:'50%',background:d.color,flexShrink:0 }}/>
                            {d.name}: <strong>{d.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>}
              </motion.div>
            )}

            {/* ── SEATS ── */}
            {tab==='seats' && (
              <motion.div key="seats" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <div className="dash-header">
                  <h2 className="dash-title">Seat Management</h2>
                  <div className="filter-group">
                    {[['all','All'],['ac','❄️ AC'],['nonac','🌿 Non-AC'],['booked','Booked'],['available','Available'],['unavailable','Blocked']].map(([k,l])=>(
                      <button key={k} className={`filter-btn${seatFilter===k?' active':''}`} onClick={()=>setSeatFilter(k)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="metrics-grid" style={{ gap:'.75rem', marginBottom:'1.5rem' }}>
                  {[['Total', seats.length,'#6366f1'],['Booked',seats.filter(s=>s.status==='booked').length,'#10b981'],['Available',seats.filter(s=>s.status==='available').length,'#f59e0b'],['Blocked',seats.filter(s=>s.status==='unavailable').length,'#ef4444']].map(([label,val,color])=>(
                    <div key={label} style={{ background:'var(--white)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'1rem 1.25rem',borderLeft:`4px solid ${color}` }}>
                      <div style={{ fontSize:'.78rem',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.06em' }}>{label}</div>
                      <div style={{ fontSize:'1.6rem',fontWeight:700,fontFamily:"'Inter',sans-serif",color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div className="seats-table-wrap">
                  <div className="table-header">
                    <span className="table-title">Seat Roster — Toggle to Block/Unblock</span>
                    <span style={{ fontSize:'.8rem', color:'var(--text-3)' }}>Showing {filteredSeats.length} seats</span>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table className="data-table">
                      <thead><tr><th>Seat ID</th><th>Seat #</th><th>Type</th><th>Status</th><th>Student</th><th>Price</th><th>Book Free</th><th>Block/Unblock</th></tr></thead>
                      <tbody>
                        {filteredSeats.map(seat=>(
                          <tr key={seat.id}>
                            <td><strong>{seat.id}</strong></td>
                            <td>#{seat.number}</td>
                            <td><span className={`type-badge ${seat.type==='AC'?'ac':'nonac'}`}>{seat.type==='AC'?'❄️ AC':'🌿 Non-AC'}</span></td>
                            <td><span className={`status-badge ${seat.status}`}>{seat.status.charAt(0).toUpperCase()+seat.status.slice(1)}</span></td>
                            <td style={{ color:seat.studentName?'var(--text)':'var(--text-3)' }}>{seat.studentName||'—'}</td>
                            <td>₹{seat.price}/mo</td>
                            <td>
                              {seat.status==='available'
                                ? <button onClick={()=>openBookModal(seat.id)}
                                    style={{ background:'#eef2ff', color:'var(--brand)', border:'1px solid #c7d2fe', borderRadius:6, padding:'.3rem .65rem', fontSize:'.76rem', fontWeight:600, cursor:'pointer' }}>
                                    🎟️ Book Free
                                  </button>
                                : <span style={{ color:'var(--text-3)', fontSize:'.76rem' }}>—</span>}
                            </td>
                            <td>
                              <label className="toggle-switch" title={seat.status==='unavailable'?'Click to unblock':'Click to block'}>
                                <input type="checkbox" checked={seat.status==='available'||seat.status==='booked'} onChange={()=>toggleSeat(seat.id)}/>
                                <span className="toggle-slider"/>
                              </label>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── BOOK-FREE MODAL ── */}
                <AnimatePresence>
                  {bookModal && (
                    <motion.div
                      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
                      onClick={() => setBookModal(null)}
                    >
                      <motion.div
                        initial={{ opacity:0, scale:.94, y:10 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:.94 }}
                        style={{ background:'var(--white)', borderRadius:'var(--radius)', padding:'1.5rem', width:340, maxWidth:'92vw' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <h3 style={{ fontSize:'1.05rem', marginBottom:'.25rem' }}>🎟️ Book Seat {bookModal.seatId} — Free</h3>
                        <p style={{ fontSize:'.8rem', color:'var(--text-2)', marginBottom:'1rem' }}>
                          This confirms the seat immediately with no payment collected, and it will show as booked on the public booking page too.
                        </p>
                        <div className="form-group">
                          <label className="form-label">Student Name *</label>
                          <input required placeholder="Enter full name"
                            value={bookForm.name} onChange={e=>setBookForm({...bookForm, name:e.target.value})} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Mobile Number *</label>
                          <input required placeholder="+91 XXXXX XXXXX"
                            value={bookForm.mobile} onChange={e=>setBookForm({...bookForm, mobile:e.target.value})} />
                        </div>
                        <div style={{ display:'flex', gap:'.6rem', marginTop:'1rem' }}>
                          <button className="btn btn-secondary" style={{ flex:1 }} onClick={()=>setBookModal(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{ flex:1 }} disabled={booking} onClick={submitAdminBook}>
                            {booking ? 'Booking…' : 'Confirm Free Booking'}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── REQUESTS ── */}
            {tab==='requests' && (
              <motion.div key="requests" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <div className="dash-header">
                  <h2 className="dash-title">Booking Requests</h2>
                  <span style={{ background:'#fef3c7',color:'#92400e',padding:'.35rem .9rem',borderRadius:50,fontSize:'.82rem',fontWeight:700 }}>
                    {pending.length} Pending
                  </span>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:'.75rem' }}>
                  {requests.length===0 && (
                    <div style={{ textAlign:'center',padding:'3rem',color:'var(--text-3)',background:'var(--white)',borderRadius:'var(--radius)',border:'1px solid var(--border)' }}>
                      📭 No booking requests yet
                    </div>
                  )}
                  {[...requests].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(req=>(
                    <div key={req.id} className={`request-card${req.status==='pending'?' new':''}`}>
                      <div className="req-avatar">{req.name.slice(0,2).toUpperCase()}</div>
                      <div className="req-info">
                        <div className="req-name">
                          {req.name}
                          {req.type==='renewal' && (
                            <span style={{ marginLeft:'.5rem', background:'#ede9fe', color:'#6d28d9', padding:'1px 8px', borderRadius:50, fontSize:'.68rem', fontWeight:700, verticalAlign:'middle' }}>
                              🔄 RENEWAL
                            </span>
                          )}
                        </div>
                        <div className="req-meta">
                          <span>📱 {req.mobile}</span>
                          <span>💺 Seat {req.seatId}</span>
                          <span className={`type-badge ${req.seatType==='AC'?'ac':'nonac'}`} style={{padding:'1px 6px',fontSize:'.72rem'}}>{req.seatType==='AC'?'❄️ AC':'🌿 Non-AC'}</span>
                          <span>💰 ₹{req.price?.toLocaleString()}</span>
                          <span style={{color:'var(--text-3)'}}>🕐 {new Date(req.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</span>
                        </div>
                      </div>
                      <div className="req-actions-col" style={{ display:'flex',alignItems:'center',gap:'.5rem',flexShrink:0 }}>
                        <span className={`status-badge ${req.status}`}>{req.status.charAt(0).toUpperCase()+req.status.slice(1)}</span>
                        {req.status==='pending' && (
                          <div className="req-actions">
                            <button className="btn-approve" onClick={()=>approve(req.id)}>✓ Approve</button>
                            <button className="btn-reject"  onClick={()=>reject(req.id) }>✗ Reject</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── BOOKINGS ── */}
            {tab==='bookings' && (
              <motion.div key="bookings" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <div className="dash-header">
                  <h2 className="dash-title">Confirmed Bookings</h2>
                  <div className="filter-group">
                    {[['all','All'],['active','Active'],['today','Expiring Today'],['soon','Expiring Soon'],['expired','Expired']].map(([k,l])=>(
                      <button key={k} className={`filter-btn${bkFilter===k?' active':''}`} onClick={()=>setBkFilter(k)}>{l}</button>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize:'.8rem', color:'var(--text-2)', marginBottom:'1rem' }}>
                  Expiry filters only apply to each seat's <strong>current</strong> (most recent) booking — older renewal history rows always show under "All".
                </p>
                <div className="seats-table-wrap">
                  <div className="table-header">
                    <span className="table-title">Bookings</span>
                    <span style={{ fontSize:'.8rem', color:'var(--text-3)' }}>Showing {filteredBookings.length} of {bookings.length}</span>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table className="data-table">
                      <thead><tr><th>Booking ID</th><th>Student</th><th>Mobile</th><th>Seat</th><th>Type</th><th>Amount</th><th>Confirmed At</th><th>Expires</th><th>Renew</th></tr></thead>
                      <tbody>
                        {filteredBookings.length===0 && <tr><td colSpan={9} style={{textAlign:'center',color:'var(--text-3)',padding:'2rem'}}>No bookings match this filter</td></tr>}
                        {filteredBookings.map(b=>{
                          const status = expiryStatus(b);
                          const expLabel = b.expiresAt ? new Date(b.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
                          const statusStyle = {
                            expired: { background:'#fee2e2', color:'#991b1b' },
                            today:   { background:'#fef3c7', color:'#92400e' },
                            soon:    { background:'#fef3c7', color:'#92400e' },
                            active:  { background:'#dcfce7', color:'#166534' },
                          }[status] || {};
                          return (
                            <tr key={b.id}>
                              <td>
                                <span style={{fontFamily:'monospace',fontSize:'.82rem',color:'var(--brand)'}}>{b.id}</span>
                                {b.parentBookingId && (
                                  <div style={{ fontSize:'.68rem', color:'var(--text-3)', marginTop:'2px' }}>🔄 renewal</div>
                                )}
                              </td>
                              <td><strong>{b.name}</strong></td>
                              <td>{b.mobile}</td>
                              <td><strong>{b.seatId}</strong></td>
                              <td><span className={`type-badge ${b.seatType==='AC'?'ac':'nonac'}`}>{b.seatType==='AC'?'❄️ AC':'🌿 Non-AC'}</span></td>
                              <td>{b.bookedByAdmin ? <span style={{ color:'var(--brand)', fontWeight:600 }}>🎟️ Free (Admin)</span> : `₹${b.price?.toLocaleString()}`}</td>
                              <td style={{fontSize:'.8rem',color:'var(--text-2)'}}>{b.confirmedAt?new Date(b.confirmedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'}</td>
                              <td>
                                {status
                                  ? <span style={{ ...statusStyle, padding:'.2rem .65rem', borderRadius:50, fontSize:'.74rem', fontWeight:700 }}>
                                      {status==='expired'?'Expired':status==='today'?'Today':status==='soon'?'Soon':'Active'} · {expLabel}
                                    </span>
                                  : <span style={{ color:'var(--text-3)', fontSize:'.78rem' }}>{expLabel}</span>}
                              </td>
                              <td>
                                {latestBookingIds.has(b.id)
                                  ? <button onClick={()=>openRenewModal(b)}
                                      style={{ background:'#eef2ff', color:'var(--brand)', border:'1px solid #c7d2fe', borderRadius:6, padding:'.3rem .65rem', fontSize:'.76rem', fontWeight:600, cursor:'pointer' }}>
                                      🔄 Renew
                                    </button>
                                  : <span style={{ color:'var(--text-3)', fontSize:'.76rem' }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── RENEW MODAL ── */}
                <AnimatePresence>
                  {renewModal && (
                    <motion.div
                      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
                      onClick={() => setRenewModal(null)}
                    >
                      <motion.div
                        initial={{ opacity:0, scale:.94, y:10 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:.94 }}
                        style={{ background:'var(--white)', borderRadius:'var(--radius)', padding:'1.5rem', width:360, maxWidth:'92vw' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <h3 style={{ fontSize:'1.05rem', marginBottom:'.25rem' }}>🔄 Renew Seat {renewModal.seatId}</h3>
                        <p style={{ fontSize:'.8rem', color:'var(--text-2)', marginBottom:'1rem' }}>
                          {renewModal.name} · {renewModal.mobile}<br/>
                          Current expiry: <strong>{renewModal.expiresAt ? new Date(renewModal.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}</strong>
                        </p>
                        <p style={{ fontSize:'.78rem', color:'var(--text-3)', marginBottom:'1rem' }}>
                          Confirms one month extra from today (or from the current expiry, if it's still in the future).
                        </p>
                        <div className="form-group">
                          <label className="form-label">Amount Collected (₹)</label>
                          <input type="number" min={0} value={renewPrice}
                            onChange={e=>setRenewPrice(e.target.value)} />
                        </div>
                        <div style={{ display:'flex', gap:'.6rem', marginTop:'1rem' }}>
                          <button className="btn btn-secondary" style={{ flex:1 }} onClick={()=>setRenewModal(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{ flex:1 }} disabled={renewBusy} onClick={submitRenew}>
                            {renewBusy ? 'Renewing…' : 'Confirm Renewal'}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── REVIEWS ── */}
            {tab==='reviews' && (
              <motion.div key="reviews" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <div className="dash-header">
                  <h2 className="dash-title">Student Reviews</h2>
                  <button className="btn btn-primary" onClick={()=>openReviewModal('new')}>+ Add Review</button>
                </div>
                <p style={{ fontSize:'.82rem', color:'var(--text-2)', marginBottom:'1.25rem' }}>
                  Only reviews you post here are shown on the public homepage — post genuine reviews you've collected from students. Hide (👁️) instead of delete to keep a review off the site without losing it.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
                  {reviews.length===0 && (
                    <div style={{ textAlign:'center',padding:'3rem',color:'var(--text-3)',background:'var(--white)',borderRadius:'var(--radius)',border:'1px solid var(--border)', gridColumn:'1/-1' }}>
                      ⭐ No reviews yet — add the first one
                    </div>
                  )}
                  {reviews.map(rv => (
                    <div key={rv.id} style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.1rem', opacity: rv.visible ? 1 : .5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'.7rem', marginBottom:'.6rem' }}>
                        {rv.avatar
                          ? <img src={rv.avatar} alt={rv.name} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover' }} />
                          : <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--brand)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'.85rem' }}>{rv.name.slice(0,2).toUpperCase()}</div>}
                        <div>
                          <div style={{ fontWeight:700, fontSize:'.9rem' }}>{rv.name}</div>
                          <div style={{ fontSize:'.76rem', color:'var(--text-3)' }}>{rv.role || '—'}</div>
                        </div>
                      </div>
                      <div style={{ color:'#f59e0b', fontSize:'.85rem', marginBottom:'.4rem' }}>
                        {'★'.repeat(rv.stars)}{'★'.repeat(5-rv.stars).split('').map((_,i)=><span key={i} style={{opacity:.25}}>★</span>)}
                      </div>
                      <p style={{ fontSize:'.85rem', color:'var(--text-2)', marginBottom:'.9rem', lineHeight:1.5 }}>"{rv.text}"</p>
                      <div style={{ display:'flex', gap:'.5rem' }}>
                        <button onClick={()=>openReviewModal(rv)} style={{ flex:1, background:'var(--lighter)', border:'1px solid var(--border)', borderRadius:6, padding:'.35rem', fontSize:'.76rem', fontWeight:600, cursor:'pointer' }}>✏️ Edit</button>
                        <button onClick={()=>toggleReviewVisible(rv)} style={{ flex:1, background:'var(--lighter)', border:'1px solid var(--border)', borderRadius:6, padding:'.35rem', fontSize:'.76rem', fontWeight:600, cursor:'pointer' }}>{rv.visible ? '🙈 Hide' : '👁️ Show'}</button>
                        <button onClick={()=>deleteReview(rv.id)} style={{ background:'#fee2e2', color:'#991b1b', border:'none', borderRadius:6, padding:'.35rem .6rem', fontSize:'.76rem', fontWeight:600, cursor:'pointer' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── REVIEW MODAL ── */}
                <AnimatePresence>
                  {reviewModal && (
                    <motion.div
                      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
                      onClick={() => setReviewModal(null)}
                    >
                      <motion.div
                        initial={{ opacity:0, scale:.94, y:10 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:.94 }}
                        style={{ background:'var(--white)', borderRadius:'var(--radius)', padding:'1.5rem', width:400, maxWidth:'92vw', maxHeight:'88vh', overflowY:'auto' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <h3 style={{ fontSize:'1.05rem', marginBottom:'1rem' }}>{reviewModal==='new' ? '⭐ Add Review' : '✏️ Edit Review'}</h3>
                        <div className="form-group">
                          <label className="form-label">Student Name *</label>
                          <input required value={reviewForm.name} onChange={e=>setReviewForm({...reviewForm, name:e.target.value})} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Role / Course (optional)</label>
                          <input placeholder="e.g. UPSC Aspirant" value={reviewForm.role} onChange={e=>setReviewForm({...reviewForm, role:e.target.value})} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Review Text *</label>
                          <textarea required value={reviewForm.text} onChange={e=>setReviewForm({...reviewForm, text:e.target.value})} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Rating</label>
                          <div style={{ display:'flex', gap:'.3rem' }}>
                            {[1,2,3,4,5].map(n => (
                              <button key={n} type="button" onClick={()=>setReviewForm({...reviewForm, stars:n})}
                                style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.4rem', color: n<=reviewForm.stars ? '#f59e0b' : '#e2e8f0' }}>★</button>
                            ))}
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Photo (optional — shows initials if skipped)</label>
                          <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
                            {reviewForm.avatar && <img src={reviewForm.avatar} alt="preview" style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover' }} />}
                            <label style={{ background:'var(--lighter)', border:'1px solid var(--border)', borderRadius:6, padding:'.35rem .8rem', fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
                              📤 Upload
                              <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleReviewAvatarUpload(e.target.files?.[0])} />
                            </label>
                            {reviewForm.avatar && (
                              <button type="button" onClick={()=>setReviewForm({...reviewForm, avatar:null})}
                                style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:'.78rem', cursor:'pointer', textDecoration:'underline' }}>remove</button>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'.6rem', marginTop:'1rem' }}>
                          <button className="btn btn-secondary" style={{ flex:1 }} onClick={()=>setReviewModal(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{ flex:1 }} disabled={savingReview} onClick={saveReview}>
                            {savingReview ? 'Saving…' : (reviewModal==='new' ? 'Post Review' : 'Save Changes')}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── FEEDBACK (grievances / complaints / suggestions) ── */}
            {tab==='feedback' && (
              <motion.div key="feedback" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <div className="dash-header">
                  <h2 className="dash-title">Student Feedback</h2>
                  <span style={{ background:'#fef3c7',color:'#92400e',padding:'.35rem .9rem',borderRadius:50,fontSize:'.82rem',fontWeight:700 }}>
                    {unreadFeedback.length} New
                  </span>
                </div>
                <p style={{ fontSize:'.82rem', color:'var(--text-2)', marginBottom:'1.25rem' }}>
                  Grievances, complaints and suggestions submitted via the Contact page. Only visible here — never shown publicly.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
                  {feedback.length===0 && (
                    <div style={{ textAlign:'center',padding:'3rem',color:'var(--text-3)',background:'var(--white)',borderRadius:'var(--radius)',border:'1px solid var(--border)' }}>
                      📭 No feedback submitted yet
                    </div>
                  )}
                  {feedback.map(fb => (
                    <div key={fb.id} className={`request-card${fb.status==='new'?' new':''}`}>
                      <div className="req-avatar">{fb.name.slice(0,2).toUpperCase()}</div>
                      <div className="req-info">
                        <div className="req-name">{fb.name}</div>
                        <div className="req-meta">
                          <span>📱 {fb.mobile}</span>
                          {fb.email && <span>✉️ {fb.email}</span>}
                          <span className="type-badge nonac" style={{padding:'1px 6px',fontSize:'.72rem'}}>{fb.category}</span>
                          <span style={{color:'var(--text-3)'}}>🕐 {new Date(fb.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</span>
                        </div>
                        <p style={{ fontSize:'.83rem', color:'var(--text-2)', marginTop:'.4rem', lineHeight:1.5 }}>{fb.message}</p>
                      </div>
                      <div className="req-actions-col" style={{ display:'flex',alignItems:'center',gap:'.5rem',flexShrink:0 }}>
                        {fb.status==='new'
                          ? <button className="btn-approve" onClick={()=>markFeedbackRead(fb.id)}>✓ Mark Read</button>
                          : <span className="status-badge approved">Read</span>}
                        <button className="btn-reject" onClick={()=>deleteFeedback(fb.id)}>🗑️ Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── SETTINGS ── */}
            {tab==='settings' && settingsForm && (
              <motion.div key="settings" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <div className="dash-header">
                  <h2 className="dash-title">Site Settings</h2>
                </div>

                {/* SETTINGS SUB-NAV */}
                <div className="settings-tabs">
                  {SETTINGS_TABS.map(t => (
                    <button key={t.key} className={`settings-tab-btn${settingsTab===t.key?' active':''}`}
                      onClick={()=>setSettingsTab(t.key)}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {/* ═══════════════════ PROFILE ═══════════════════ */}
                {settingsTab === 'profile' && (<>
                <p className="settings-page-intro">Your public brand identity and your personal login for this dashboard.</p>

                {/* BRANDING */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'.25rem' }}>🏷️ Branding</div>
                  <p style={{ fontSize:'.8rem', color:'var(--text-2)', marginBottom:'1.25rem' }}>
                    Customize the company name and logo shown across the navbar, footers, and this admin panel — no code changes needed.
                  </p>
                  <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', alignItems:'flex-start' }}>
                    <div className="form-group" style={{ maxWidth:320, flex:'1 1 240px' }}>
                      <label className="form-label">Company Name</label>
                      <input placeholder="ReadSpace" value={settingsForm.companyName ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, companyName: e.target.value})} />
                    </div>
                    <div style={{ border:'1px dashed var(--border)', borderRadius:'var(--radius)', padding:'1rem', textAlign:'center', minWidth:180 }}>
                      <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:'.6rem' }}>Logo</div>
                      {settingsForm.logoImage
                        ? <img src={settingsForm.logoImage} alt="Logo" style={{ width:80, height:80, objectFit:'contain', margin:'0 auto .75rem', display:'block', borderRadius:8, border:'1px solid var(--border)' }} />
                        : <div style={{ width:80, height:80, margin:'0 auto .75rem', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', background:'var(--lighter)', borderRadius:8 }}>📚</div>}
                      <div style={{ display:'flex', gap:'.5rem', justifyContent:'center' }}>
                        <label style={{ background:'var(--lighter)', border:'1px solid var(--border)', borderRadius:6, padding:'.35rem .8rem', fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
                          📤 Upload
                          <input type="file" accept="image/*" style={{ display:'none' }}
                            onChange={e=>handleQrUpload('logoImage', e.target.files?.[0])} />
                        </label>
                        {settingsForm.logoImage && (
                          <button onClick={()=>setSettingsForm({...settingsForm, logoImage: null})}
                            style={{ background:'#fee2e2', color:'#991b1b', border:'none', borderRadius:6, padding:'.35rem .8rem', fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
                            🗑️ Remove
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize:'.72rem', color:'var(--text-3)', marginTop:'.5rem' }}>Falls back to 📚 when unset</p>
                    </div>
                  </div>
                </div>

                <button className="btn btn-primary" disabled={savingSettings} onClick={saveSettings}>
                  {savingSettings ? 'Saving…' : '💾 Save Branding'}
                </button>

                {/* ADMIN LOGIN CREDENTIALS */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginTop:'2rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'.25rem' }}>🔐 Admin Login Credentials</div>
                  <p style={{ fontSize:'.8rem', color:'var(--text-2)', marginBottom:'1.25rem' }}>
                    Change the username/email and/or password used to log in to this dashboard. Your current password is required to confirm the change.
                  </p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1rem', maxWidth:680 }}>
                    <div className="form-group">
                      <label className="form-label">New Username / Email <span style={{ color:'var(--text-3)', fontWeight:400 }}>(leave blank to keep current)</span></label>
                      <input type="text" placeholder="newadmin@example.com" value={credForm.newEmail}
                        onChange={e=>setCredForm({...credForm, newEmail: e.target.value})} />
                    </div>
                    <div />
                    <div className="form-group">
                      <label className="form-label">New Password <span style={{ color:'var(--text-3)', fontWeight:400 }}>(leave blank to keep current)</span></label>
                      <input type="password" placeholder="At least 6 characters" value={credForm.newPassword}
                        onChange={e=>setCredForm({...credForm, newPassword: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input type="password" placeholder="Repeat new password" value={credForm.confirmPassword}
                        onChange={e=>setCredForm({...credForm, confirmPassword: e.target.value})} />
                    </div>
                    <div className="form-group" style={{ gridColumn:'1 / -1', maxWidth:320 }}>
                      <label className="form-label">Current Password <span style={{ color:'#ef4444' }}>*required</span></label>
                      <input type="password" placeholder="Confirm it's you" value={credForm.currentPassword}
                        onChange={e=>setCredForm({...credForm, currentPassword: e.target.value})} />
                    </div>
                  </div>
                  <button className="btn btn-primary" disabled={savingCreds} onClick={saveCredentials} style={{ marginTop:'.5rem' }}>
                    {savingCreds ? 'Updating…' : '🔐 Update Credentials'}
                  </button>
                  <p style={{ fontSize:'.76rem', color:'var(--text-3)', marginTop:'.75rem' }}>
                    ⚠️ You'll keep using your current session until it expires, but next time you log out, use the new username/password.
                  </p>
                </div>

                {/* DANGER ZONE — RESET ALL DATA */}
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'var(--radius)', padding:'1.5rem', marginTop:'2rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'.25rem', color:'#991b1b' }}>⚠️ Danger Zone</div>
                  <p style={{ fontSize:'.8rem', color:'#b91c1c', marginBottom:'1.25rem' }}>
                    Permanently erase every booking, seat, review, and feedback entry, and reset branding, location, pricing, and payment settings back to factory defaults — like restoring the app to a brand-new install. <strong>This cannot be undone.</strong> Your admin login stays exactly the same, so you won't be locked out afterwards.
                  </p>
                  <button className="btn" style={{ background:'#dc2626', color:'#fff' }} onClick={()=>setResetModalOpen(true)}>
                    🗑️ Reset All Data
                  </button>
                </div>

                {/* RESET CONFIRMATION MODAL */}
                <AnimatePresence>
                  {resetModalOpen && (
                    <motion.div
                      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}
                      onClick={()=>!resetting && setResetModalOpen(false)}
                    >
                      <motion.div
                        initial={{opacity:0,scale:.94,y:10}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.94}}
                        style={{ background:'var(--white)', borderRadius:'var(--radius)', padding:'1.75rem', width:400, maxWidth:'92vw' }}
                        onClick={e=>e.stopPropagation()}
                      >
                        <h3 style={{ fontSize:'1.1rem', marginBottom:'.4rem', color:'#991b1b' }}>⚠️ Reset All Data?</h3>
                        <p style={{ fontSize:'.83rem', color:'var(--text-2)', marginBottom:'1.1rem', lineHeight:1.5 }}>
                          This will permanently delete <strong>every booking, seat, review, and feedback entry</strong>, and reset <strong>branding, location, pricing, and payment settings</strong> back to factory defaults. <strong>This action cannot be undone.</strong>
                        </p>
                        <div className="form-group">
                          <label className="form-label">Type <strong>RESET</strong> to confirm</label>
                          <input placeholder="RESET" value={resetConfirmText}
                            onChange={e=>setResetConfirmText(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Your Password</label>
                          <input type="password" placeholder="Confirm it's you" value={resetPassword}
                            onChange={e=>setResetPassword(e.target.value)} />
                        </div>
                        <div style={{ display:'flex', gap:'.6rem', marginTop:'1rem' }}>
                          <button className="btn btn-secondary" style={{ flex:1 }} disabled={resetting}
                            onClick={()=>{ setResetModalOpen(false); setResetPassword(''); setResetConfirmText(''); }}>
                            Cancel
                          </button>
                          <button className="btn" style={{ flex:1, background:'#dc2626', color:'#fff' }}
                            disabled={resetting || resetConfirmText.trim().toUpperCase()!=='RESET'} onClick={performReset}>
                            {resetting ? 'Resetting…' : 'Yes, Erase Everything'}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                </>)}

                {/* ═══════════════════ LOCATION & CONTACT ═══════════════════ */}
                {settingsTab === 'location' && (<>
                <p className="settings-page-intro">The city name updates everywhere it appears across the site (page titles, hero tag, footers). The details below show on the Contact page.</p>

                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'1.25rem' }}>📍 Location & Contact</div>
                  <div className="form-group" style={{ maxWidth:320, marginBottom:'1.25rem' }}>
                    <label className="form-label">🏙️ City</label>
                    <input placeholder="Chh Sambhajinagar" value={settingsForm.city ?? ''}
                      onChange={e=>setSettingsForm({...settingsForm, city: e.target.value})} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1rem' }}>
                    <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                      <label className="form-label">📍 Full Address</label>
                      <textarea rows={2} placeholder="Ajab Nagar, Chh. Sambhajinagar, Maharashtra 431001" value={settingsForm.address ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, address: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📞 Phone</label>
                      <input placeholder="+91 98765 43210" value={settingsForm.contactPhone ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, contactPhone: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📧 Email</label>
                      <input type="email" placeholder="info@readspace.in" value={settingsForm.contactEmail ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, contactEmail: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🕐 Hours</label>
                      <input placeholder="Mon–Sat: 6:00 AM – 11:00 PM" value={settingsForm.contactHours ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, contactHours: e.target.value})} />
                    </div>
                    <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                      <label className="form-label">🗺️ Google Maps Link</label>
                      <input placeholder="https://www.google.com/maps/embed?pb=..." value={settingsForm.mapEmbedUrl ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, mapEmbedUrl: e.target.value})} />
                      <p style={{ fontSize:'.72rem', color:'var(--text-3)', marginTop:'.4rem', lineHeight:1.5 }}>
                        ⚠️ Short <code>maps.app.goo.gl</code> "Share" links won't work here — Google blocks them from loading inside the site. Use the <strong>Embed</strong> link instead:
                        Google Maps → search your location → <strong>Share</strong> button → switch to the <strong>"Embed a map"</strong> tab → click <strong>Copy HTML</strong>, then paste just the web address that's inside <code>src="..."</code> into this field.
                      </p>
                    </div>
                  </div>
                </div>

                {/* SOCIAL MEDIA LINKS */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'.25rem' }}>🔗 Social Media Links</div>
                  <p style={{ fontSize:'.8rem', color:'var(--text-2)', marginBottom:'1.25rem' }}>
                    Paste a profile link for any platform you use — only platforms you fill in show as icons on the Contact page. Leave a field blank to hide that icon.
                  </p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1rem' }}>
                    <div className="form-group">
                      <label className="form-label">📸 Instagram</label>
                      <input placeholder="https://instagram.com/yourpage" value={settingsForm.instagramUrl ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, instagramUrl: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">💼 LinkedIn</label>
                      <input placeholder="https://linkedin.com/company/yourpage" value={settingsForm.linkedinUrl ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, linkedinUrl: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📘 Facebook</label>
                      <input placeholder="https://facebook.com/yourpage" value={settingsForm.facebookUrl ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, facebookUrl: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">▶️ YouTube</label>
                      <input placeholder="https://youtube.com/@yourchannel" value={settingsForm.youtubeUrl ?? ''}
                        onChange={e=>setSettingsForm({...settingsForm, youtubeUrl: e.target.value})} />
                    </div>
                  </div>
                </div>

                <button className="btn btn-primary" disabled={savingSettings} onClick={saveSettings}>
                  {savingSettings ? 'Saving…' : '💾 Save Location & Contact'}
                </button>
                </>)}

                {/* ═══════════════════ SEAT SETTINGS ═══════════════════ */}
                {settingsTab === 'seats' && (<>
                <p className="settings-page-intro">Control how many seats are shown to students on the booking page. Shrinking never deletes any existing booking data — it just hides the extra seats.</p>

                {/* ZONE AVAILABILITY */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'.4rem' }}>🔀 Zone Availability</div>
                  <p style={{ fontSize:'.8rem', color:'var(--text-3)', marginBottom:'1.1rem' }}>
                    Only offer one zone? Turn the other off — it disappears from the booking page, homepage and pricing everywhere on the site. At least one zone must stay on.
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'1.5rem' }}>
                    {[
                      { key:'acEnabled',    icon:'❄️', label:'AC Zone' },
                      { key:'nonAcEnabled', icon:'🌿', label:'Non-AC Zone' },
                    ].map(({key,icon,label}) => {
                      const on = settingsForm[key] !== false;
                      const otherKey = key === 'acEnabled' ? 'nonAcEnabled' : 'acEnabled';
                      const isLastOne = on && settingsForm[otherKey] === false;
                      return (
                        <label key={key} style={{ display:'flex', alignItems:'center', gap:'.6rem', cursor: isLastOne ? 'not-allowed' : 'pointer', opacity: isLastOne ? .6 : 1 }}
                          title={isLastOne ? 'At least one zone must stay enabled' : ''}>
                          <input type="checkbox" checked={on} disabled={isLastOne}
                            onChange={e => setSettingsForm({ ...settingsForm, [key]: e.target.checked })}
                            style={{ width:18, height:18 }} />
                          <span style={{ fontWeight:600, fontSize:'.88rem' }}>{icon} {label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* FLOORS & HALLS */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'.4rem' }}>🏢 Floors & Halls</div>
                  <p style={{ fontSize:'.8rem', color:'var(--text-3)', marginBottom:'1.1rem' }}>
                    Only have one floor? Just edit "Floor 1" below with your seat range — nothing else changes. Add more floors
                    if you have multiple physical floors or halls; a filter automatically appears on the booking page once you have more than one.
                    Leave AC or Non-AC blank (0) on a floor if it doesn't have that zone.
                  </p>
                  {(settingsForm.floors || []).map((floor, i) => (
                    <div key={i} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'1rem', marginBottom:'1rem' }}>
                      <div style={{ display:'flex', gap:'.75rem', alignItems:'flex-end', marginBottom:'.75rem', flexWrap:'wrap' }}>
                        <div className="form-group" style={{ flex:'1 1 200px', marginBottom:0 }}>
                          <label className="form-label">Floor / Hall Name</label>
                          <input placeholder="e.g. Floor 1, Ground Floor - Hall A" value={floor.name || ''}
                            onChange={e => {
                              const next = [...settingsForm.floors];
                              next[i] = { ...next[i], name: e.target.value };
                              setSettingsForm({ ...settingsForm, floors: next });
                            }} />
                        </div>
                        <button
                          disabled={(settingsForm.floors || []).length <= 1}
                          title={(settingsForm.floors || []).length <= 1 ? 'At least one floor is required' : 'Remove this floor'}
                          onClick={() => {
                            if ((settingsForm.floors || []).length <= 1) return toast.error('At least one floor is required');
                            if (!window.confirm(`Remove "${floor.name || 'this floor'}"? Its seats stay in the system (never deleted) but will no longer show up under this floor filter.`)) return;
                            setSettingsForm({ ...settingsForm, floors: settingsForm.floors.filter((_, idx) => idx !== i) });
                          }}
                          style={{ background:'#fee2e2', color:'#991b1b', border:'none', borderRadius:6, padding:'.6rem .9rem', fontSize:'.78rem', fontWeight:600, cursor: (settingsForm.floors||[]).length<=1 ? 'not-allowed':'pointer', opacity: (settingsForm.floors||[]).length<=1 ? .5 : 1 }}>
                          🗑️ Remove Floor
                        </button>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'.75rem' }}>
                        <div className="form-group" style={{ marginBottom:0 }}>
                          <label className="form-label">❄️ AC From</label>
                          <input type="number" min={0} value={floor.acFrom ?? 0}
                            onChange={e => { const next=[...settingsForm.floors]; next[i]={...next[i], acFrom: e.target.value}; setSettingsForm({...settingsForm, floors: next}); }} />
                        </div>
                        <div className="form-group" style={{ marginBottom:0 }}>
                          <label className="form-label">❄️ AC To</label>
                          <input type="number" min={0} value={floor.acTo ?? 0}
                            onChange={e => { const next=[...settingsForm.floors]; next[i]={...next[i], acTo: e.target.value}; setSettingsForm({...settingsForm, floors: next}); }} />
                        </div>
                        <div className="form-group" style={{ marginBottom:0 }}>
                          <label className="form-label">🌿 Non-AC From</label>
                          <input type="number" min={0} value={floor.nonAcFrom ?? 0}
                            onChange={e => { const next=[...settingsForm.floors]; next[i]={...next[i], nonAcFrom: e.target.value}; setSettingsForm({...settingsForm, floors: next}); }} />
                        </div>
                        <div className="form-group" style={{ marginBottom:0 }}>
                          <label className="form-label">🌿 Non-AC To</label>
                          <input type="number" min={0} value={floor.nonAcTo ?? 0}
                            onChange={e => { const next=[...settingsForm.floors]; next[i]={...next[i], nonAcTo: e.target.value}; setSettingsForm({...settingsForm, floors: next}); }} />
                        </div>
                      </div>
                      <p style={{ fontSize:'.74rem', color:'var(--text-3)', marginTop:'.6rem' }}>
                        {(Number(floor.acTo)||0) >= (Number(floor.acFrom)||0) && (Number(floor.acFrom)||0) > 0
                          ? `❄️ ${Math.max(0,(Number(floor.acTo)||0)-(Number(floor.acFrom)||0)+1)} AC seats (${floor.acFrom}–${floor.acTo})`
                          : '❄️ No AC seats on this floor'}
                        {' · '}
                        {(Number(floor.nonAcTo)||0) >= (Number(floor.nonAcFrom)||0) && (Number(floor.nonAcFrom)||0) > 0
                          ? `🌿 ${Math.max(0,(Number(floor.nonAcTo)||0)-(Number(floor.nonAcFrom)||0)+1)} Non-AC seats (${floor.nonAcFrom}–${floor.nonAcTo})`
                          : '🌿 No Non-AC seats on this floor'}
                      </p>
                    </div>
                  ))}
                  <button onClick={() => setSettingsForm({ ...settingsForm, floors: [...(settingsForm.floors || []), { id: '', name: `Floor ${(settingsForm.floors||[]).length + 1}`, acFrom: 0, acTo: 0, nonAcFrom: 0, nonAcTo: 0 }] })}
                    style={{ background:'var(--lighter)', border:'1px solid var(--border)', borderRadius:6, padding:'.55rem 1rem', fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>
                    + Add Floor
                  </button>
                  <p style={{ fontSize:'.76rem', color:'var(--text-3)', marginTop:'.9rem' }}>
                    Seat numbers can't overlap between floors within the same zone (e.g. two floors can't both claim AC seat 105) — you'll get an error on save if they do. Shrinking a range never deletes existing booking data, it just stops showing those extra seats.
                  </p>
                </div>

                <button className="btn btn-primary" disabled={savingSettings} onClick={saveSettings}>
                  {savingSettings ? 'Saving…' : '💾 Save Floors & Seats'}
                </button>
                </>)}

                {/* ═══════════════════ PRICING ═══════════════════ */}
                {settingsTab === 'pricing' && (<>
                <p className="settings-page-intro">Change the price per zone here — it updates every seat and the public booking page immediately, no code changes needed.</p>

                {/* MONTHLY FEES */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'1.25rem' }}>💰 Monthly Fees</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1rem' }}>
                    <div className="form-group">
                      <label className="form-label">❄️ AC Price (₹/month)</label>
                      <input type="number" min={0} value={settingsForm.acPrice}
                        onChange={e=>setSettingsForm({...settingsForm, acPrice: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🌿 Non-AC Price (₹/month)</label>
                      <input type="number" min={0} value={settingsForm.nonAcPrice}
                        onChange={e=>setSettingsForm({...settingsForm, nonAcPrice: e.target.value})} />
                    </div>
                  </div>
                  <p style={{ fontSize:'.76rem', color:'var(--text-3)', marginTop:'.75rem' }}>
                    ⚠️ This only changes the listed price for future bookings and renewals — amounts already recorded on past bookings are left untouched.
                  </p>
                </div>

                <button className="btn btn-primary" disabled={savingSettings} onClick={saveSettings}>
                  {savingSettings ? 'Saving…' : '💾 Save Pricing'}
                </button>
                </>)}

                {/* ═══════════════════ PAYMENTS ═══════════════════ */}
                {settingsTab === 'payments' && (<>
                <p className="settings-page-intro">Upload separate UPI QR codes for each zone. Students see the matching QR when they book a seat in that zone.</p>

                {/* PAYMENT QR CODES */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'1.25rem' }}>📱 Payment QR Codes</div>
                  <div className="form-group" style={{ maxWidth:320, marginBottom:'1.25rem' }}>
                    <label className="form-label">UPI ID (shown under both QR codes)</label>
                    <input placeholder="yourname@upi" value={settingsForm.upiId}
                      onChange={e=>setSettingsForm({...settingsForm, upiId: e.target.value})} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1.5rem' }}>
                    {[
                      { key:'acQrImage',    label:'❄️ AC Zone QR',     zoneOn: settingsForm.acEnabled    !== false },
                      { key:'nonAcQrImage', label:'🌿 Non-AC Zone QR', zoneOn: settingsForm.nonAcEnabled !== false },
                    ].filter(z => z.zoneOn).map(({key,label}) => (
                      <div key={key} style={{ border:'1px dashed var(--border)', borderRadius:'var(--radius)', padding:'1rem', textAlign:'center' }}>
                        <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:'.6rem' }}>{label}</div>
                        {settingsForm[key]
                          ? <img src={settingsForm[key]} alt={label} style={{ width:110, height:110, objectFit:'contain', margin:'0 auto .75rem', display:'block', borderRadius:8, border:'1px solid var(--border)' }} />
                          : <div style={{ width:110, height:110, margin:'0 auto .75rem', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-3)', fontSize:'.75rem', background:'var(--lighter)', borderRadius:8 }}>No QR yet</div>}
                        <div style={{ display:'flex', gap:'.5rem', justifyContent:'center' }}>
                          <label style={{ background:'var(--lighter)', border:'1px solid var(--border)', borderRadius:6, padding:'.35rem .8rem', fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
                            📤 Upload
                            <input type="file" accept="image/*" style={{ display:'none' }}
                              onChange={e=>handleQrUpload(key, e.target.files?.[0])} />
                          </label>
                          {settingsForm[key] && (
                            <button onClick={()=>setSettingsForm({...settingsForm, [key]: null})}
                              style={{ background:'#fee2e2', color:'#991b1b', border:'none', borderRadius:6, padding:'.35rem .8rem', fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
                              🗑️ Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="btn btn-primary" disabled={savingSettings} onClick={saveSettings}>
                  {savingSettings ? 'Saving…' : '💾 Save Payments'}
                </button>
                </>)}

                {/* ═══════════════════ GALLERY ═══════════════════ */}
                {settingsTab === 'gallery' && (<>
                <p className="settings-page-intro">
                  Upload the photos students see on the public Gallery page. Group them under a category — pick one you've
                  already used, or type a brand new one (e.g. "Rooftop", "Cabin Section") and it'll show up as its own filter automatically.
                </p>

                {/* ADD PHOTO */}
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'1.5rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontWeight:700, marginBottom:'1.25rem' }}>➕ Add a Photo</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1rem', marginBottom:'1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Category *</label>
                      <input list="gallery-tag-options" placeholder="e.g. AC Zone" value={galleryForm.tag}
                        onChange={e=>setGalleryForm({...galleryForm, tag: e.target.value})} />
                      <datalist id="gallery-tag-options">
                        {[...new Set(galleryImages.map(g => g.tag))].map(t => <option key={t} value={t} />)}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Caption (optional)</label>
                      <input placeholder="e.g. Main AC Reading Hall" value={galleryForm.label}
                        onChange={e=>setGalleryForm({...galleryForm, label: e.target.value})} />
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap' }}>
                    {galleryForm.image
                      ? <img src={galleryForm.image} alt="preview" style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)' }} />
                      : <div style={{ width:64, height:64, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-3)', fontSize:'.7rem', background:'var(--lighter)', borderRadius:8 }}>No photo</div>}
                    <label style={{ background:'var(--lighter)', border:'1px solid var(--border)', borderRadius:6, padding:'.45rem 1rem', fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>
                      📤 Choose Photo
                      <input type="file" accept="image/*" style={{ display:'none' }}
                        onChange={e=>handleGalleryImageUpload(e.target.files?.[0])} />
                    </label>
                    {galleryForm.image && (
                      <button onClick={()=>setGalleryForm({...galleryForm, image: null})}
                        style={{ background:'#fee2e2', color:'#991b1b', border:'none', borderRadius:6, padding:'.45rem .8rem', fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
                        🗑️ Remove
                      </button>
                    )}
                    <button className="btn btn-primary" style={{ marginLeft:'auto' }} disabled={savingGalleryImage} onClick={addGalleryImage}>
                      {savingGalleryImage ? 'Adding…' : '+ Add to Gallery'}
                    </button>
                  </div>
                </div>

                {/* EXISTING PHOTOS, GROUPED BY CATEGORY */}
                {galleryImages.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-3)', background:'var(--white)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
                    🖼️ No photos yet — add the first one above
                  </div>
                ) : (
                  [...new Set(galleryImages.map(g => g.tag))].map(tag => (
                    <div key={tag} style={{ marginBottom:'1.5rem' }}>
                      <div style={{ fontWeight:700, fontSize:'.85rem', marginBottom:'.75rem', color:'var(--text-2)' }}>
                        {tag} <span style={{ color:'var(--text-3)', fontWeight:400 }}>({galleryImages.filter(g=>g.tag===tag).length})</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'1rem' }}>
                        {galleryImages.filter(g => g.tag === tag).map(img => (
                          <div key={img.id} style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                            <img src={img.image} alt={img.label || tag} style={{ width:'100%', height:100, objectFit:'cover', display:'block' }} />
                            <div style={{ padding:'.5rem .6rem' }}>
                              <div style={{ fontSize:'.75rem', color:'var(--text-2)', marginBottom:'.4rem', minHeight:'1.1em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{img.label || '—'}</div>
                              <button onClick={()=>deleteGalleryImage(img.id)}
                                style={{ width:'100%', background:'#fee2e2', color:'#991b1b', border:'none', borderRadius:6, padding:'.3rem', fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                </>)}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
