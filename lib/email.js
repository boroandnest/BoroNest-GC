import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Nest <onboarding@resend.dev>';
const REPLY_TO = process.env.RESEND_REPLY_TO || 'jdavis@boroandnest.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://boroandnestnyc.com';

let resend = null;
if (apiKey) {
  try { resend = new Resend(apiKey); } catch (e) { console.error('Resend init failed', e); }
}

export async function sendInvitationEmail({ toEmail, projectName, invitedByName, roleLabel, message }) {
  if (!resend) { console.warn('Resend not configured'); return { skipped: true }; }
  const acceptUrl = `${APP_URL}/dashboard`;
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      reply_to: REPLY_TO,
      subject: `You're invited to the ${projectName} project room — Boro & Nest`,
      html: buildInvitationHtml({ projectName, invitedByName, roleLabel, message, acceptUrl })
    });
    if (error) { console.error('Resend send error:', error); return { error: error.message }; }
    return { id: data?.id };
  } catch (e) {
    console.error('Resend exception:', e);
    return { error: e.message };
  }
}

export async function sendScopingCallNotice({ contactName, projectAddress, adminEmail, phone, budget, notes }) {
  if (!resend) return { skipped: true };
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail || REPLY_TO,
      reply_to: REPLY_TO,
      subject: `New scoping call request — ${contactName || 'client'}`,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;line-height:1.6;color:#111827">
        <h2 style="color:#2563EB">New Scoping Call Request</h2>
        <p><strong>Name:</strong> ${contactName || 'N/A'}<br/>
        <strong>Phone:</strong> ${phone || 'N/A'}<br/>
        <strong>Project address:</strong> ${projectAddress || 'N/A'}<br/>
        <strong>Budget:</strong> ${budget || 'N/A'}</p>
        ${notes ? `<p><strong>Notes:</strong><br/>${notes}</p>` : ''}
        <p>Log in to the admin console for full details.</p>
      </div>`
    });
    if (error) return { error: error.message };
    return { id: data?.id };
  } catch (e) { return { error: e.message }; }
}

function buildInvitationHtml({ projectName, invitedByName, roleLabel, message, acceptUrl }) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0A0E1A;font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;color:#F5F7FA">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="font-size:22px;font-weight:800;color:#F5F7FA;margin-bottom:32px">Boro <span style="color:#2563EB">&amp;</span> Nest <span style="font-size:11px;color:#94A3B8;letter-spacing:0.15em;margin-left:6px">COLLECTIVE</span></div>
    <div style="background:#12172A;border:1px solid #1F2740;border-radius:12px;padding:32px">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#2563EB">Project Room Invitation</div>
      <h1 style="font-size:24px;font-weight:700;margin:12px 0 8px;color:#F5F7FA">You've been invited to<br/>${projectName}</h1>
      <p style="color:#94A3B8;font-size:15px;line-height:1.5;margin:16px 0"><strong style="color:#F5F7FA">${invitedByName}</strong> invited you to join the <strong style="color:#F5F7FA">${projectName}</strong> project room as a <strong style="color:#93B4FF">${roleLabel}</strong>.</p>
      ${message ? `<div style="background:#0A0E1A;border-left:3px solid #2563EB;padding:12px 16px;border-radius:4px;margin:20px 0;color:#C0C7D2;font-size:14px;font-style:italic">"${message}"</div>` : ''}
      <p style="color:#94A3B8;font-size:14px">Once you accept, you'll have access to messages, documents, milestones, photos, and change orders for this project.</p>
      <a href="${acceptUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:20px">Accept Invitation →</a>
      <p style="color:#7B8494;font-size:12px;margin-top:24px">If you don't have an account yet, create one at <a href="${acceptUrl}" style="color:#93B4FF">${acceptUrl}</a> using this email address.</p>
    </div>
    <div style="text-align:center;margin-top:24px;color:#7B8494;font-size:11px">© Boro &amp; Nest Collective · NYC · <a href="https://boroandnestnyc.com" style="color:#7B8494">boroandnestnyc.com</a></div>
  </div>
</body></html>`;
}
