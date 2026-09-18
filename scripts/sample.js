/* Generates sample PDFs into ./out/sample so the layout can be inspected without the web form. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const S = require('../public/js/schema.js');
const { buildAll, buildCombined } = require('../lib/pdf');

/** Tiny PNG writer: draws a wavy "signature" stroke on a transparent canvas. */
function fakeSignature(w = 600, h = 200) {
  const px = Buffer.alloc(w * h * 4);
  const dot = (cx, cy, r) => {
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++)
      for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px.writeUInt32BE(0x0a0a0aff, (y * w + x) * 4);
  };
  for (let t = 0; t < 1; t += 0.0008) {
    const x = Math.round(30 + t * (w - 60));
    const y = Math.round(h / 2 + Math.sin(t * 22) * 42 * Math.sin(t * Math.PI) + Math.cos(t * 9) * 14);
    dot(x, y, 3);
  }
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const work = (i) => ({
  company: ['Swift Logistics LLC', 'Blue Ridge Freight Inc', 'Tampa Bay Carriers'][i] || 'ABC Transport ' + i,
  start: `20${18 + i}-03-01`,
  end: `20${19 + i}-11-15`,
  address: `${100 + i} Fleet Rd`,
  cityStateZip: 'Atlanta, GA 30301',
  country: 'United States',
  phone: '(555) 987-6543',
  position: 'OTR Driver',
  reason: 'Better pay and home time',
  terminated: 'No',
  curr: 'No',
  contact: 'Yes',
  cmv: 'Yes',
  fmcsa: 'Yes',
  safety: 'Yes',
  areas: 'Southeast, Midwest',
  miles: '2,800',
  pay: '65',
  truck: 'Kenworth T680',
  trailer: 'Dry van',
  trailerLen: '53 ft',
});

function sampleValues() {
  return {
    ...S.defaults(),
    fullName: 'Oʻktam Abdujalilov Иванов',
    address: '902 Britton St, Apt 4B',
    cityStateZip: 'Largo, FL 33770',
    country: 'United States',
    residence3: 'No',
    prevAddresses: '567 Elm St, Orlando, FL 32801\n12 Palm Ave, Tampa, FL 33601',
    ssn: '123-45-6789',
    dob: '1988-07-14',
    phone: '(727) 555-0142',
    email: 'driver@example.com',
    position: 'Owner Operator',
    ownerOp: 'Yes',
    eqDesc: 'Semi-Tractor', eqType: 'Sleeper Conventional', eqYear: '2021', eqMake: 'Freightliner', eqModel: 'Cascadia',
    eqColor: 'White', eqVin: '1FUJGLDR8MLAB1234', eqWeight: '19,500 lbs', eqMileage: '250,000', eqFifth: '47 inches',
    location: 'Largo, FL', eligibleUS: 'Yes', currentlyEmployed: 'No', lastEmpEnd: '2025-12-01', english: 'Yes',
    workedBefore: 'Yes', workedBeforeNotes: '05/2021 – 11/2022, Largo FL, Solo Driver, moved out of state',
    twic: 'Yes', twicExp: '2028-02-01', otherName: 'Yes', otherNameText: 'Aktam Abdujalilov',
    referral: 'Driver Referral', referralDriver: 'Jane Smith',
    expStraight: '1 Year', expSemi: '5+ Years', expTwo: 'None', expOther: 'None',
    lic1Number: 'D123-456-789-0', lic1Authority: 'Florida / FLHSMV', lic1Country: 'United States', lic1Class: 'Class A (CDL)',
    lic1Exp: '2028-05-10', lic1DotExp: '2027-01-20', lic1Current: 'Yes', lic1IsCdl: 'Yes', lic1Tanker: true, lic1Hazmat: true, lic1Doubles: true,
    hasLic2: 'Yes', lic2Number: 'GA-99887766', lic2Authority: 'Georgia', lic2Country: 'United States', lic2Class: 'Class B (CDL)',
    lic2Exp: '2027-09-01', lic2DotExp: '2027-01-20', lic2Current: 'No', lic2IsCdl: 'Yes',
    work: [work(0), work(1), { unemployed: true, start: '2016-01-01', end: '2017-06-30' }, work(2)],
    attendedSchool: 'Yes', schStart: '2015-01-10', schEnd: '2015-03-10', school: 'National Truck Academy', schAddr1: '100 Training Blvd',
    schCityState: 'Jacksonville, FL', schCountry: 'United States', schPhone: '(555) 234-5678', schGrad: 'Yes', schFmcsr: 'Yes', schSafety: 'No',
    schGpa: '3.8', schHours: '160', schBorder: true, schLogs: true, schFmcsrRegs: true,
    fmcsrDisq: 'No', fmcsrSusp: 'Yes', fmcsrDenied: 'No', fmcsrDrug: 'No', fmcsrConv: 'No',
    fmcsrExplain: 'License suspended for 30 days in 2019 for unpaid ticket; reinstated the same month.',
    hadAccident: 'Yes',
    accidents: [
      { type: 'Minor scrape', date: '2023-04-02', hazmat: 'No', towed: 'No', city: 'Macon', state: 'GA', commercial: 'Yes', dotRec: 'No', fault: 'No', ticketed: 'No', desc: 'Side-mirror clip in lot, no injuries.' },
    ],
    hadViolations: 'Yes', violationDetails: '03/2024 — Speeding 8 over, Ocala FL, paid fine.',
    ack_psp: true, ack_drug: true, ack_clearinghouse: true,
    signedDate: S.isoToday(),
  };
}

async function main() {
  const outDir = path.join(__dirname, '..', 'out', 'sample');
  fs.mkdirSync(outDir, { recursive: true });
  const values = sampleValues();
  const errs = S.validateAll(values);
  if (Object.keys(errs).length) console.warn('Sample fails validation:', errs);
  const t0 = Date.now();
  const sig = fakeSignature();
  const files = await buildAll({ values, submittedAt: new Date(), id: 'RS-SAMPLE01', ip: '203.0.113.7' }, { background: sig, psp: sig, final: sig });
  const combined = await buildCombined(files, values.fullName);
  files.forEach((f) => fs.writeFileSync(path.join(outDir, f.filename), f.bytes));
  fs.writeFileSync(path.join(outDir, combined.filename), combined.bytes);
  console.log('Built in', Date.now() - t0, 'ms');
  files.forEach((f) => console.log(' ', f.filename, (f.bytes.length / 1024).toFixed(0) + ' KB'));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { sampleValues, fakeSignature };
