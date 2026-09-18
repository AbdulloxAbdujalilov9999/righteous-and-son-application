(function () {
  'use strict';

  const S = window.RSSchema;
  const C = window.RSConsents;
  const { SignaturePad, toPNG } = window.RSSignaturePad;
  const STEPS = S.STEPS;
  const LAST = STEPS.length - 1;
  const DRAFT_KEY = 'rs_application_draft_v2'; // v2: step order changed (application first)
  const MAIL_TO = 'righteousandson.inc@gmail.com,jscott.righteousandson@gmail.com';

  const LEAD = {
    background: 'Read the authorization below, then sign at the bottom. You only draw your signature once — we reuse it on the other forms, and you can change it there.',
    psp: 'This is the required FMCSA disclosure. Please read it, then sign at the bottom.',
    about: 'Start here: tell us about yourself and the job you are applying for. Next come the consent forms, which you sign.',
    licenses: 'Your driving experience and license details.',
    history: 'List your work for the last 10 years, starting with the most recent.',
    record: 'Answer every question. If you answer Yes, we will ask for details.',
    sign: 'Check everything, agree to the statements, and sign.',
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const app = $('#app');

  /* ---------------------------------------------------------------- state */
  const state = {
    step: 0,
    data: S.defaults(),
    sig: { background: [], psp: [], final: [] },
    linked: { psp: true, final: true },
    restored: false,
    copy: null,
    files: null,
    result: null,
    shareFiles: null,
    pads: {},
    busy: false,
  };

  const fieldStep = {}; // field id / repeat key -> step index
  STEPS.forEach((st, i) => (st.sections || []).forEach((id) => {
    const sec = S.SECTIONS[id];
    if (sec.repeat) fieldStep[sec.repeat.key] = i;
    sec.fields.forEach((f) => (fieldStep[f.id] = i));
  }));
  C.ACKNOWLEDGEMENTS.forEach((a) => (fieldStep[a.id] = LAST));

  const getPath = (obj, p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  function setPath(obj, p, val) {
    const ks = p.split('.');
    let o = obj;
    ks.slice(0, -1).forEach((k) => (o = o[k]));
    o[ks[ks.length - 1]] = val;
  }

  /* ---------------------------------------------------------------- draft storage */
  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || !d.data || Date.now() - d.ts > 7 * 864e5) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      Object.assign(state.data, d.data);
      state.sig = Object.assign(state.sig, d.sig || {});
      state.linked = Object.assign(state.linked, d.linked || {});
      state.step = Math.min(Math.max(d.step | 0, 0), LAST);
      state.restored = !!(state.data.fullName || state.step > 0);
    } catch (_) { /* storage unavailable or corrupt: start fresh */ }
  }
  let saveTimer;
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const rest = state.data; // everything stays on this device (7 days) so a failed share never means re-typing
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ts: Date.now(), step: state.step, data: rest, sig: state.sig, linked: state.linked }));
      } catch (_) { /* ignore quota / private mode */ }
    }, 350);
  }
  function clearDraft() {
    clearTimeout(saveTimer);
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* ignore */ }
  }

  /* ---------------------------------------------------------------- HTML builders */
  function runsHTML(runs) {
    return runs.map((r) => {
      if (r.name) return `<span class="inline-name" data-bind="fullName">${esc(state.data.fullName)}</span>`;
      let t = esc(r.t);
      if (r.b) t = `<strong>${t}</strong>`;
      if (r.i) t = `<em>${t}</em>`;
      return t;
    }).join('');
  }

  function blocksHTML(blocks) {
    return blocks.map((b) => {
      if (b.kind === 'center-bold') return `<p class="center-bold">${runsHTML(b.runs)}</p>`;
      if (b.kind === 'heading') return `<h3>${runsHTML(b.runs)}</h3>`;
      return `<p>${runsHTML(b.runs)}</p>`;
    }).join('');
  }

  const inputId = (path) => 'f_' + path.replace(/\./g, '_');

  function fieldHTML(f, path, sec, rowIdx, labelOverride) {
    const val = getPath(state.data, path);
    const id = inputId(path);
    const meta = `data-field data-sec="${sec.id}" data-fid="${f.id}" data-wrap="${path}"${rowIdx != null ? ` data-row="${rowIdx}"` : ''}`;
    const label = labelOverride || f.label;
    const opt = '<span class="opt" data-opt>Optional</span>';
    const errP = `<p class="err" id="e_${id}" role="alert"></p>`;
    const bullets = f.bullets ? `<ul class="lbl-ul">${f.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '';

    if (f.type === 'heading') return `<div class="subhead wide" ${meta}>${esc(f.label)}</div>`;

    if (f.type === 'check') {
      return `<div class="field" ${meta}><label class="check"><input type="checkbox" data-path="${path}" ${val ? 'checked' : ''}><span>${esc(label)}</span></label></div>`;
    }

    if (f.type === 'yesno') {
      const radios = S.YN.map((o) => `<label><input type="radio" name="${id}" value="${o}" data-path="${path}" ${val === o ? 'checked' : ''}><span>${o}</span></label>`).join('');
      return `<div class="field wide" ${meta}><div class="lbl" id="l_${id}">${esc(label)}${bullets}${opt}</div><div class="seg" role="radiogroup" aria-labelledby="l_${id}">${radios}</div>${errP}</div>`;
    }

    const common = `id="${id}" data-path="${path}" aria-describedby="e_${id}"`;
    let control;
    if (f.type === 'select') {
      const opts = S.fieldOptions(f).map((o) => `<option value="${esc(o)}" ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
      control = `<select class="input" ${common}><option value="">Select…</option>${opts}</select>`;
    } else if (f.type === 'textarea') {
      control = `<textarea class="input" rows="3" ${common} autocapitalize="sentences" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
    } else {
      const t = { email: 'email', tel: 'tel', date: 'date' }[f.type] || 'text';
      const attrs = [
        `type="${t}"`,
        `value="${esc(val)}"`,
        f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '',
        `autocomplete="${esc(f.autocomplete || 'off')}"`,
        f.type === 'email' ? 'inputmode="email" autocapitalize="none" spellcheck="false"' : '',
        f.type === 'tel' ? 'inputmode="tel"' : '',
        f.type === 'ssn' ? 'inputmode="numeric" maxlength="11" data-kind="ssn" spellcheck="false"' : '',
        f.type === 'tel' ? 'data-kind="tel"' : '',
        f.inputmode ? `inputmode="${f.inputmode}"` : '',
        f.maxlength ? `maxlength="${f.maxlength}"` : '',
        t === 'text' && f.type !== 'ssn' ? `autocapitalize="${f.autocapitalize || 'words'}"` : '',
        f.type === 'date' && (f.past || f.dob) ? `max="${S.isoToday()}"` : '',
        f.type === 'date' ? 'min="1900-01-01"' : '',
        'enterkeyhint="next"',
      ].filter(Boolean).join(' ');
      control = `<input class="input" ${common} ${attrs}>`;
    }
    const wide = f.type === 'textarea' ? ' wide' : '';
    return `<div class="field${wide}" ${meta}><label class="lbl" for="${id}">${esc(label)}${opt}</label>${control}${errP}</div>`;
  }

  function fieldsGridHTML(sec, prefix, rowIdx) {
    let out = '';
    let checks = [];
    const flush = () => {
      if (checks.length) out += `<div class="checks wide">${checks.join('')}</div>`;
      checks = [];
    };
    sec.fields.forEach((f) => {
      const path = prefix ? `${prefix}.${f.id}` : f.id;
      const html = fieldHTML(f, path, sec, rowIdx);
      if (f.type === 'check') checks.push(html);
      else { flush(); out += html; }
    });
    flush();
    return `<div class="grid">${out}</div>`;
  }

  function rowCardHTML(sec, i, count) {
    const key = sec.repeat.key;
    const removable = count > sec.repeat.min;
    return `<div class="rowcard" data-rowcard="${key}.${i}">
      <div class="rowcard-head"><h3>${esc(sec.repeat.itemTitle)} #${i + 1}</h3>${removable ? `<button type="button" class="btn btn-danger" data-action="remove-row" data-sec="${sec.id}" data-row="${i}">Remove</button>` : ''}</div>
      ${fieldsGridHTML(sec, `${key}.${i}`, i)}
    </div>`;
  }

  function sectionHTML(sec, showTitle) {
    let body;
    if (sec.repeat) {
      const rows = state.data[sec.repeat.key] || [];
      body = rows.map((_, i) => rowCardHTML(sec, i, rows.length)).join('') +
        `<p class="err" data-repeat-err="${sec.repeat.key}" role="alert"></p>` +
        (rows.length < sec.repeat.max ? `<button type="button" class="btn btn-secondary add-row" data-action="add-row" data-sec="${sec.id}">+ ${esc(sec.repeat.addLabel)}</button>` : '');
    } else {
      body = fieldsGridHTML(sec, '', null);
    }
    return `<section class="card" data-sec-wrap="${sec.id}">
      ${showTitle ? `<h2>${esc(sec.title)}</h2>` : ''}
      ${sec.subtitle ? `<div class="sub">${esc(sec.subtitle)}</div>` : ''}
      ${sec.note ? `<p class="note">${esc(sec.note)}</p>` : ''}
      ${body}
    </section>`;
  }

  function sigBoxHTML(id, label) {
    const relink = id !== 'background' ? `<button type="button" class="btn btn-ghost btn-small" data-action="relink-sig" data-sig="${id}" ${state.sig.background.length && !state.linked[id] ? '' : 'hidden'}>Use my first signature</button>` : '';
    return `<div class="sigbox" data-sig="${id}">
      <div class="lbl">${esc(label)}</div>
      <div class="sigwrap"><canvas class="sigcanvas" data-canvas="${id}" role="img" aria-label="Signature area: draw your signature with your finger or mouse"></canvas><div class="sigline"></div><div class="sighint">Sign here with your finger</div></div>
      <div class="sigtools"><button type="button" class="btn btn-ghost btn-small" data-action="clear-sig" data-sig="${id}">Clear</button>${relink}<span class="sigmeta">Date: ${S.fmtDate(S.isoToday())}</span></div>
      <p class="err" role="alert"></p>
    </div>`;
  }

  function consentStepHTML(step) {
    if (step.doc === 'background') {
      return `<section class="card legal">${blocksHTML(C.BACKGROUND_CHECK.blocks)}</section>
        <section class="card">${sigBoxHTML('background', 'Your signature')}<p class="small">By signing, I agree to the Background Check authorization above.</p></section>`;
    }
    return `<section class="card legal"><p class="banner-text">${esc(C.PSP.banner)}</p>${blocksHTML(C.PSP.blocks)}</section>
      <section class="card">${sigBoxHTML('psp', 'Your signature')}<p class="small">By signing, I agree to the PSP Disclosure and Authorization above.</p></section>
      <section class="card legal"><p class="notice">${C.PSP.notices.map(esc).join('</p><p class="notice">')}</p></section>`;
  }

  function reviewHTML() {
    const d = state.data;
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const rows = [
      ['Name', d.fullName],
      ['Phone', d.phone],
      ['Email', d.email],
      ['Position', d.position],
      ['License', [d.lic1Class, d.lic1Authority].filter(Boolean).join(' — ')],
      ['Work history', plural((d.work || []).length, 'entry').replace('entrys', 'entries')],
      ['Accidents', d.hadAccident === 'Yes' ? plural((d.accidents || []).length, 'record') : 'None reported'],
    ].filter(([, v]) => v);
    const edits = STEPS.slice(0, LAST).map((st, i) => `<button type="button" class="btn btn-ghost btn-small" data-action="goto" data-step="${i}">Edit: ${esc(st.short)}</button>`).join('');
    const acks = C.ACKNOWLEDGEMENTS.map((a) => `<div class="ack field" data-wrap="${a.id}">
        <h3>${esc(a.title)}</h3><p>${esc(a.text)}</p>
        <label class="check"><input type="checkbox" data-path="${a.id}" ${d[a.id] ? 'checked' : ''}><span><strong>YES</strong> — I agree</span></label>
        <p class="err" role="alert"></p></div>`).join('');
    return `<div id="submitError"></div><div id="problems"></div>
      <section class="card"><h2>Your application</h2><dl class="summary">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><div class="edit-links">${edits}</div></section>
      <section class="card"><h2>Certification</h2><div class="legal">${C.CERTIFICATION.map((p) => `<p>${esc(p)}</p>`).join('')}</div></section>
      <section class="card"><h2>Acknowledgments</h2>${acks}</section>
      <section class="card"><h2>Sign</h2><dl class="summary"><div><dt>Signing as</dt><dd>${esc(d.fullName)}</dd></div><div><dt>Date</dt><dd>${S.fmtDate(S.isoToday())}</dd></div></dl>${sigBoxHTML('final', 'Your signature')}</section>
      <div class="hp" aria-hidden="true"><label>Website <input type="text" id="website" tabindex="-1" autocomplete="off"></label></div>`;
  }

  /* ---------------------------------------------------------------- render */
  function destroyPads() {
    Object.values(state.pads).forEach((p) => p.destroy());
    state.pads = {};
  }

  function mountPads() {
    $$('canvas[data-canvas]').forEach((canvas) => {
      const id = canvas.dataset.canvas;
      const wrap = canvas.closest('.sigwrap');
      const pad = new SignaturePad(canvas, {
        strokes: state.sig[id],
        onStart: () => wrap.classList.add('has-ink'),
        onChange: (strokes) => onSignature(id, strokes),
      });
      wrap.classList.toggle('has-ink', state.sig[id].length > 0);
      state.pads[id] = pad;
    });
  }

  function onSignature(id, strokes) {
    state.sig[id] = strokes;
    if (id === 'background') {
      ['psp', 'final'].forEach((k) => { if (state.linked[k]) state.sig[k] = clone(strokes); });
    } else {
      state.linked[id] = false;
    }
    const box = $(`.sigbox[data-sig="${id}"]`);
    if (box) {
      box.classList.toggle('invalid', false);
      $('.err', box).textContent = '';
      $('.sigwrap', box).classList.toggle('has-ink', strokes.length > 0);
      const relink = $('[data-action="relink-sig"]', box);
      if (relink) relink.hidden = !(state.sig.background.length && !state.linked[id]);
    }
    saveDraft();
  }

  function leadFor(step) {
    if (step.kind === 'review') return LEAD.sign + ' Then tap Create my PDF \u2014 you can share it or download it.';
    return LEAD[step.id] || '';
  }

  function render({ focusTitle = false } = {}) {
    destroyPads();
    const step = STEPS[state.step];
    let html = '';
    if (state.restored) {
      html += `<div class="banner info" id="restoreBanner"><p><strong>Welcome back.</strong> We restored the answers you saved on this device, so you can carry on where you stopped.</p><div class="row"><button type="button" class="link-btn" data-action="dismiss-restore">Dismiss</button><button type="button" class="link-btn" data-action="reset">Start over</button></div></div>`;
    }
    html += `<h1 class="step-title" id="stepTitle" tabindex="-1">${esc(step.title)}</h1><p class="step-lead" id="stepLead">${esc(leadFor(step))}</p>`;
    if (step.kind === 'consent') html += consentStepHTML(step);
    else if (step.kind === 'review') html += reviewHTML();
    else {
      let prev = null;
      html += step.sections.map((id) => {
        const sec = S.SECTIONS[id];
        const out = sectionHTML(sec, prev !== sec.title);
        prev = sec.title;
        return out;
      }).join('');
    }
    app.innerHTML = html;
    mountPads();
    applyVisibility();
    updateChrome();
    if (step.kind === 'review') loadPdfTools().catch(() => {}); // start downloading the PDF tools now
    if (focusTitle) $('#stepTitle').focus({ preventScroll: true });
  }

  function updateChrome() {
    const step = STEPS[state.step];
    $('#brandStep').textContent = step.title;
    $('#stepCount').textContent = `${state.step + 1} / ${STEPS.length}`;
    const pct = Math.round(((state.step + 1) / STEPS.length) * 100);
    $('#progress').style.setProperty('--p', pct);
    $('#progress').setAttribute('aria-valuenow', String(pct));
    const back = $('#backBtn');
    const next = $('#nextBtn');
    back.hidden = state.step === 0;
    next.textContent = state.step === LAST ? 'Create my PDF' : 'Continue';
    next.classList.toggle('btn-submit', state.step === LAST);
    next.classList.toggle('btn-primary', state.step !== LAST);
    $('#actionbar').hidden = false;
    document.title = `${step.title} — Driver Application — Righteous and Son Inc`;
  }

  /* ---------------------------------------------------------------- conditional visibility */
  function ctxFor(el) {
    const sec = S.SECTIONS[el.dataset.sec];
    const f = sec.fields.find((x) => x.id === el.dataset.fid);
    const row = sec.repeat ? state.data[sec.repeat.key][+el.dataset.row] || {} : state.data;
    return { sec, f, row };
  }

  function applyVisibility() {
    $$('[data-sec-wrap]').forEach((el) => { el.hidden = !S.sectionShown(S.SECTIONS[el.dataset.secWrap], state.data); });
    $$('[data-field]').forEach((el) => {
      const { f, row } = ctxFor(el);
      el.hidden = !S.isShown(f, state.data, row);
      if (el.hidden && el.classList.contains('invalid')) setFieldError(el, '');
      const opt = $('[data-opt]', el);
      if (opt) opt.hidden = S.isRequired(f, state.data, row);
    });
  }

  /** Makes sure conditional repeat sections have their minimum rows. Returns true if rows were added. */
  function syncRepeats() {
    let changed = false;
    Object.values(S.SECTIONS).forEach((sec) => {
      if (!sec.repeat || !S.sectionShown(sec, state.data)) return;
      const rows = state.data[sec.repeat.key];
      while (rows.length < sec.repeat.min) { rows.push(S.newRow(sec)); changed = true; }
    });
    return changed;
  }

  function rerender() {
    const y = window.scrollY;
    const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.path : null;
    render();
    window.scrollTo(0, y);
    if (active) { const el = $(`[data-path="${active}"]`); if (el && el.type !== 'radio') el.focus({ preventScroll: true }); }
  }

  /* ---------------------------------------------------------------- errors */
  function setFieldError(wrap, msg) {
    if (!wrap) return;
    wrap.classList.toggle('invalid', !!msg);
    const err = $('.err', wrap);
    if (err) err.textContent = msg || '';
    $$('input:not([type=radio]):not([type=checkbox]),select,textarea', wrap).forEach((c) => c.setAttribute('aria-invalid', msg ? 'true' : 'false'));
  }
  const wrapFor = (path) => $(`[data-wrap="${path}"]`);

  function clearErrors() {
    $$('.invalid').forEach((el) => el.classList.remove('invalid'));
    $$('.err').forEach((el) => (el.textContent = ''));
  }

  function showErrors(errs) {
    clearErrors();
    Object.entries(errs).forEach(([key, msg]) => {
      if (key.startsWith('sig_')) {
        const box = $(`.sigbox[data-sig="${key.slice(4)}"]`);
        if (box) { box.classList.add('invalid'); $('.err', box).textContent = msg; }
      } else if (key.endsWith('._')) {
        const p = $(`[data-repeat-err="${key.split('.')[0]}"]`);
        if (p) p.textContent = msg;
      } else {
        setFieldError(wrapFor(key), msg);
      }
    });
    const first = $('.field.invalid, .sigbox.invalid');
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const c = $('input:not([type=radio]),select,textarea', first) || $('input', first);
      if (c) setTimeout(() => c.focus({ preventScroll: true }), 250);
    }
  }

  function validateOne(path) {
    const wrap = wrapFor(path);
    if (!wrap || !wrap.dataset.sec) return;
    const { f, row } = ctxFor(wrap);
    const val = getPath(state.data, path);
    const msg = S.validateField(f, val, state.data, row);
    setFieldError(wrap, S.isEmpty(val) ? '' : msg);
  }

  function stepErrors(i) {
    const step = STEPS[i];
    const errs = {};
    if (step.kind === 'consent') {
      if (!state.sig[step.doc].length) errs['sig_' + step.doc] = 'Please sign in the box above';
    } else if (step.kind === 'review') {
      C.ACKNOWLEDGEMENTS.forEach((a) => { if (!state.data[a.id]) errs[a.id] = 'Please check the box to continue'; });
      if (!state.sig.final.length) errs.sig_final = 'Please sign in the box above';
    } else {
      step.sections.forEach((id) => Object.assign(errs, S.validateSection(S.SECTIONS[id], state.data)));
    }
    return errs;
  }

  /** Finds earlier steps that still have problems (e.g. answers that became required later). */
  function findProblemSteps(extraKeys = []) {
    const steps = new Set();
    for (let i = 0; i < LAST; i++) if (Object.keys(stepErrors(i)).length) steps.add(i);
    extraKeys.forEach((k) => { const s = fieldStep[k.split('.')[0]]; if (s != null && s !== LAST) steps.add(s); });
    return Array.from(steps).sort((a, b) => a - b);
  }

  function renderProblems(stepsList) {
    const box = $('#problems');
    if (!box) return;
    box.innerHTML = stepsList.length
      ? `<div class="banner error"><p><strong>Some earlier answers need attention.</strong></p><div class="row">${stepsList.map((i) => `<button type="button" class="btn btn-secondary btn-small" data-action="goto" data-step="${i}">Fix: ${esc(STEPS[i].title)}</button>`).join('')}</div></div>`
      : '';
    if (stepsList.length) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------------------------------------------------------------- navigation */
  function goStep(n, { push = true } = {}) {
    state.restored = false;
    state.step = Math.max(0, Math.min(LAST, n));
    if (push) { try { history.pushState({ step: state.step }, ''); } catch (_) { /* ignore */ } }
    saveDraft();
    render({ focusTitle: true });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 3200);
  }

  async function onNext() {
    if (state.busy) return;
    if (state.step === LAST) return submit();
    const errs = stepErrors(state.step);
    if (Object.keys(errs).length) {
      showErrors(errs);
      toast('Please fix the highlighted fields');
      return;
    }
    goStep(state.step + 1);
  }

  /* ---------------------------------------------------------------- submit */
  function setBusy(on) {
    state.busy = on;
    $('#busy').hidden = !on;
    $('#nextBtn').disabled = on;
    $('#backBtn').disabled = on;
    app.inert = on;
  }

  /* ---------------------------------------------------------------- PDF (built entirely in the browser) */
  let pdfToolsLoading = null;
  function loadPdfTools() {
    if (window.RSPdf) return Promise.resolve();
    if (!pdfToolsLoading) {
      pdfToolsLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'js/pdf.bundle.js';
        s.onload = () => (window.RSPdf ? resolve() : reject(new Error('PDF tools missing')));
        s.onerror = () => { pdfToolsLoading = null; reject(new Error('Could not load the PDF tools')); };
        document.head.appendChild(s);
      });
    }
    return pdfToolsLoading;
  }

  function dataUrlToBytes(url) {
    const bin = atob(String(url).split(',')[1] || '');
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  const newId = () => 'RS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const blobUrl = (file) => URL.createObjectURL(new Blob([file.bytes], { type: 'application/pdf' }));

  function saveFile(file) {
    const url = blobUrl(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  /** Downloads the single combined PDF (the easiest thing to attach to an email). */
  function downloadPdf() {
    if (!state.copy) return;
    saveFile(state.copy);
  }

  /** Downloads the three forms as separate PDFs (the PSP form as its own stand-alone document). */
  async function downloadSeparate() {
    if (!state.files) return;
    for (const f of state.files) {
      saveFile(f);
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  /* ---------------------------------------------------------------- in-page PDF viewer (pdf.js) */
  let pdfJsLoading = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    if (!pdfJsLoading) {
      pdfJsLoading = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = 'vendor/pdfjs/pdf.min.js';
        el.onload = () => {
          if (!window.pdfjsLib) return reject(new Error('pdf.js missing'));
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
          resolve();
        };
        el.onerror = () => { pdfJsLoading = null; reject(new Error('Could not load the PDF viewer')); };
        document.head.appendChild(el);
      });
    }
    return pdfJsLoading;
  }

  const viewer = $('#viewer');
  let viewerDoc = null;

  function hideViewer() {
    viewer.hidden = true;
    $('#viewerPages').innerHTML = '';
    document.body.classList.remove('no-scroll');
    app.inert = false;
    if (viewerDoc) { try { viewerDoc.destroy(); } catch (_) { /* ignore */ } viewerDoc = null; }
  }

  function closeViewer() {
    if (history.state && history.state.viewer) history.back(); // popstate hides it
    else hideViewer();
  }

  /** Shows the PDF inside the page, on every device (no reliance on the browser's own PDF support). */
  async function previewPdf() {
    if (!state.copy) return;
    const pages = $('#viewerPages');
    pages.innerHTML = '<p class="viewer-msg">Loading preview…</p>';
    viewer.hidden = false;
    document.body.classList.add('no-scroll');
    app.inert = true;
    $('#viewerBack').focus();
    try { history.pushState({ step: LAST, ready: true, viewer: true }, ''); } catch (_) { /* ignore */ }
    const canShare = canShareFiles(state.shareFiles);
    $('#viewerShare').hidden = !canShare;
    try {
      await loadPdfJs();
      const doc = await window.pdfjsLib.getDocument({ data: state.copy.bytes.slice(), isEvalSupported: false }).promise; // .slice(): pdf.js takes ownership of the buffer
      if (viewer.hidden) { doc.destroy(); return; }
      viewerDoc = doc;
      pages.innerHTML = '';
      const cssW = Math.min(pages.clientWidth - 24, 820);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pending = [];
      const pump = () => { // draw pages that are (nearly) on screen; the rest wait until scrolled near
        const limit = pages.scrollTop + pages.clientHeight + 900;
        for (let i = pending.length - 1; i >= 0; i--) {
          if (pending[i].offsetTop <= limit) pending.splice(i, 1)[0]._render();
        }
      };
      pages.onscroll = pump;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = cssW / base.width;
        const box = document.createElement('div');
        box.className = 'vpage';
        box.style.width = cssW + 'px';
        box.style.height = Math.round(base.height * scale) + 'px';
        box.setAttribute('aria-label', 'Page ' + n + ' of ' + doc.numPages);
        box._render = async () => {
          const vp = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          box.appendChild(canvas);
          try { await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise; } catch (_) { /* viewer closed */ }
        };
        pages.appendChild(box);
        pending.push(box);
      }
      pending.reverse(); // keep page order so pump() finds the earliest first
      pump();
    } catch (err) {
      console.error('Preview failed:', err);
      pages.innerHTML = '<p class="viewer-msg">The preview could not be shown on this device. You can still use <strong>Download PDF</strong> — the file is fine.</p>';
    }
  }

  const canShareFiles = (files) => typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && !!files && navigator.canShare({ files });

  /** Opens the phone's share sheet. Must be called straight from a tap (nothing awaited before it). */
  function sharePdf() {
    if (!state.shareFiles) return;
    if (!canShareFiles(state.shareFiles)) {
      downloadPdf();
      toast('Saved to your device — now attach it to an email');
      return;
    }
    const name = state.data.fullName || '';
    const t0 = Date.now();
    navigator.share({
      files: state.shareFiles,
      title: 'Driver Application - ' + name,
      text: `Driver application, Background Check and PSP consent for ${name}. Please send to: ${MAIL_TO.replace(',', ', ')}`,
    }).then(() => {
      // Some browsers answer "done" instantly without ever showing a menu.
      if (Date.now() - t0 < 600) toast('No share menu appeared — use Download PDF or Open Gmail below');
    }).catch((e) => {
      if (e && e.name === 'AbortError') return; // they closed the share sheet
      toast('Could not open the share menu — use Download PDF or Open Gmail below');
    });
  }

  function showSubmitError(message) {
    const box = $('#submitError');
    if (!box) return;
    box.innerHTML = `<div class="banner error"><p><strong>${esc(message)}</strong></p><p>Your answers are still on this page — tap the button to try again.</p></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showReady(res, { push = true } = {}) {
    state.copy = res.copy;
    state.files = res.files;
    state.result = res;
    state.shareFiles = res.files.map((f) => new File([f.bytes], f.filename, { type: 'application/pdf' }));
    destroyPads();
    saveDraft();
    $('#actionbar').hidden = true;
    $('#brandStep').textContent = 'PDF ready';
    $('#stepCount').textContent = '✓';
    $('#progress').style.setProperty('--p', 100);
    const name = state.data.fullName || '';
    const first = String(name).trim().split(/\s+/)[0] || 'there';
    const canShare = canShareFiles(state.shareFiles);
    const addrs = MAIL_TO.split(',').map((a) => `<li>${esc(a)}</li>`).join('');
    const subject = 'Driver Application - ' + name;
    const body = 'Hello,\n\nPlease find my completed driver application attached (PDF).\n\nName: ' + name;
    const mailto = `mailto:${MAIL_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(MAIL_TO)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    app.innerHTML = `<section class="card done">
      <div class="done-icon" aria-hidden="true"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h1 id="stepTitle" tabindex="-1">Your PDF is ready</h1>
      <p>Thank you, ${esc(first)}. Your signed application is ready. <strong>It has not been sent yet</strong> — ${canShare ? 'tap Share PDF and choose Gmail, Mail, WhatsApp or another app, and send it to:' : 'download the PDF, then email it as an attachment to:'}</p>
      <ul class="addr">${addrs}</ul>
      ${canShare ? '<button type="button" class="btn btn-submit" data-action="share">Share PDF</button>' : '<button type="button" class="btn btn-submit" data-action="download">Download PDF</button>'}
      <div class="row-btns">
        ${canShare ? '<button type="button" class="btn btn-secondary btn-small" data-action="download">Download PDF</button>' : ''}
        <button type="button" class="btn btn-secondary btn-small" data-action="preview">Preview PDF</button>
        <a class="btn btn-secondary btn-small" href="${esc(gmail)}" target="_blank" rel="noopener">Open Gmail</a>
        <a class="btn btn-secondary btn-small" href="${esc(mailto)}">Open email app</a>
        <button type="button" class="btn btn-ghost btn-small" data-action="copy-emails">Copy email addresses</button>
      </div>
      <p class="small">Email apps cannot attach the PDF for you \u2014 download it first, then attach it to the email.</p>
      <div class="row-btns more">
        <button type="button" class="link-btn" data-action="download-separate">Download as 3 separate files</button>
        <button type="button" class="link-btn" data-action="edit">Edit my answers</button>
      </div>
      <p class="small saved">Your answers are saved on this device, so you will not have to type them again if something goes wrong.
        <button type="button" class="link-btn" data-action="reset">Erase my data from this device</button></p>
    </section>`;
    document.title = 'Your PDF is ready — Righteous and Son Inc';
    $('#stepTitle').focus({ preventScroll: true });
    window.scrollTo(0, 0);
    if (push) { try { history.pushState({ step: LAST, ready: true }, ''); } catch (_) { /* ignore */ } } // so Back returns to Review
  }

  async function submit() {
    const errs = stepErrors(LAST);
    const earlier = findProblemSteps();
    if (Object.keys(errs).length || earlier.length) {
      showErrors(errs);
      renderProblems(earlier);
      toast(earlier.length ? 'Some earlier answers need attention' : 'Please fix the highlighted fields');
      return;
    }

    setBusy(true);
    try {
      await loadPdfTools();
      const values = { ...state.data, signedDate: S.isoToday() };
      const signatures = {
        background: dataUrlToBytes(toPNG(state.sig.background)),
        psp: dataUrlToBytes(toPNG(state.sig.psp)),
        final: dataUrlToBytes(toPNG(state.sig.final)),
      };
      const id = newId();
      const files = await window.RSPdf.buildAll({ values, submittedAt: new Date(), id, ip: null }, signatures);
      const copy = await window.RSPdf.buildCombined(files, values.fullName);
      setBusy(false);
      showReady({ id, files, copy });
    } catch (err) {
      setBusy(false);
      console.error('PDF creation failed:', err);
      showSubmitError(navigator.onLine === false
        ? 'You appear to be offline. Check your internet connection and try again.'
        : 'We could not create your PDF. Please try again.');
    }
  }

  /* ---------------------------------------------------------------- events */
  function onValue(t, commit) {
    const path = t.dataset.path;
    if (!path) return;
    let val = t.type === 'checkbox' ? t.checked : t.value;
    if (t.dataset.kind === 'ssn') {
      const f = S.formatSSN(val);
      if (f !== t.value) t.value = f;
      val = f;
    }
    try { setPath(state.data, path, val); } catch (_) { return; }
    if (path === 'fullName') $$('[data-bind="fullName"]').forEach((n) => (n.textContent = val));
    const wrap = wrapFor(path);
    if (wrap && wrap.classList.contains('invalid') && (t.type === 'radio' || t.type === 'checkbox' || !S.isEmpty(val))) {
      if (wrap.dataset.sec) validateOne(path); else setFieldError(wrap, '');
    }
    if (commit) {
      if (syncRepeats()) rerender();
      applyVisibility();
    }
    saveDraft();
  }

  app.addEventListener('input', (e) => onValue(e.target, false));
  app.addEventListener('change', (e) => onValue(e.target, true));
  app.addEventListener('focusout', (e) => {
    const t = e.target;
    const path = t.dataset && t.dataset.path;
    if (!path || t.type === 'radio' || t.type === 'checkbox') return;
    if (t.dataset.kind === 'tel') {
      const f = S.formatPhone(t.value);
      if (f !== t.value) { t.value = f; setPath(state.data, path, f); }
    }
    validateOne(path);
  });

  const onAction = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'add-row') {
      const sec = S.SECTIONS[btn.dataset.sec];
      const rows = state.data[sec.repeat.key];
      if (rows.length < sec.repeat.max) { rows.push(S.newRow(sec)); saveDraft(); rerender(); }
    } else if (a === 'remove-row') {
      const sec = S.SECTIONS[btn.dataset.sec];
      if (confirm('Remove this entry?')) { state.data[sec.repeat.key].splice(+btn.dataset.row, 1); saveDraft(); rerender(); }
    } else if (a === 'clear-sig') {
      const id = btn.dataset.sig;
      if (state.pads[id]) state.pads[id].clear();
      if (id === 'background') {
        // clearing the first signature also clears the linked copies
        ['psp', 'final'].forEach((k) => { if (state.linked[k]) state.sig[k] = []; });
      }
    } else if (a === 'relink-sig') {
      const id = btn.dataset.sig;
      state.sig[id] = clone(state.sig.background);
      state.linked[id] = true;
      if (state.pads[id]) state.pads[id].setStrokes(state.sig[id]);
      const box = $(`.sigbox[data-sig="${id}"]`);
      $('.sigwrap', box).classList.toggle('has-ink', state.sig[id].length > 0);
      btn.hidden = true;
      saveDraft();
    } else if (a === 'goto') {
      goStep(+btn.dataset.step);
    } else if (a === 'share') {
      sharePdf();
    } else if (a === 'download') {
      downloadPdf();
    } else if (a === 'download-separate') {
      downloadSeparate();
    } else if (a === 'preview') {
      previewPdf();
    } else if (a === 'close-viewer') {
      closeViewer();
    } else if (a === 'copy-emails') {
      const list = MAIL_TO.replace(',', ', ');
      (navigator.clipboard ? navigator.clipboard.writeText(list) : Promise.reject()).then(() => toast('Email addresses copied'), () => toast(list));
    } else if (a === 'edit') {
      goStep(LAST);
    } else if (a === 'dismiss-restore') {
      state.restored = false;
      const b = $('#restoreBanner');
      if (b) b.remove();
    } else if (a === 'reset') {
      if (confirm('Erase everything you entered on this device and start over?')) {
        clearDraft();
        location.reload();
      }
    }
  };
  app.addEventListener('click', onAction);
  viewer.addEventListener('click', onAction);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !viewer.hidden) closeViewer(); });

  $('#nextBtn').addEventListener('click', onNext);
  $('#backBtn').addEventListener('click', () => { if (!state.busy && state.step > 0) goStep(state.step - 1); });
  window.addEventListener('popstate', (e) => {
    if (state.busy) return;
    const st = e.state || {};
    if (!viewer.hidden) { hideViewer(); return; } // Back closes the preview and stays on the "PDF ready" screen
    if (st.ready && state.result) {
      showReady(state.result, { push: false });
      return;
    }
    state.step = typeof st.step === 'number' ? st.step : 0;
    render({ focusTitle: true });
    window.scrollTo(0, 0);
  });

  /* ---------------------------------------------------------------- start */
  loadDraft();
  syncRepeats();
  try { history.replaceState({ step: state.step }, ''); } catch (_) { /* ignore */ }
  render();
})();
