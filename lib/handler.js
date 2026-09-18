/* POST /api/pdf — validates the application and returns the finished PDFs. Used by Vercel and the local server.
 * Nothing is stored or emailed: the applicant shares the PDFs from their own device. */
const { parseSubmission, HttpError, newId } = require('./submission');
const { buildAll, buildCombined } = require('./pdf');

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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
    const files = await buildAll({ values, submittedAt: new Date(), id, ip }, signatures);
    const combined = await buildCombined(files, values.fullName);

    return send(res, 200, {
      ok: true,
      id,
      // The three separate PDFs (PSP must stay stand-alone) for sharing, and one combined file for downloading.
      files: files.map((f) => ({ filename: f.filename, base64: b64(f.bytes) })),
      copy: { filename: combined.filename, base64: b64(combined.bytes) },
    });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { ok: false, error: err.message, ...err.extra });
    // Never log request bodies: they contain SSNs.
    console.error('PDF build failed:', err && err.message);
    return send(res, 500, { ok: false, error: 'We could not create your PDF right now. Please try again in a moment.' });
  }
}

module.exports = { handlePdf, send };
