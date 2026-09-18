/* "Job Application and History" PDF — US Letter, native (vector) text, table layout like the original. */
const S = require('../../public/js/schema.js');
const C = require('../../public/js/consents.js');
const kit = require('./kit');
const { COLOR } = kit;

const W = 612;
const H = 792;
const ML = 54;
const CW = W - ML * 2; // 504
const MT = 46;
const MB = 58;

const PAD = 4;
const LABEL_FS = 9;
const VALUE_FS = 9.5;
const LH = 11.6;
const LABEL_W = Math.round(CW * 0.47);
const VALUE_W = CW - LABEL_W;
const TITLE_H = 21;

const fmtValue = (f, val) => {
  if (f.type === 'check') return val ? 'Yes' : 'No';
  if (f.type === 'date') return val ? S.fmtDate(val) : '';
  return val == null ? '' : String(val).trim();
};

async function buildApplication({ values: v, signature, submittedAt, id, ip }) {
  const doc = await kit.createDoc({
    title: 'Driver Application - ' + v.fullName,
    subject: 'Driver Application for Employment',
    fonts: ['sans', 'sansBold'],
    date: submittedAt,
  });
  const { pdf } = doc;
  const sans = doc.fonts.sans;
  const bold = doc.fonts.sansBold;

  let page;
  let y;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - MT;
  };
  const ensure = (h) => {
    if (y - h < MB) newPage();
  };
  const text = (str, x, yy, size, font, color = COLOR.text) =>
    page.drawText(kit.clean(font, str), { x, y: yy, size, font: font.f, color });

  /* ---------- header ---------- */
  newPage();
  const logo = await doc.logo();
  const logoH = 84;
  const logoW = (logo.width * logoH) / logo.height;
  page.drawImage(logo, { x: (W - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
  text(C.COMPANY.name, ML, y - 34, 9.5, sans);
  text(C.COMPANY.address1, ML, y - 47, 9.5, sans);
  text(C.COMPANY.address2, ML, y - 60, 9.5, sans);
  y -= logoH + 12;

  const title = 'Driver Application for Employment';
  text(title, (W - kit.width(bold, 15, title)) / 2, y - 14, 15, bold);
  y -= 30;

  const eeoLines = kit.wrap(sans, 9, C.EEO, CW);
  eeoLines.forEach((ln, i) => text(ln, ML, y - 9 - i * 11.4, 9, sans));
  y -= eeoLines.length * 11.4 + 12;

  /* ---------- table engine ---------- */
  function layoutRow(r) {
    if (r.type === 'sub') return { ...r, h: 17 };
    if (r.type === 'full') {
      const lines = kit.wrap(sans, 8.8, r.text, CW - PAD * 2);
      return { ...r, lines, h: lines.length * 11 + PAD * 2 };
    }
    // label | value row
    const ll = [];
    if (r.label && typeof r.label === 'object') {
      kit.wrap(sans, LABEL_FS, r.label.intro, LABEL_W - PAD * 2).forEach((t) => ll.push({ t, x: 0 }));
      ll.push({ t: '', x: 0 });
      r.label.bullets.forEach((b) => {
        kit.wrap(sans, LABEL_FS, b, LABEL_W - PAD * 2 - 12).forEach((t, i) => ll.push({ t, x: 12, bullet: i === 0 }));
      });
    } else {
      kit.wrap(sans, LABEL_FS, r.label, LABEL_W - PAD * 2).forEach((t) => ll.push({ t, x: 0 }));
    }
    let vl = [];
    let hV = LH;
    let img = null;
    if (r.image) {
      img = kit.fit(r.image.width, r.image.height, VALUE_W - PAD * 2 - 8, 48);
      hV = img.h + 4;
    } else if (r.check) {
      hV = 13;
    } else {
      vl = kit.wrap(sans, VALUE_FS, r.value || '—', VALUE_W - PAD * 2);
      hV = vl.length * LH;
    }
    return { ...r, ll, vl, img, h: Math.max(ll.length * LH, hV, LH) + PAD * 2 };
  }

  function drawRow(r) {
    const rect = (x, w) =>
      page.drawRectangle({ x, y: y - r.h, width: w, height: r.h, borderWidth: 0.6, borderColor: COLOR.line });
    if (r.type === 'sub') {
      page.drawRectangle({ x: ML, y: y - r.h, width: CW, height: r.h, borderWidth: 0.6, borderColor: COLOR.line });
      const t = kit.clean(bold, r.text);
      text(t, ML + (CW - kit.width(bold, 8.6, t)) / 2, y - 12, 8.6, bold);
    } else if (r.type === 'full') {
      page.drawRectangle({ x: ML, y: y - r.h, width: CW, height: r.h, borderWidth: 0.6, borderColor: COLOR.line });
      r.lines.forEach((ln, i) => text(ln, ML + PAD, y - PAD - 8.6 - i * 11, 8.8, sans));
    } else {
      rect(ML, LABEL_W);
      rect(ML + LABEL_W, VALUE_W);
      r.ll.forEach((ln, i) => {
        const baseline = y - PAD - LABEL_FS * 0.86 - i * LH;
        if (ln.bullet) text('•', ML + PAD + 3, baseline, LABEL_FS, sans);
        text(ln.t, ML + PAD + ln.x, baseline, LABEL_FS, sans);
      });
      const vx = ML + LABEL_W + PAD;
      if (r.image) {
        if (r.imageEmbed) page.drawImage(r.imageEmbed, { x: vx + 4, y: y - r.h + (r.h - r.img.h) / 2, width: r.img.w, height: r.img.h });
      } else if (r.check) {
        kit.drawCheckbox(page, vx, y - PAD - 1, 10, r.checked);
        text('YES', vx + 16, y - PAD - 8.6, 9.5, bold, COLOR.text);
      } else {
        r.vl.forEach((ln, i) => text(ln, vx, y - PAD - VALUE_FS * 0.86 - i * LH, VALUE_FS, sans, r.value ? COLOR.ink : COLOR.muted));
      }
    }
    y -= r.h;
  }

  function table(titleText, rows, { gap = 12 } = {}) {
    const laid = rows.map(layoutRow);
    ensure(TITLE_H + Math.min(laid.length ? laid[0].h : 0, 70) + 2);
    page.drawRectangle({ x: ML, y: y - TITLE_H, width: CW, height: TITLE_H, color: COLOR.fill, borderWidth: 0.6, borderColor: COLOR.line });
    text(titleText, ML + 6, y - 14.5, 11, bold);
    y -= TITLE_H;
    laid.forEach((r) => {
      ensure(r.h);
      drawRow(r);
    });
    y -= gap;
  }

  function heading(str) {
    ensure(40);
    text(str, ML, y - 14, 14, bold);
    y -= 26;
  }

  /* ---------- schema-driven sections ---------- */
  const rowsFor = (sec, src) => {
    const rows = [];
    if (sec.pdfSub) rows.push({ type: 'sub', text: sec.pdfSub });
    sec.fields.forEach((f) => {
      if (f.pdfHide || !S.isShown(f, v, src)) return;
      if (f.type === 'heading') {
        rows.push({ type: 'sub', text: f.label.toUpperCase() });
        return;
      }
      const label = f.pdfLabel || f.label;
      const value = fmtValue(f, src[f.id]);
      rows.push({ type: 'row', label: f.bullets ? { intro: label, bullets: f.bullets } : label, value });
    });
    return rows;
  };

  let workHeadingDrawn = false;
  for (const secId of S.PDF_ORDER) {
    const sec = S.SECTIONS[secId];
    if (!S.sectionShown(sec, v)) continue;
    if (sec.repeat) {
      const list = Array.isArray(v[sec.repeat.key]) ? v[sec.repeat.key] : [];
      if (sec.repeat.key === 'work' && !workHeadingDrawn) {
        heading('Please Enter Your Last 10 Years of Work History');
        workHeadingDrawn = true;
      }
      list.forEach((row, i) => {
        const rows = rowsFor(sec, row);
        if (row.unemployed) rows.unshift({ type: 'row', label: 'Type', value: 'Period of unemployment (no employer)' });
        table((sec.pdfTitle || sec.repeat.itemTitle) + ' #' + (i + 1), rows);
      });
    } else {
      table(sec.pdfTitle || sec.title, rowsFor(sec, v));
    }
  }

  /* ---------- signature & acknowledgements ---------- */
  let sigEmbed = null;
  if (signature && kit.isPng(signature)) sigEmbed = await pdf.embedPng(signature);
  const sigRow = sigEmbed
    ? { type: 'row', label: 'Signature', image: { width: sigEmbed.width, height: sigEmbed.height }, imageEmbed: sigEmbed }
    : { type: 'row', label: 'Signature', value: 'Not provided' };
  // imageEmbed must survive layoutRow's spread — it does, since layoutRow copies all props.

  table('Signature', [
    { type: 'row', label: 'Full Name', value: v.fullName },
    { type: 'full', text: C.CERTIFICATION.join('\n\n') },
    sigRow,
    { type: 'row', label: 'Date signed', value: S.fmtDate(v.signedDate) },
  ]);

  C.ACKNOWLEDGEMENTS.forEach((a) => {
    table(a.title, [{ type: 'row', label: a.text, check: true, checked: !!v[a.id] }]);
  });

  const audit = [
    'Electronically submitted' + (submittedAt ? ' on ' + submittedAt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : ''),
    id ? 'Submission ID: ' + id : null,
    ip ? 'IP address: ' + ip : null,
  ].filter(Boolean).join('   ·   ');
  ensure(20);
  text(audit, ML, y - 8, 7.8, sans, COLOR.muted);

  /* ---------- footers ---------- */
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: ML, y: 40 }, end: { x: W - ML, y: 40 }, thickness: 0.5, color: COLOR.muted });
    const left = kit.clean(sans, C.COMPANY.name + '  ·  Driver Application  ·  ' + v.fullName);
    pg.drawText(left, { x: ML, y: 28, size: 8, font: sans.f, color: COLOR.muted });
    const right = 'Page ' + (i + 1) + ' of ' + pages.length;
    pg.drawText(right, { x: W - ML - kit.width(sans, 8, right), y: 28, size: 8, font: sans.f, color: COLOR.muted });
  });

  return pdf.save();
}

module.exports = { buildApplication };
