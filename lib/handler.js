/* POST /api/submit — used by both the Vercel function and the local dev server. */
const fs = require('fs');
const path = require('path');
const { parseSubmission, HttpError, newId } = require('./submission');
const { buildAll, buildCombined } = require('./pdf');
const mail = require('./mail');

const MAX_BODY = 4 * 1024 * 1024;

// Best-effort abuse guard (per warm instance). The real protection is that mail only ever goes to the company.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 8;
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', Buffer.byteLength(json));
  res.end(json);
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || '')
    .split(',')[0]
    .trim();

async function handleSubmit(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  let copy = null;
  try {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, 'Invalid request');
    }

    // Honeypot: real users never fill this hidden field.
    if (body && body.website) return send(res, 200, { ok: true, id: 'RS-OK' });

    if (rateLimited(ip)) throw new HttpError(429, 'Too many submissions. Please wait a few minutes and try again.');

    const { values, signatures } = parseSubmission(body);
    const id = newId();
    const submittedAt = new Date();

    const files = await buildAll({ values, submittedAt, id, ip }, signatures);
    const combined = await buildCombined(files, values.fullName);
    copy = { filename: combined.filename, base64: Buffer.from(combined.bytes).toString('base64') };

    if (mail.configured()) {
      await mail.sendApplication({ files, values, id, ip, submittedAt });
    } else if (process.env.DRY_RUN === '1') {
      const dir = path.join(__dirname, '..', 'out', 'submissions', id);
      fs.mkdirSync(dir, { recursive: true });
      files.forEach((f) => fs.writeFileSync(path.join(dir, f.filename), f.bytes));
      console.log(`[dry-run] ${id} saved to ${dir} (would email: ${mail.recipients()})`);
    } else {
      console.error('Email is not configured: set SMTP_USER and SMTP_PASS.');
      throw new HttpError(503, 'Submissions are temporarily unavailable. Please download your copy and contact the company.', { copy });
    }

    return send(res, 200, { ok: true, id, copy });
  } catch (err) {
    if (err instanceof HttpError) {
      return send(res, err.status, { ok: false, error: err.message, ...err.extra });
    }
    // Never log request bodies: they contain SSNs.
    console.error('Submit failed:', err && err.code ? err.code : '', err && err.message);
    return send(res, 502, {
      ok: false,
      error: 'We could not send your application right now. Please try again, or download your copy below and email it to the company.',
      copy,
    });
  }
}

module.exports = { handleSubmit, send };
