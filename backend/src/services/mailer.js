import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

let transporter

function getTransporter() {
  if (!transporter && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    })
  }
  return transporter
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendLink({ to, subject, text, html }) {
  const client = getTransporter()
  const recipientDomain = (to || '').split('@')[1] || 'unknown'

  if (!client) {
    logger.info('mail_fallback', { subject, recipientDomain })
    return { success: true, fallback: true }
  }

  try {
    await client.sendMail({
      from: env.SMTP_FROM || 'UniHub <no-reply@silicon.ac.in>',
      to,
      subject,
      text,
      html: html || undefined,
    })
    return { success: true }
  } catch (error) {
    logger.error('mail_delivery_failed', {
      subject,
      recipientDomain,
      error: error.message,
    })
    return { success: false, error: error.message }
  }
}

/**
 * Sends a structured, branded notification email when staff replies to a request or report.
 */
export async function sendAdminReplyEmail({
  to,
  recipientName = 'Student',
  itemType = 'Request',
  itemTitle = 'Academic Resource',
  adminReply = '',
  status = 'RESOLVED',
  viewUrl = '',
}) {
  const safeTitle = escapeHtml(itemTitle)
  const safeReply = escapeHtml(adminReply)
  const safeStatus = escapeHtml(status)
  const safeName = escapeHtml(recipientName)
  const targetUrl = viewUrl || env.CLIENT_URL

  const subject = `UniHub: Update on Your ${itemType}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f5f2eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2b25;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d8e0db;border-radius:8px;padding:32px;box-shadow:0 4px 14px rgba(0,0,0,0.04);">
    <div style="border-bottom:2px solid #ed6b4e;padding-bottom:12px;margin-bottom:24px;">
      <span style="font-family:serif;font-size:24px;font-weight:bold;color:#1b2b25;letter-spacing:-0.5px;">UniHub</span>
      <span style="font-size:11px;font-family:monospace;color:#6b7280;margin-left:8px;text-transform:uppercase;">Academic Community</span>
    </div>

    <h2 style="font-family:serif;font-size:20px;color:#1b2b25;margin:0 0 12px;">Update on your ${escapeHtml(itemType.toLowerCase())}</h2>
    <p style="font-size:14px;color:#4b5563;line-height:1.5;margin:0 0 16px;">Hello ${safeName},</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.5;margin:0 0 20px;">
      An administrator or moderation staff member has responded to your submission regarding <strong>"${safeTitle}"</strong>.
    </p>

    <div style="background:#f9f8f5;border-left:4px solid #ed6b4e;padding:16px 20px;border-radius:4px;margin-bottom:20px;">
      <div style="font-size:11px;font-family:monospace;text-transform:uppercase;color:#8a5717;margin-bottom:6px;">
        Status: <span style="font-weight:bold;">${safeStatus}</span>
      </div>
      <div style="font-size:14px;color:#1b2b25;line-height:1.6;white-space:pre-wrap;">${safeReply}</div>
    </div>

    <div style="margin:28px 0 20px;">
      <a href="${escapeHtml(targetUrl)}" style="display:inline-block;background:#ed6b4e;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:10px 20px;border-radius:6px;">
        View in UniHub ↗
      </a>
    </div>

    <p style="font-size:12px;color:#9ca3af;line-height:1.4;margin:24px 0 0;border-top:1px solid #f0f0f0;padding-top:16px;">
      You received this notification because you submitted a request or report on UniHub.<br />
      If you need additional help, contact your campus moderators.
    </p>
  </div>
</body>
</html>
  `.trim()

  const text = `
UniHub Update
-------------
Hello ${recipientName},

An administrator has responded to your ${itemType.toLowerCase()}: "${itemTitle}"
Status: ${status}

Staff Response:
${adminReply}

View in UniHub:
${targetUrl}
  `.trim()

  return sendLink({ to, subject, text, html })
}

/**
 * Sends a single-use 6-digit OTP verification email for the university domain.
 */
export async function sendOtpEmail({
  to,
  recipientName = 'Student',
  otp,
  expirationMinutes = 10,
}) {
  const safeName = escapeHtml(recipientName)
  const safeOtp = escapeHtml(otp)
  const subject = 'UniHub: Your University Email Verification Code'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f5f2eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2b25;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #d8e0db;border-radius:8px;padding:32px;box-shadow:0 4px 14px rgba(0,0,0,0.04);">
    <div style="border-bottom:2px solid #ed6b4e;padding-bottom:12px;margin-bottom:24px;">
      <span style="font-family:serif;font-size:24px;font-weight:bold;color:#1b2b25;letter-spacing:-0.5px;">UniHub</span>
      <span style="font-size:11px;font-family:monospace;color:#6b7280;margin-left:8px;text-transform:uppercase;">Email Verification</span>
    </div>

    <h2 style="font-family:serif;font-size:20px;color:#1b2b25;margin:0 0 12px;">Verify your university email</h2>
    <p style="font-size:14px;color:#4b5563;line-height:1.5;margin:0 0 16px;">Hello ${safeName},</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.5;margin:0 0 24px;">
      Use the verification code below to confirm your <strong>silicon.ac.in</strong> email address and start sharing study materials on UniHub:
    </p>

    <div style="text-align:center;background:#f4f7f5;border:1px dashed #6b9a8b;padding:20px;border-radius:6px;margin:0 0 24px;">
      <span style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#1b2b25;">${safeOtp}</span>
      <div style="font-size:12px;color:#6b7280;margin-top:8px;">Valid for ${expirationMinutes} minutes</div>
    </div>

    <p style="font-size:13px;color:#4b5563;line-height:1.5;margin:0 0 20px;">
      Never share this code with anyone. If you did not request this verification, you can safely ignore this email.
    </p>

    <p style="font-size:12px;color:#9ca3af;line-height:1.4;margin:24px 0 0;border-top:1px solid #f0f0f0;padding-top:16px;">
      University Study Hub · Open Knowledge for Campus Students
    </p>
  </div>
</body>
</html>
  `.trim()

  const text = `
UniHub University Email Verification
------------------------------------
Hello ${recipientName},

Your verification code to confirm your university email address is:
${otp}

This code expires in ${expirationMinutes} minutes.

If you did not request this verification code, please disregard this email.
  `.trim()

  return sendLink({ to, subject, text, html })
}
