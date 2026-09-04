const nodemailer = require('nodemailer');

const GMAIL_USER = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
const GMAIL_PASS = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').trim();
const NOTIFY_EMAIL = (process.env.NOTIFY_EMAIL || 'queencityconnect674@gmail.com').trim();

function mailConfigured() {
  return Boolean(GMAIL_USER && GMAIL_PASS);
}

function getTransport() {
  if (!mailConfigured()) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) {
    console.log(`[mail skipped] ${subject} -> ${to}`);
    return false;
  }
  await transport.sendMail({
    from: `QueenCityConnect <${GMAIL_USER}>`,
    to,
    subject,
    text,
    html: html || `<pre style="font-family:Georgia,serif;white-space:pre-wrap;font-size:15px;line-height:1.5">${String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre>`
  });
  return true;
}

async function notifyNewAccount(user, method, baseUrl) {
  const name = user.name || 'Neighbor';
  const email = user.email;
  const how = method === 'google' ? 'Google' : 'email and password';
  const signin = `${baseUrl}/signin.html`;
  const saves = `${baseUrl}/saved.html`;
  await sendMail({
    to: email,
    subject: 'Welcome to QueenCityConnect',
    text: `Hi ${name},\n\nYour QueenCityConnect account is ready. Sign in from any device to keep saved opportunities, filters, and activity with you.\n\nSign in: ${signin}\nMy Saves: ${saves}\n\nYou signed up with ${how}.\n\n— QueenCityConnect, Charlotte`
  });
  if (NOTIFY_EMAIL && NOTIFY_EMAIL.toLowerCase() !== String(email).toLowerCase()) {
    await sendMail({
      to: NOTIFY_EMAIL,
      subject: `New QueenCityConnect account: ${name}`,
      text: `A new account was created.\n\nName: ${name}\nEmail: ${email}\nMethod: ${how}\nTime: ${new Date().toISOString()}`
    });
  }
}

module.exports = {
  sendMail,
  notifyNewAccount,
  mailConfigured,
  NOTIFY_EMAIL
};
