/* Local dev server: static files from ./public and POST /api/submit (same handler Vercel runs). */
const fs = require('fs');
const path = require('path');
const http = require('http');

// Minimal .env loader (no extra dependency).
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
} catch (_) { /* no .env */ }

const { handleSubmit } = require('./lib/handler');
const mail = require('./lib/mail');

const PUBLIC = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

const server = http.createServer((req, res) => {
  Object.entries(HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/submit') return handleSubmit(req, res);

  let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Righteous and Son application → http://localhost:${port}`);
  console.log(mail.configured() ? `Email: LIVE via ${process.env.SMTP_HOST || 'smtp.gmail.com'} → ${mail.recipients()}` : process.env.DRY_RUN === '1' ? 'Email: DRY RUN (PDFs are saved to ./out/submissions, nothing is sent)' : 'Email: NOT CONFIGURED (set SMTP_USER/SMTP_PASS, or DRY_RUN=1 for local testing)');
});
