const nodemailer = require('nodemailer');

// Email sender for the admin "Forgot Password" flow.
//
// Render's free tier blocks outbound SMTP ports (25/465/587), so Gmail SMTP
// works locally but hangs when hosted. To fix that:
//   • If RESEND_API_KEY is set → send through Resend's HTTPS API (works on Render).
//   • Otherwise → fall back to SMTP (fine for local dev), with short timeouts
//     so a blocked port fails fast instead of leaving the request "pending".

function buildHtml({ resetUrl, companyName }) {
  return `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:28px 24px;">
        <h2 style="color:#1e293b;margin-bottom:8px;">Reset your admin password</h2>
        <p style="color:#475569;font-size:14px;line-height:1.6;">
          We received a request to reset the password for your <strong>${companyName}</strong> admin dashboard.
          This link is valid for <strong>1 hour</strong>.
        </p>
        <p style="margin:26px 0;">
          <a href="${resetUrl}" style="background:#4f46e5;color:#ffffff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">Reset Password</a>
        </p>
        <p style="color:#94a3b8;font-size:12px;line-height:1.5;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <span style="word-break:break-all;">${resetUrl}</span>
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px;">
          Didn't request this? You can safely ignore this email — your password won't change.
        </p>
      </div>
    `;
}

// ── Option A: Resend (HTTPS) ──────────────────────────────
async function sendViaResend({ to, subject, html, from }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Option B: SMTP (local dev) ────────────────────────────
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured — set RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS');
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
}

async function sendPasswordResetEmail({ to, resetUrl, companyName = 'ReadSpace' }) {
  const subject = `Reset your ${companyName} admin password`;
  const html = buildHtml({ resetUrl, companyName });

  if (process.env.RESEND_API_KEY) {
    // With no verified domain, Resend only allows this sender address:
    const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
    return sendViaResend({ to, subject, html, from: `${companyName} <${from}>` });
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({ from: `"${companyName}" <${from}>`, to, subject, html });
}

module.exports = { sendPasswordResetEmail };