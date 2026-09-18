(function () {
  'use strict';

  const S = window.RSSchema;
  const C = window.RSConsents;
  const { SignaturePad, toPNG } = window.RSSignaturePad;
  const STEPS = S.STEPS;
  const LAST = STEPS.length - 1;
  const DRAFT_KEY = 'rs_application_draft_v1';
  const MAIL_TO = 'righteousandson.inc@gmail.com,jscott.righteousandson@gmail.com';

  const LEAD = {
    background: 'Read the authorization below, then sign at the bottom. You only draw your signature once — we reuse it on the other forms, and you can change it there.',
    psp: 'This is the required FMCSA disclosure. Please read it, then sign at the bottom.',
    about: 'Tell us about yourself and the job you are applying for.',
    licenses: 'Your driving experience and license details.',
    history: 'List your work for the last 10 years, starting with the most recent.',
    record: 'Answer every question. If you answer Yes, we will ask for details.',
    sign: 'Check everything, agree to the statements, and sign to submit.',
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
        const { ssn, ...rest } = state.data; // never keep the SSN on the device
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
      const nameField = S.SECTIONS.personal.fields.find((f) => f.id === 'fullName');
      return `<section class="card">${fieldsHTMLSingle(nameField, 'Your full legal name')}</section>
        <section class="card legal">${blocksHTML(C.BACKGROUND_CHECK.blocks)}</section>
        <section class="card">${sigBoxHTML('background', 'Your signature')}<p class="small">By signing, I agree to the Background Check authorization above.</p></section>`;
    }
    return `<section class="card legal"><p class="banner-text">${esc(C.PSP.banner)}</p>${blocksHTML(C.PSP.blocks)}</section>
      <section class="card">${sigBoxHTML('psp', 'Your signature')}<p class="small">By signing, I agree to the PSP Disclosure and Authorization above.</p></section>
      <section class="card legal"><p class="notice">${C.PSP.notices.map(esc).join('</p><p class="notice">')}</p></section>`;
  }

  function fieldsHTMLSingle(f, label) {
    return `<div class="grid">${fieldHTML(f, f.id, S.SECTIONS.personal, null, label).replace('class="field"', 'class="field wide"')}</div>`;
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

  function render({ focusTitle = false } = {}) {
    destroyPads();
    const step = STEPS[state.step];
    let html = '';
    if (state.restored) {
      html += `<div class="banner info" id="restoreBanner"><p><strong>Welcome back.</strong> We restored your saved answers on this device. For your security your SSN is never saved — please enter it again.</p><div class="row"><button type="button" class="link-btn" data-action="dismiss-restore">Dismiss</button><button type="button" class="link-btn" data-action="reset">Start over</button></div></div>`;
    }
    html += `<h1 class="step-title" id="stepTitle" tabindex="-1">${esc(step.title)}</h1><p class="step-lead">${esc(LEAD[step.id] || '')}</p>`;
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
    next.textContent = state.step === LAST ? 'Submit application' : 'Continue';
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
      if (i === 0) {
        const nameField = S.SECTIONS.personal.fields.find((f) => f.id === 'fullName');
        const m = S.validateField(nameField, state.data.fullName, state.data, state.data);
        if (m) errs.fullName = m;
        else if (String(state.data.fullName).trim().split(/\s+/).length < 2) errs.fullName = 'Enter your first and last name';
      }
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

  function b64ToBlob(b64, type) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  function downloadCopy(copy) {
    const url = URL.createObjectURL(b64ToBlob(copy.base64, 'application/pdf'));
    const a = document.createElement('a');
    a.href = url;
    a.download = copy.filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return url;
  }

  function showSubmitError(message) {
    const box = $('#submitError');
    if (!box) return;
    const name = state.data.fullName || '';
    const mailto = `mailto:${MAIL_TO}?subject=${encodeURIComponent('Driver Application - ' + name)}&body=${encodeURIComponent('Please find my completed driver application attached (PDF).\n\nName: ' + name)}`;
    box.innerHTML = `<div class="banner error"><p><strong>${esc(message)}</strong></p>${state.copy ? `<p>Your answers are still on this page. You can try again, or save your PDF and email it to the company.</p><div class="row"><button type="button" class="btn btn-secondary btn-small" data-action="download">Download my PDF</button><a class="btn btn-secondary btn-small" href="${esc(mailto)}">Email it instead</a></div>` : ''}</div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showSuccess(res) {
    state.copy = res.copy || null;
    clearDraft();
    destroyPads();
    $('#actionbar').hidden = true;
    $('#brandStep').textContent = 'Submitted';
    $('#stepCount').textContent = '✓';
    $('#progress').style.setProperty('--p', 100);
    const first = String(state.data.fullName || '').trim().split(/\s+/)[0] || 'there';
    app.innerHTML = `<section class="card done">
      <div class="done-icon" aria-hidden="true"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h1 id="stepTitle" tabindex="-1">Application submitted</h1>
      <p>Thank you, ${esc(first)}. Righteous and Son Inc has received your application and signed consent forms.</p>
      ${res.id && res.id !== 'RS-OK' ? `<p>Reference number<br><span class="ref">${esc(res.id)}</span></p>` : ''}
      ${state.copy ? `<button type="button" class="btn btn-primary" data-action="download">Download my copy (PDF)</button><p class="small">Save this for your records — it will not be shown again after you close this page.</p>` : ''}
    </section>`;
    document.title = 'Application submitted — Righteous and Son Inc';
    $('#stepTitle').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  async function submit() {
    const errs = stepErrors(LAST);
    const earlier = findProblemSteps();
    if (!state.sig.background.length && !earlier.includes(0)) earlier.unshift(0);
    if (Object.keys(errs).length || earlier.length) {
      showErrors(errs);
      renderProblems(earlier);
      toast(earlier.length ? 'Some earlier answers need attention' : 'Please fix the highlighted fields');
      return;
    }

    const payload = {
      values: { ...state.data, signedDate: S.isoToday() },
      signatures: { background: toPNG(state.sig.background), psp: toPNG(state.sig.psp), final: toPNG(state.sig.final) },
      website: ($('#website') || {}).value || '',
    };

    setBusy(true);
    let res = null;
    let networkFail = false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 90000);
    try {
      const r = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl.signal });
      res = await r.json().catch(() => null);
      if (!res) res = { ok: false, error: 'Unexpected response from the server. Please try again.' };
    } catch (_) {
      networkFail = true;
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }

    if (res && res.ok) return showSuccess(res);

    state.copy = (res && res.copy) || null;
    if (res && res.fields) {
      renderProblems(findProblemSteps(Object.keys(res.fields)));
      showErrors(Object.fromEntries(Object.entries(res.fields).filter(([k]) => wrapFor(k))));
    }
    showSubmitError(networkFail
      ? 'We could not reach the server. Check your internet connection and try again — your answers are saved on this page.'
      : (res && res.error) || 'Something went wrong. Please try again.');
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

  app.addEventListener('click', (e) => {
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
    } else if (a === 'download') {
      if (state.copy) downloadCopy(state.copy);
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
  });

  $('#nextBtn').addEventListener('click', onNext);
  $('#backBtn').addEventListener('click', () => { if (!state.busy && state.step > 0) goStep(state.step - 1); });
  window.addEventListener('popstate', (e) => {
    if (state.busy) return;
    const s = e.state && typeof e.state.step === 'number' ? e.state.step : 0;
    state.step = s;
    render({ focusTitle: true });
    window.scrollTo(0, 0);
  });

  /* ---------------------------------------------------------------- start */
  loadDraft();
  syncRepeats();
  try { history.replaceState({ step: state.step }, ''); } catch (_) { /* ignore */ }
  render();
})();
