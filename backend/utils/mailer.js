const nodemailer = require('nodemailer');

// One shared SMTP transporter, built lazily so a missing .env config only
// breaks the forgot-password flow (not the whole server on boot).
// Configure via .env: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured on the server — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true', // true for port 465 (SSL), false for 587/others (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendPasswordResetEmail({ to, resetUrl, companyName = 'ReadSpace' }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({
    from: `"${companyName}" <${from}>`,
    to,
    subject: `Reset your ${companyName} admin password`,
    html: `
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
    `,
  });
}

module.exports = { sendPasswordResetEmail };
