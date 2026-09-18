const nodemailer = require('nodemailer');
const S = require('../public/js/schema.js');

const DEFAULT_TO = 'righteousandson.inc@gmail.com, jscott.righteousandson@gmail.com';

const recipients = () => process.env.MAIL_TO || DEFAULT_TO;
const dryRun = () => process.env.DRY_RUN === '1';
const configured = () => dryRun() || !!(process.env.SMTP_USER && process.env.SMTP_PASS);
const sender = () => process.env.MAIL_FROM || process.env.SMTP_USER || 'applications@localhost';

let cached;
function transport() {
  if (dryRun()) return nodemailer.createTransport({ jsonTransport: true }); // local testing: builds the message, sends nothing
  if (!cached) {
    const port = Number(process.env.SMTP_PORT || 465);
    cached = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return cached;
}

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();

function summary(v) {
  const rows = [
    ['Name', v.fullName],
    ['Phone', v.phone],
    ['Email', v.email],
    ['Position', v.position + (v.ownerOp === 'Yes' && v.position !== 'Owner Operator' ? ' (owner operator / fleet owner)' : '')],
    ['Location applied for', v.location],
    ['Home', v.cityStateZip],
    ['License', [v.lic1Class, v.lic1Authority].filter(Boolean).join(' — ')],
    ['DOT medical card expires', S.fmtDate(v.lic1DotExp)],
  ];
  return rows.filter(([, val]) => val);
}

async function sendApplication({ files, values: v, id, ip, submittedAt }, mailer = null) {
  const name = oneLine(v.fullName);
  const rows = summary(v);
  const when = submittedAt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  const text =
    `New driver application received.\n\n` +
    rows.map(([k, val]) => `${k}: ${oneLine(val)}`).join('\n') +
    `\n\nAttached (${files.length} PDFs):\n` +
    files.map((f) => ` - ${f.filename}`).join('\n') +
    `\n\nSubmission ID: ${id}\nReceived: ${when}\nIP address: ${ip || 'unknown'}\n`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;max-width:560px">` +
    `<h2 style="margin:0 0 4px;font-size:18px">New driver application</h2>` +
    `<p style="margin:0 0 16px;color:#555">${esc(name)} submitted an application to Righteous and Son Inc.</p>` +
    `<table style="border-collapse:collapse;width:100%">` +
    rows.map(([k, val]) => `<tr><td style="padding:6px 10px;border:1px solid #ddd;background:#f6f7f9;width:38%">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #ddd"><strong>${esc(oneLine(val))}</strong></td></tr>`).join('') +
    `</table>` +
    `<p style="margin:16px 0 4px"><strong>Attached PDFs</strong></p><ul style="margin:0;padding-left:18px">` +
    files.map((f) => `<li>${esc(f.filename)}</li>`).join('') +
    `</ul>` +
    `<p style="margin:16px 0 0;color:#777;font-size:12px">Submission ID ${esc(id)} &middot; Received ${esc(when)} &middot; IP ${esc(ip || 'unknown')}</p>` +
    `</div>`;

  return (mailer || transport()).sendMail({
    from: { name: 'Righteous and Son — Applications', address: sender() },
    to: recipients(),
    replyTo: v.email ? { name, address: v.email } : undefined,
    subject: `New Driver Application — ${name}`,
    text,
    html,
    attachments: files.map((f) => ({ filename: f.filename, content: Buffer.from(f.bytes), contentType: 'application/pdf' })),
  });
}

module.exports = { sendApplication, configured, recipients, dryRun };
