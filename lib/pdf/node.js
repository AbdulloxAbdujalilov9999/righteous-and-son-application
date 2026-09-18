/* Node entry (used by scripts/sample.js): reads fonts and the logo from ./public. */
const fs = require('fs');
const path = require('path');
const kit = require('./kit');

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const cache = {};
const read = (p) => cache[p] || (cache[p] = fs.readFileSync(p));

kit.setAssets({
  font: async (file) => read(path.join(PUBLIC, 'fonts', file)),
  logo: async () => read(path.join(PUBLIC, 'img', 'logo.png')),
});

module.exports = require('./index');
