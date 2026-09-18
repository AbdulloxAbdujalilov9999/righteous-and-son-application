/* /api/pdf — POST validates the application, builds the PDFs and (if email is configured) emails them to the company.
 * GET reports whether email is configured. Nothing is stored. Used by Vercel and the local server. */
const { parseSubmission, HttpError, newId } = require('./submission');
const { buildAll, buildCombined } = require('./pdf');
const mail = require('./mail');

const MAX_BODY = 4 * 1024 * 1024;

// Best-effort abuse guard (per warm instance).
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 20;
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

const b64 = (bytes) => Buffer.from(bytes).toString('base64');

async function handlePdf(req, res) {
  // The page asks this once so the last button can say "Submit application" only when email is really set up.
  if (req.method === 'GET') return send(res, 200, { ok: true, emailEnabled: mail.configured() });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  try {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, 'Invalid request');
    }

    // Honeypot: real users never fill this hidden field.
    if (body && body.website) return send(res, 200, { ok: true, id: 'RS-OK', files: [] });

    if (rateLimited(ip)) throw new HttpError(429, 'Too many requests. Please wait a few minutes and try again.');

    const { values, signatures } = parseSubmission(body);
    const id = newId();
    const submittedAt = new Date();
    const files = await buildAll({ values, submittedAt, id, ip }, signatures);
    const combined = await buildCombined(files, values.fullName);
    const copy = { filename: combined.filename, base64: b64(combined.bytes) };

    // If email is configured, send the application to the company; otherwise the applicant downloads and emails it.
    let sent = false;
    if (mail.configured()) {
      try {
        await mail.sendApplication({ files, values, id, ip, submittedAt });
        sent = true;
      } catch (e) {
        console.error('Email failed:', (e && e.code) || '', e && e.message);
        return send(res, 502, { ok: false, error: 'We could not send your application right now. Please try again in a moment.', copy });
      }
    }

    return send(res, 200, {
      ok: true,
      id,
      sent,
      // Only needed when the applicant has to send it themselves: the three forms separately (the PSP form must stay
      // stand-alone) plus one combined file. After an automatic email, the combined copy is enough.
      files: sent ? [] : files.map((f) => ({ filename: f.filename, base64: b64(f.bytes) })),
      copy,
    });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { ok: false, error: err.message, ...err.extra });
    // Never log request bodies: they contain SSNs.
    console.error('PDF build failed:', err && err.message);
    return send(res, 500, { ok: false, error: 'We could not create your PDF right now. Please try again in a moment.' });
  }
}

module.exports = { handlePdf, send };
