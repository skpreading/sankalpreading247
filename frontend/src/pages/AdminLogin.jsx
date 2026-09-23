import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useBranding, BrandMark } from '../context/BrandingContext.jsx';

import { API_URL } from '../config.js';

export default function AdminLogin() {
  const { companyName } = useBranding();
  const [form, setForm]     = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'forgot-sent'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/admin/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('adminToken', data.token);
      // server sends back the exact expiry moment so the dashboard can force
      // a logout at precisely 10 minutes without needing to decode the JWT
      localStorage.setItem('adminTokenExpiry', String(data.expiresAt || (Date.now() + 10 * 60 * 1000)));
      toast.success('Welcome back, Admin! 👋');
      navigate('/admin/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setMode('forgot-sent');
    } catch (err) {
      toast.error(err.message || 'Could not send reset email');
    }
    setForgotLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--dark)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', position: 'relative', overflow: 'hidden',
    }}>
      {/* background glow */}
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse at 50% 50%, rgba(79,70,229,.3) 0%, transparent 65%)' }} />
      <div style={{ position:'absolute', top:'-100px', right:'-100px',
        width:'350px', height:'350px', borderRadius:'50%',
        background:'rgba(99,102,241,.06)', border:'1px solid rgba(99,102,241,.1)' }} />
      <div style={{ position:'absolute', bottom:'-80px', left:'-80px',
        width:'250px', height:'250px', borderRadius:'50%',
        background:'rgba(245,158,11,.05)', border:'1px solid rgba(245,158,11,.08)' }} />

      <motion.div
        initial={{ opacity:0, y:28 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5 }}
        style={{
          background:'var(--white)', borderRadius:'var(--radius-lg)',
          padding:'2.5rem 2.25rem', width:'100%', maxWidth:420, position:'relative',
          boxShadow:'0 32px 80px rgba(0,0,0,.45)',
        }}
      >
        {/* logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{
            width:60, height:60,
            background:'linear-gradient(135deg,var(--brand),var(--brand-light))',
            borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'1.8rem', margin:'0 auto .75rem',
            boxShadow:'0 8px 24px rgba(79,70,229,.35)',
          }}>🛡️</div>
          <h2 style={{ fontSize:'1.5rem', marginBottom:'.35rem' }}>Admin Portal</h2>
          <p style={{ color:'var(--text-2)', fontSize:'.88rem' }}>
            {companyName} Management Dashboard
          </p>
        </div>

        {/* demo credentials hint */}
        

        {mode === 'login' && (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email / Username</label>
            <input
              required autoFocus
              type="email"
              placeholder="Enter Email"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ position:'relative' }}>
            <label className="form-label">Password</label>
            <input
              required
              type={showPass ? 'text' : 'password'}
              placeholder="Enter password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              style={{ paddingRight:'3rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{
                position:'absolute', right:'.75rem', top:'2.05rem',
                background:'none', border:'none', fontSize:'1.1rem',
                cursor:'pointer', color:'var(--text-3)',
              }}
            >{showPass ? '🙈' : '👁️'}</button>
          </div>

          <div style={{ textAlign:'right', marginBottom:'.9rem', marginTop:'-.4rem' }}>
            <button type="button" onClick={() => { setForgotEmail(form.username); setMode('forgot'); }}
              style={{ background:'none', border:'none', color:'var(--brand)', fontSize:'.82rem', fontWeight:600, cursor:'pointer', padding:0 }}>
              Forgot password?
            </button>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width:'100%', padding:'.9rem', fontSize:'1rem', borderRadius:'var(--radius-sm)' }}
          >
            {loading ? '⏳ Signing in…' : '🔐 Login to Dashboard'}
          </button>
        </form>
        )}

        {mode === 'forgot' && (
        <form onSubmit={handleForgotPassword}>
          <p style={{ fontSize:'.85rem', color:'var(--text-2)', marginBottom:'1.25rem', lineHeight:1.5 }}>
            Enter the email address on your admin account and we'll send you a link to reset your password.
          </p>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              required autoFocus
              type="email"
              placeholder="Enter your admin email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={forgotLoading}
            style={{ width:'100%', padding:'.9rem', fontSize:'1rem', borderRadius:'var(--radius-sm)', marginTop:'.25rem' }}
          >
            {forgotLoading ? '⏳ Sending…' : '📧 Send Reset Link'}
          </button>
          <button type="button" onClick={() => setMode('login')}
            style={{ display:'block', margin:'1rem auto 0', background:'none', border:'none', color:'var(--text-3)', fontSize:'.83rem', cursor:'pointer' }}>
            ← Back to login
          </button>
        </form>
        )}

        {mode === 'forgot-sent' && (
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>📬</div>
          <p style={{ fontSize:'.88rem', color:'var(--text-2)', lineHeight:1.6, marginBottom:'1.25rem' }}>
            If <strong>{forgotEmail.trim()}</strong> is registered as the admin email, a password-reset link has been sent — check your inbox (and spam folder). The link expires in 1 hour.
          </p>
          <button type="button" onClick={() => setMode('login')}
            className="btn btn-secondary" style={{ width:'100%', padding:'.85rem', borderRadius:'var(--radius-sm)' }}>
            ← Back to login
          </button>
        </div>
        )}

        <div style={{ textAlign:'center', marginTop:'1.5rem', display:'flex', flexDirection:'column', gap:'.4rem' }}>
          <Link to="/" style={{ fontSize:'.83rem', color:'var(--text-3)' }}>
            ← Back to Website
          </Link>
          <span style={{ fontSize:'.75rem', color:'var(--text-3)' }}>
            Admin access only · Unauthorized access is prohibited
          </span>
        </div>
      </motion.div>
    </div>
  );
}
