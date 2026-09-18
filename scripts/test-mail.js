/* Builds the real email (no network) and prints what would be sent. Run: node scripts/test-mail.js */
const nodemailer = require('nodemailer');
const S = require('../public/js/schema.js');
const { buildAll } = require('../lib/pdf');
const mail = require('../lib/mail');
const { sampleValues, fakeSignature } = require('./sample');

(async () => {
  const values = sampleValues();
  const sig = fakeSignature();
  const files = await buildAll({ values, submittedAt: new Date(), id: 'RS-TEST', ip: '203.0.113.7' }, { background: sig, psp: sig, final: sig });
  const mailer = nodemailer.createTransport({ jsonTransport: true });
  const info = await mail.sendApplication({ files, values, id: 'RS-TEST', ip: '203.0.113.7', submittedAt: new Date() }, mailer);
  const msg = JSON.parse(info.message);
  console.log('From:    ', JSON.stringify(msg.from));
  console.log('To:      ', msg.to.map((t) => t.address).join(', '));
  console.log('Reply-To:', JSON.stringify(msg.replyTo));
  console.log('Subject: ', msg.subject);
  msg.attachments.forEach((a) => console.log('Attach:  ', a.filename, a.contentType, Math.round((a.content.length * 3) / 4 / 1024) + ' KB'));
  console.log('\n' + msg.text);
})().catch((e) => { console.error(e); process.exit(1); });
