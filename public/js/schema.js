/*
 * Application schema — single source of truth for the form UI, validation, and the PDF.
 * Runs in the browser (global RSSchema) and in Node (require).
 * Question wording follows "Job Application and History.pdf".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RSSchema = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const YN = ['Yes', 'No'];
  const EXPERIENCE = ['None', '1 Year', '2 Years', '3-5 Years', '5+ Years'];
  const yes = (id) => (v) => v[id] === 'Yes';
  const rowYes = (id) => (v, r) => !!r && r[id] === 'Yes';

  const truckYears = () => {
    const now = new Date().getFullYear();
    const out = [];
    for (let y = now + 1; y >= now - 35; y--) out.push(String(y));
    return out;
  };

  /* ---------- field helpers ---------- */
  const text = (id, label, o = {}) => ({ type: 'text', id, label, ...o });
  const date = (id, label, o = {}) => ({ type: 'date', id, label, ...o });
  const yn = (id, label, o = {}) => ({ type: 'yesno', id, label, ...o });
  const sel = (id, label, options, o = {}) => ({ type: 'select', id, label, options, ...o });
  const area = (id, label, o = {}) => ({ type: 'textarea', id, label, ...o });
  const chk = (id, label, o = {}) => ({ type: 'check', id, label, ...o });
  const head = (label, o = {}) => ({ type: 'heading', id: 'h_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, ...o });

  const license = (p, n, required) => {
    const on = (o = {}) => ({ required, ...o });
    return [
      text(p + 'Number', 'License Number', on({ placeholder: 'e.g. D123-456-789-0', autocomplete: 'off' })),
      text(p + 'Authority', 'Licensing Authority', on({ placeholder: 'e.g. Florida / FLHSMV' })),
      text(p + 'Country', 'Country', on({ placeholder: 'e.g. United States' })),
      sel(p + 'Class', 'License Class', ['Class A (CDL)', 'Class B (CDL)', 'Class C (CDL)', 'Non-CDL'], on()),
      date(p + 'Exp', 'License Expiration Date', on({ future: true })),
      date(p + 'DotExp', 'DOT Medical Card Expiration Date', on({ future: true })),
      yn(p + 'Current', 'Current License', on()),
      yn(p + 'IsCdl', 'Commercial Driver License', on()),
      head('Endorsements'),
      chk(p + 'Tanker', 'Tanker Endorsement'),
      chk(p + 'Hazmat', 'HAZMAT Endorsement'),
      chk(p + 'X', 'X Endorsement'),
      chk(p + 'Doubles', 'Doubles / Triples Endorsement'),
      chk(p + 'OtherEnd', 'Other Endorsement'),
    ];
  };

  /* ---------- sections ---------- */
  const SECTIONS = {
    personal: {
      id: 'personal',
      title: 'Personal Information',
      fields: [
        text('fullName', 'Full legal name', { pdfLabel: 'Name', required: true, autocomplete: 'name', placeholder: 'e.g. John Doe' }),
        text('address', 'Current address', { pdfLabel: 'Current Address', required: true, autocomplete: 'address-line1', placeholder: 'e.g. 1234 Main St, Apt 4B' }),
        text('cityStateZip', 'City, State/Province, Zip/Postal', { pdfLabel: 'City, State/Province Zip/Postal', required: true, autocomplete: 'off', placeholder: 'e.g. Tampa, FL 33601' }),
        text('country', 'Country', { required: true, autocomplete: 'country-name', default: 'United States' }),
        yn('residence3', 'Have you lived at this address for 3 years or longer?', { pdfLabel: 'Residence 3 years or longer (If No, previous addresses shown below)', required: true }),
        area('prevAddresses', 'Previous addresses (past 3 years)', { showIf: (v) => v.residence3 === 'No', required: true, placeholder: 'e.g. 567 Elm St, Orlando, FL 32801' }),
        { type: 'ssn', id: 'ssn', label: 'SSN/SIN', required: true, placeholder: 'XXX-XX-XXXX', sensitive: true },
        date('dob', 'Date of Birth', { required: true, dob: true, autocomplete: 'bday' }),
        { type: 'tel', id: 'phone', label: 'Primary Phone', pdfLabel: 'Primary Phone', required: true, autocomplete: 'tel', placeholder: '(555) 123-4567' },
        { type: 'email', id: 'email', label: 'Email', required: true, autocomplete: 'email', placeholder: 'you@example.com' },
      ],
    },

    company: {
      id: 'company',
      title: 'Company Questions',
      subtitle: 'General Information',
      pdfSub: 'GENERAL INFORMATION',
      fields: [
        sel('position', 'What position are you applying for?', ['CDL-A Driver', 'Owner Operator', 'Fleet Driver', 'Non-CDL Driver'], { required: true }),
        yn('ownerOp', 'Are you an Owner Operator or Fleet Owner?', { pdfLabel: 'If you answered "Owner Operator" or Fleet Owner, select yes.', required: true }),

        head('Equipment (Owner/Operators only)', { showIf: yes('ownerOp') }),
        text('eqDesc', 'Equipment Description (Tractor)', { showIf: yes('ownerOp'), placeholder: 'e.g. Semi-Tractor' }),
        sel('eqType', 'Type', ['Sleeper Conventional', 'Day Cab', 'Box Truck / Straight Truck', 'Flatbed', 'Refrigerated (Reefer)', 'Step Deck / Lowboy', 'Other'], { showIf: yes('ownerOp'), required: yes('ownerOp') }),
        sel('eqYear', 'Year', truckYears, { showIf: yes('ownerOp'), required: yes('ownerOp') }),
        text('eqMake', 'Make', { showIf: yes('ownerOp'), required: yes('ownerOp'), placeholder: 'e.g. Freightliner' }),
        text('eqModel', 'Model', { showIf: yes('ownerOp'), required: yes('ownerOp'), placeholder: 'e.g. Cascadia' }),
        text('eqColor', 'Color', { showIf: yes('ownerOp'), placeholder: 'e.g. White' }),
        text('eqVin', 'VIN', { showIf: yes('ownerOp'), required: yes('ownerOp'), placeholder: '17 characters', maxlength: 17, autocapitalize: 'characters' }),
        text('eqWeight', 'Weight', { showIf: yes('ownerOp'), placeholder: 'e.g. 19,500 lbs' }),
        text('eqMileage', 'Mileage', { showIf: yes('ownerOp'), placeholder: 'e.g. 250,000', inputmode: 'numeric' }),
        text('eqFifth', 'Fifth Wheel Height', { showIf: yes('ownerOp'), placeholder: 'e.g. 47 inches' }),

        text('location', 'What location are you applying for?', { required: true, placeholder: 'e.g. Largo, FL' }),
        yn('eligibleUS', 'Are you legally eligible for employment in the United States?', { required: true }),
        yn('currentlyEmployed', 'Are you currently employed?', { required: true }),
        date('lastEmpEnd', 'What date did your last employment end?', { showIf: (v) => v.currentlyEmployed === 'No', required: (v) => v.currentlyEmployed === 'No', past: true }),
        yn('english', 'Do you read, write, and speak English?', { required: true }),
        yn('workedBefore', 'Have you ever worked for this company before?', { required: true }),
        area('workedBeforeNotes', 'Enter start and end dates, location, position, and reason for leaving:', { showIf: yes('workedBefore'), required: yes('workedBefore'), placeholder: 'e.g. 05/2021 – 11/2022, Largo FL, Solo Driver, moved' }),
        yn('twic', 'Do you have a current TWIC card?', { required: true }),
        date('twicExp', 'Expiration date:', { showIf: yes('twic'), required: yes('twic'), future: true }),
        yn('otherName', 'Have you ever been known by any other name?', { required: true }),
        text('otherNameText', 'Enter name:', { showIf: yes('otherName'), required: yes('otherName') }),
        sel('referral', 'How did you hear about us?', ['HR team reached me', 'Driver Referral', 'Indeed', 'Craigslist', 'Social Media', 'Other'], { required: true }),
        text('referralDriver', 'Please enter the referring driver’s name', { pdfLabel: 'If "Driver Referral", please enter the driver\'s name', showIf: (v) => v.referral === 'Driver Referral', required: (v) => v.referral === 'Driver Referral' }),
        text('referralOther', 'Please explain', { pdfLabel: 'If "Other", please explain', showIf: (v) => v.referral === 'Other', required: (v) => v.referral === 'Other' }),
      ],
    },

    experience: {
      id: 'experience',
      title: 'Driving Experience',
      note: 'For each class of equipment, select years of experience. If no experience in a class, select "None".',
      fields: [
        sel('expStraight', 'Straight Truck', EXPERIENCE, { required: true }),
        sel('expSemi', 'Tractor and Semi-Trailer', EXPERIENCE, { required: true }),
        sel('expTwo', 'Tractor - Two Trailers', EXPERIENCE, { required: true }),
        sel('expOther', 'Other', EXPERIENCE, { required: true }),
      ],
    },

    license1: { id: 'license1', title: 'Licenses', subtitle: 'Primary license', fields: license('lic1', 1, true) },
    license2: {
      id: 'license2',
      title: 'Licenses',
      pdfTitle: 'Licenses (Second License)',
      subtitle: 'Second license (optional)',
      fields: [yn('hasLic2', 'Do you hold a second license?', { pdfHide: true }), ...license('lic2', 2, yes('hasLic2')).map((f) => ({ ...f, showIf: yes('hasLic2') }))],
    },

    work: {
      id: 'work',
      title: 'Please Enter Your Last 10 Years of Work History',
      pdfTitle: 'Employment/Unemployment',
      note: 'Start with your most recent job. Include periods when you were not working.',
      repeat: { key: 'work', min: 1, max: 8, itemTitle: 'Employment / Unemployment', addLabel: 'Add another employer or gap' },
      fields: [
        chk('unemployed', 'This was a period of unemployment (no employer)', { pdfHide: true }),
        text('company', 'Company', { required: (v, r) => !r.unemployed, showIf: (v, r) => !r.unemployed, autocomplete: 'off', placeholder: 'e.g. Swift Logistics LLC' }),
        date('start', 'Start Date', { required: true, past: true }),
        date('end', 'End Date', { required: (v, r) => r.curr !== 'Yes', showIf: (v, r) => r.curr !== 'Yes', past: true }),
        text('address', 'Address', { showIf: (v, r) => !r.unemployed, autocomplete: 'off' }),
        text('cityStateZip', 'City, State/Province Zip/Postal', { showIf: (v, r) => !r.unemployed, autocomplete: 'off', placeholder: 'e.g. Atlanta, GA 30301' }),
        text('country', 'Country', { showIf: (v, r) => !r.unemployed, autocomplete: 'off', placeholder: 'e.g. United States' }),
        { type: 'tel', id: 'phone', label: 'Phone', showIf: (v, r) => !r.unemployed, autocomplete: 'off', placeholder: '(555) 987-6543' },
        text('position', 'Position Held', { showIf: (v, r) => !r.unemployed, placeholder: 'e.g. OTR Driver' }),
        text('reason', 'Reason for leaving?', { showIf: (v, r) => r.curr !== 'Yes', placeholder: 'e.g. Pay / relocation' }),
        yn('terminated', 'Were you terminated/discharged/laid off?', { showIf: (v, r) => !r.unemployed, required: (v, r) => !r.unemployed }),
        yn('curr', 'Is this your current employer?', { showIf: (v, r) => !r.unemployed, required: (v, r) => !r.unemployed }),
        yn('contact', 'May we contact this employer at this time?', { showIf: (v, r) => !r.unemployed, required: (v, r) => !r.unemployed }),
        yn('cmv', 'Did you operate a commercial motor vehicle?', { showIf: (v, r) => !r.unemployed, required: (v, r) => !r.unemployed }),
        yn('fmcsa', 'Were you subject to the US Federal Motor Carrier Safety Administration (FMCSA) or Transport Canada Safety Regulations while employed/contracted by this employer/contractor?', { showIf: (v, r) => !r.unemployed, required: (v, r) => !r.unemployed }),
        yn('safety', 'Did you perform any safety sensitive functions in this job, regulated by DOT, and subject to drug and alcohol testing?', { showIf: (v, r) => !r.unemployed, required: (v, r) => !r.unemployed }),
        text('areas', 'Areas Driven', { showIf: (v, r) => !r.unemployed && r.cmv === 'Yes', placeholder: 'e.g. Southeast, Midwest' }),
        text('miles', 'Miles driven weekly', { showIf: (v, r) => !r.unemployed && r.cmv === 'Yes', placeholder: 'e.g. 2,800', inputmode: 'numeric' }),
        text('pay', 'Pay Range (cents/mile)', { showIf: (v, r) => !r.unemployed && r.cmv === 'Yes', placeholder: 'e.g. 65' }),
        text('truck', 'Most common truck driven', { showIf: (v, r) => !r.unemployed && r.cmv === 'Yes', placeholder: 'e.g. Kenworth T680' }),
        text('trailer', 'Most common trailer', { showIf: (v, r) => !r.unemployed && r.cmv === 'Yes', placeholder: 'e.g. Dry van' }),
        text('trailerLen', 'Trailer length', { showIf: (v, r) => !r.unemployed && r.cmv === 'Yes', placeholder: 'e.g. 53 ft' }),
      ],
    },

    school_q: {
      id: 'school_q',
      title: 'Trucking School',
      fields: [yn('attendedSchool', 'Did you attend a trucking school?', { required: true, pdfLabel: 'Attended a trucking school?' })],
    },
    school: {
      id: 'school',
      title: 'Trucking School',
      pdfTitle: 'Trucking School — Details',
      showIf: yes('attendedSchool'),
      fields: [
        date('schStart', 'Start Date', { past: true }),
        date('schEnd', 'End Date', { past: true }),
        text('school', 'School', { required: true, placeholder: 'e.g. National Truck Academy' }),
        text('schAddr1', 'Address', { autocomplete: 'off' }),
        text('schAddr2', 'Address 2', { autocomplete: 'off' }),
        text('schCityState', 'City, State/Province', { autocomplete: 'off', placeholder: 'e.g. Jacksonville, FL' }),
        text('schCountry', 'Country', { autocomplete: 'off', placeholder: 'e.g. United States' }),
        { type: 'tel', id: 'schPhone', label: 'Phone', autocomplete: 'off', placeholder: '(555) 234-5678' },
        yn('schGrad', 'Did you graduate?', { required: true }),
        yn('schFmcsr', 'Were you subject to the Federal Motor Carrier or Transport Canada Safety Regulations while attending this truck school?'),
        yn('schSafety', 'Did you perform any safety sensitive functions at this truck school, regulated by DOT, and subject to drug and alcohol testing?'),
        text('schGpa', 'GPA', { placeholder: 'e.g. Pass / 3.8' }),
        text('schHours', 'Hours of Instruction', { placeholder: 'e.g. 160', inputmode: 'numeric' }),
        head('Subjects covered'),
        chk('schBorder', 'Border Crossing'),
        chk('schLogs', 'Log Books'),
        chk('schFmcsrRegs', 'Federal Motor Carrier Regulations'),
        chk('schHazmat', 'Hazardous Materials'),
      ],
    },

    fmcsr: {
      id: 'fmcsr',
      title: 'FMCSR',
      fields: [
        yn('fmcsrDisq', 'Under FMCSR 391.15, are you currently disqualified from driving a commercial motor vehicle? [49 CFR 391.15]', { required: true }),
        yn('fmcsrSusp', 'Has your license, permit or privilege to drive ever been suspended or revoked for any reason? [49 CFR 391.21 (b)(9)]', { required: true }),
        yn('fmcsrDenied', 'Have you ever been denied a license, permit, or privilege to operate a motor vehicle? [49 CFR 391.21 (b)(9)]', { required: true }),
        yn('fmcsrDrug', 'Within the past two years, have you tested positive, or refused to test, on a pre-employment drug or alcohol test by an employer to whom you applied, but did not obtain, safety-sensitive transportation work covered by DOT agency drug and alcohol testing rules? [49 CFR 40.25(j)]', { required: true }),
        yn('fmcsrConv', 'In the past three (3) years, have you ever been convicted of any of the following offenses: [49 CFR 391.15]:', {
          required: true,
          bullets: [
            'Driving a commercial motor vehicle with a blood alcohol concentration ("BAC") of .04 percent or more',
            'Driving under the influence of alcohol, as prescribed by state law',
            'Refusal to undergo drug and alcohol testing as required by any jurisdiction for the enforcement of Federal Motor Carrier Safety Act regulations',
            'Driving a commercial motor vehicle under the influence of any 21 C.F.R. 1308.11 Schedule I identified controlled substances, an amphetamine, a narcotic drug, a formulation of an amphetamine, or a derivative of a narcotic drug',
            'Transportation, possession, or unlawful use of a 21 C.F.R. 1308.11 Schedule I identified controlled substance, amphetamines, narcotic drugs, formulations of an amphetamine, or derivatives of narcotic drugs while you were on duty driving for a motor carrier',
            'Leaving the scene of an accident while operating a commercial motor vehicle',
            'Or any other felony involving the use of a commercial motor vehicle',
          ],
        }),
        area('fmcsrExplain', 'Please explain your "Yes" answer(s) above', {
          showIf: (v) => ['fmcsrDisq', 'fmcsrSusp', 'fmcsrDenied', 'fmcsrDrug', 'fmcsrConv'].some((k) => v[k] === 'Yes'),
          required: (v) => ['fmcsrDisq', 'fmcsrSusp', 'fmcsrDenied', 'fmcsrDrug', 'fmcsrConv'].some((k) => v[k] === 'Yes'),
          pdfLabel: 'Explanation of "Yes" answer(s)',
        }),
      ],
    },

    accident_q: {
      id: 'accident_q',
      title: 'Vehicle Accident Record',
      fields: [yn('hadAccident', 'Were you involved in any accidents/incidents with any vehicle in the last 5 years (even if not at fault)?', { required: true })],
    },
    accidents: {
      id: 'accidents',
      title: 'Vehicle Accident Record',
      showIf: yes('hadAccident'),
      repeat: { key: 'accidents', min: 1, max: 6, itemTitle: 'Accident / Incident', addLabel: 'Add another accident or incident' },
      fields: [
        text('type', 'Type of Accident / Incident', { required: true, placeholder: 'e.g. Rear-end collision' }),
        date('date', 'Date of Accident / Incident', { required: true, past: true }),
        yn('hazmat', 'Hazmat Accident / Incident', { required: true }),
        yn('towed', 'Was any vehicle towed away?', { required: true }),
        text('city', 'City', { required: true }),
        text('state', 'State/Province', { required: true }),
        yn('commercial', 'Were you in a commercial vehicle?', { required: true }),
        yn('dotRec', 'If yes, was this a Department of Transportation recordable accident?', { showIf: rowYes('commercial'), required: rowYes('commercial') }),
        yn('fault', 'Were you at fault?', { required: true }),
        yn('ticketed', 'Were you ticketed?', { required: true }),
        area('desc', 'Description:', { placeholder: 'What happened? Any injuries?' }),
      ],
    },

    violations: {
      id: 'violations',
      title: 'Traffic Convictions \\ Violations',
      fields: [
        yn('hadViolations', 'Have you had any moving violations or traffic convictions in the past 3 years?', { required: true }),
        area('violationDetails', 'Please list each one (date, offense, location, result)', { showIf: yes('hadViolations'), required: yes('hadViolations'), pdfLabel: 'Details' }),
      ],
    },
  };

  // Wizard steps. `sections` reference SECTIONS ids above.
  const STEPS = [
    { id: 'background', title: 'Background Check', short: 'Background', kind: 'consent', doc: 'background' },
    { id: 'psp', title: 'PSP Disclosure', short: 'PSP', kind: 'consent', doc: 'psp' },
    { id: 'about', title: 'About You', short: 'About you', sections: ['personal', 'company'] },
    { id: 'licenses', title: 'Experience & Licenses', short: 'Licenses', sections: ['experience', 'license1', 'license2'] },
    { id: 'history', title: 'Work History', short: 'History', sections: ['work', 'school_q', 'school'] },
    { id: 'record', title: 'Driving Record', short: 'Record', sections: ['fmcsr', 'accident_q', 'accidents', 'violations'] },
    { id: 'sign', title: 'Review & Sign', short: 'Sign', kind: 'review' },
  ];

  // Order the sections appear in the application PDF.
  const PDF_ORDER = ['personal', 'company', 'experience', 'license1', 'license2', 'work', 'school_q', 'school', 'fmcsr', 'accident_q', 'accidents', 'violations'];

  /* ---------- value helpers ---------- */
  const isEmpty = (val) => val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
  const digits = (s) => String(s || '').replace(/\D/g, '');

  function fieldOptions(f) {
    return typeof f.options === 'function' ? f.options() : f.options || [];
  }
  function isShown(f, v, row) {
    return !f.showIf || !!f.showIf(v, row || {});
  }
  function isRequired(f, v, row) {
    if (f.type === 'heading' || f.type === 'check') return false;
    return typeof f.required === 'function' ? !!f.required(v, row || {}) : !!f.required;
  }
  function sectionShown(sec, v) {
    return !sec.showIf || !!sec.showIf(v);
  }

  function isoToday() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }

  function fmtDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? m[2] + '/' + m[3] + '/' + m[1] : s || '';
  }

  function formatSSN(raw) {
    const d = digits(raw).slice(0, 9);
    if (d.length <= 3) return d;
    if (d.length <= 5) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5);
  }

  function formatPhone(raw) {
    const s = String(raw || '');
    if (s.trim().startsWith('+')) return s; // international — leave alone
    const d = digits(s).slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  /** Returns an error message or '' for a single visible field. */
  function validateField(f, val, v, row) {
    if (!isShown(f, v, row) || f.type === 'heading') return '';
    if (isEmpty(val)) return isRequired(f, v, row) ? 'Required' : '';
    const s = String(val).trim();
    switch (f.type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? '' : 'Enter a valid email address';
      case 'tel': {
        const n = digits(s).length;
        return n >= 10 && n <= 15 ? '' : 'Enter a valid phone number';
      }
      case 'ssn':
        return digits(s).length === 9 ? '' : 'Enter all 9 digits';
      case 'date': {
        const d = parseISO(s);
        if (!d) return 'Enter a valid date';
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (f.dob) {
          const age = (now - d) / (365.25 * 864e5);
          if (d > now) return 'Date of birth cannot be in the future';
          if (age < 18) return 'You must be at least 18';
          if (age > 100) return 'Check the date of birth';
        } else if (f.past && d > now) {
          return 'Date cannot be in the future';
        }
        return '';
      }
      case 'select':
        return fieldOptions(f).includes(s) ? '' : 'Choose an option';
      case 'yesno':
        return YN.includes(s) ? '' : 'Choose Yes or No';
      case 'text':
        return s.length > 200 ? 'Too long (200 characters max)' : '';
      case 'textarea':
        return s.length > 2000 ? 'Too long (2000 characters max)' : '';
      default:
        return '';
    }
  }

  /** Validate one section. Returns { 'fieldId' | 'key.index.fieldId': message }. */
  function validateSection(sec, v) {
    const errors = {};
    if (!sectionShown(sec, v)) return errors;
    if (sec.repeat) {
      const rows = Array.isArray(v[sec.repeat.key]) ? v[sec.repeat.key] : [];
      if (rows.length < sec.repeat.min) errors[sec.repeat.key + '.0._'] = 'Add at least one entry';
      rows.forEach((row, i) => {
        sec.fields.forEach((f) => {
          const msg = validateField(f, row[f.id], v, row);
          if (msg) errors[sec.repeat.key + '.' + i + '.' + f.id] = msg;
        });
      });
      return errors;
    }
    sec.fields.forEach((f) => {
      const msg = validateField(f, v[f.id], v, v);
      if (msg) errors[f.id] = msg;
    });
    return errors;
  }

  function validateAll(v) {
    let errors = {};
    Object.values(SECTIONS).forEach((sec) => {
      errors = { ...errors, ...validateSection(sec, v) };
    });
    return errors;
  }

  function newRow(sec) {
    const row = {};
    sec.fields.forEach((f) => {
      if (f.default !== undefined) row[f.id] = f.default;
    });
    return row;
  }

  function defaults() {
    const v = {};
    Object.values(SECTIONS).forEach((sec) => {
      if (sec.repeat) {
        v[sec.repeat.key] = sec.repeat.key === 'work' ? [newRow(sec)] : [];
      } else {
        sec.fields.forEach((f) => {
          if (f.default !== undefined) v[f.id] = f.default;
        });
      }
    });
    return v;
  }

  return {
    YN, SECTIONS, STEPS, PDF_ORDER,
    isEmpty, digits, fieldOptions, isShown, isRequired, sectionShown,
    isoToday, fmtDate, parseISO, formatSSN, formatPhone,
    validateField, validateSection, validateAll, newRow, defaults,
  };
});
