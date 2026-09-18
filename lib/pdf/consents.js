/* Background Check and PSP consent PDFs — laid out like the company's original forms. */
const S = require('../../public/js/schema.js');
const C = require('../../public/js/consents.js');
const kit = require('./kit');
const { COLOR } = kit;

const W = 612;
const H = 792;
const ML = 72;
const MR = 68;
const CW = W - ML - MR;
const MB = 64;

async function makeWriter(meta, footerLabel) {
  const doc = await kit.createDoc({ ...meta, fonts: ['serif', 'serifBold', 'serifItalic', 'serifBoldItalic'] });
  const F = doc.fonts;
  const fontFor = (run) => (run.b && run.i ? F.serifBoldItalic : run.b ? F.serifBold : run.i ? F.serifItalic : F.serif);
  const w = { doc, F, pdf: doc.pdf, page: null, y: 0, fontFor, footerLabel };

  w.newPage = () => {
    w.page = w.pdf.addPage([W, H]);
    w.y = H - 60;
  };
  w.ensure = (h) => {
    if (w.y - h < MB) w.newPage();
  };
  w.text = (str, x, y, size, font, color = COLOR.text) =>
    w.page.drawText(kit.clean(font, str), { x, y, size, font: font.f, color });

  /** Draw a paragraph of rich runs. align: 'left' | 'center'. */
  w.paragraph = (runs, { size = 11, leading = 14.6, x = ML, width = CW, align = 'left', after = 9, color = COLOR.text } = {}) => {
    const lines = kit.flowRuns(runs, size, width, fontFor);
    lines.forEach((tokens) => {
      w.ensure(leading);
      const lw = tokens.reduce((a, t) => a + t.w, 0);
      const lx = align === 'center' ? x + (width - lw) / 2 : x;
      kit.drawFlowLine(w.page, tokens, lx, w.y - size, size, color);
      w.y -= leading;
    });
    w.y -= after;
  };

  w.header = async ({ logoWidth = 92 }) => {
    const logo = await doc.logo();
    const lh = (logo.height * logoWidth) / logo.width;
    w.page.drawImage(logo, { x: 62, y: H - 46 - lh, width: logoWidth, height: lh });
    return { logoH: lh };
  };

  /** SIGNATURE / DATE / PRINT NAME lines with the signature + typed values on them. */
  w.signatureBlock = async ({ name, dateStr, signature }) => {
    w.ensure(120);
    const B = F.serifBold;
    const size = 12;
    const base = w.y - 40; // baseline of the first line
    const sigLabel = 'SIGNATURE:';
    const dateLabel = 'DATE:';
    const sx = ML + kit.width(B, size, sigLabel) + 4;
    const sEnd = 350;
    const dx = 372 + kit.width(B, size, dateLabel) + 4;
    const dEnd = W - MR;

    w.text(sigLabel, ML, base, size, B);
    w.text(dateLabel, 372, base, size, B);
    const line = (x1, x2, y) => w.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.8, color: COLOR.text });
    line(sx, sEnd, base - 2);
    line(dx, dEnd, base - 2);

    if (signature && kit.isPng(signature)) {
      const img = await w.pdf.embedPng(signature);
      const box = kit.fit(img.width, img.height, sEnd - sx - 6, 44);
      w.page.drawImage(img, { x: sx + 3, y: base + 1, width: box.w, height: box.h });
    }
    w.text(dateStr, dx + 4, base + 2, 11.5, F.serif, COLOR.ink);

    const base2 = base - 34;
    w.text('PRINT NAME:', ML, base2, size, B);
    const nx = ML + kit.width(B, size, 'PRINT NAME:') + 4;
    line(nx, dEnd, base2 - 2);
    w.text(name, nx + 4, base2 + 2, 11.5, F.serif, COLOR.ink);

    w.y = base2 - 26;
  };

  w.audit = ({ name, submittedAt, id, ip }) => {
    const when = submittedAt ? submittedAt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : '';
    const parts = ['Electronically signed by ' + name + (when ? ' on ' + when : ''), id ? 'Submission ID: ' + id : null, ip ? 'IP address: ' + ip : null].filter(Boolean);
    w.ensure(16);
    w.text(parts.join('   ·   '), ML, w.y - 7, 7.6, F.serif, COLOR.muted);
    w.y -= 14;
  };

  w.footers = () => {
    const pages = w.pdf.getPages();
    pages.forEach((pg, i) => {
      const label = kit.clean(F.serif, footerLabel);
      const right = 'Page ' + (i + 1) + ' of ' + pages.length;
      pg.drawText(label, { x: ML, y: 30, size: 8, font: F.serif.f, color: COLOR.muted });
      pg.drawText(right, { x: W - MR - kit.width(F.serif, 8, right), y: 30, size: 8, font: F.serif.f, color: COLOR.muted });
    });
  };

  return w;
}

const withName = (runs, name) => runs.map((r) => (r.name ? { t: name, u: true } : r));

async function buildBackgroundCheck({ values: v, signature, submittedAt, id, ip }) {
  const w = await makeWriter(
    { title: 'Background Check Consent - ' + v.fullName, subject: 'Background Check Authorization', date: submittedAt },
    C.COMPANY.name + '  ·  Background Check Consent  ·  ' + v.fullName
  );
  w.newPage();
  const { logoH } = await w.header({ logoWidth: 96 });

  const title = C.BACKGROUND_CHECK.title;
  const tSize = 26;
  const tw = kit.width(w.F.serif, tSize, title);
  w.text(title, 62 + 96 + (W - MR - 62 - 96 - tw) / 2, H - 46 - logoH / 2 - 4, tSize, w.F.serif);

  w.y = H - 46 - logoH - 34;
  C.BACKGROUND_CHECK.blocks.forEach((b) => {
    w.paragraph(withName(b.runs, v.fullName), { size: 12, leading: 17.2, after: 15 });
  });

  w.y -= 10;
  await w.signatureBlock({ name: v.fullName, dateStr: S.fmtDate(v.signedDate), signature });
  w.audit({ name: v.fullName, submittedAt, id, ip });
  w.footers();
  return w.pdf.save();
}

async function buildPsp({ values: v, signature, submittedAt, id, ip }) {
  const w = await makeWriter(
    { title: 'PSP Disclosure and Authorization - ' + v.fullName, subject: 'FMCSA PSP Disclosure and Authorization', date: submittedAt },
    C.COMPANY.name + '  ·  PSP Disclosure and Authorization  ·  ' + v.fullName
  );
  w.newPage();
  const { logoH } = await w.header({ logoWidth: 100 });

  // Banner to the right of the logo, centered in the remaining space.
  const bx = 200;
  const bw = W - MR - bx;
  const bannerRuns = [{ t: C.PSP.banner, b: true, i: true }];
  const bLines = kit.flowRuns(bannerRuns, 16, bw, w.fontFor);
  const bLead = 20;
  const bHeight = bLines.length * bLead;
  let by = H - 46 - Math.max(0, (logoH - bHeight) / 2) - 16 + 4;
  bLines.forEach((tokens) => {
    const lw = tokens.reduce((a, t) => a + t.w, 0);
    kit.drawFlowLine(w.page, tokens, bx + (bw - lw) / 2, by, 16, COLOR.text);
    by -= bLead;
  });

  w.y = H - 46 - Math.max(logoH, bHeight) - 26;

  C.PSP.blocks.forEach((b) => {
    if (b.kind === 'center-bold') {
      w.paragraph(b.runs.map((r) => ({ ...r, b: true })), { size: 12, leading: 15, align: 'center', after: 14 });
    } else if (b.kind === 'heading') {
      w.ensure(40);
      w.paragraph(b.runs.map((r) => ({ ...r, b: true })), { size: 14, leading: 18, after: 8 });
    } else {
      w.paragraph(b.runs, { size: 11, leading: 14.6, after: 10 });
    }
  });

  w.y -= 6;
  await w.signatureBlock({ name: v.fullName, dateStr: S.fmtDate(v.signedDate), signature });
  w.audit({ name: v.fullName, submittedAt, id, ip });
  w.y -= 6;
  C.PSP.notices.forEach((n) => w.paragraph([{ t: n }], { size: 10.5, leading: 13.6, after: 10 }));
  w.footers();
  return w.pdf.save();
}

module.exports = { buildBackgroundCheck, buildPsp };
