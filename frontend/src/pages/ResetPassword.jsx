import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useBranding, BrandMark } from '../context/BrandingContext.jsx';

import { API_URL } from '../config.js';

export default function ResetPassword() {
  const { companyName } = useBranding();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return toast.error('This reset link is missing its token — please use the link from your email');
    if (form.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match');

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset password');
      setDone(true);
      toast.success('✅ Password updated');
    } catch (err) {
      toast.error(err.message || 'Could not reset password');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--dark)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse at 50% 50%, rgba(79,70,229,.3) 0%, transparent 65%)' }} />

      <motion.div
        initial={{ opacity:0, y:28 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5 }}
        style={{
          background:'var(--white)', borderRadius:'var(--radius-lg)',
          padding:'2.5rem 2.25rem', width:'100%', maxWidth:420, position:'relative',
          boxShadow:'0 32px 80px rgba(0,0,0,.45)',
        }}
      >
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{
            width:60, height:60,
            background:'linear-gradient(135deg,var(--brand),var(--brand-light))',
            borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'1.8rem', margin:'0 auto .75rem',
            boxShadow:'0 8px 24px rgba(79,70,229,.35)',
          }}>🔑</div>
          <h2 style={{ fontSize:'1.5rem', marginBottom:'.35rem' }}>Reset Password</h2>
          <p style={{ color:'var(--text-2)', fontSize:'.88rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'.35rem' }}>
            <BrandMark size={16} />{companyName} Admin
          </p>
        </div>

        {!token && (
          <p style={{ fontSize:'.85rem', color:'#b91c1c', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'.85rem 1rem', marginBottom:'1.25rem' }}>
            This link is missing its reset token. Please open the reset link directly from your email, or request a new one.
          </p>
        )}

        {!done ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input required type="password" placeholder="At least 6 characters" autoFocus
                value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input required type="password" placeholder="Repeat new password"
                value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !token}
              style={{ width:'100%', padding:'.9rem', fontSize:'1rem', borderRadius:'var(--radius-sm)', marginTop:'.25rem' }}
            >
              {loading ? '⏳ Updating…' : '✅ Set New Password'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>🎉</div>
            <p style={{ fontSize:'.88rem', color:'var(--text-2)', lineHeight:1.6, marginBottom:'1.25rem' }}>
              Your password has been updated. You can now log in with your new password.
            </p>
            <button type="button" onClick={() => navigate('/admin')}
              className="btn btn-primary" style={{ width:'100%', padding:'.85rem', borderRadius:'var(--radius-sm)' }}>
              🔐 Go to Login
            </button>
          </div>
        )}

        <div style={{ textAlign:'center', marginTop:'1.5rem' }}>
          <Link to="/admin" style={{ fontSize:'.83rem', color:'var(--text-3)' }}>← Back to login</Link>
        </div>
      </motion.div>
    </div>
  );
}
