/* Browser entry: bundled to public/js/pdf.bundle.js, exposes window.RSPdf. Fonts/logo are fetched from the site. */
const kit = require('./kit');
const api = require('./index');

const cache = {};
const load = (url) =>
  cache[url] || (cache[url] = fetch(url).then((r) => {
    if (!r.ok) throw new Error('Could not load ' + url);
    return r.arrayBuffer();
  }).then((b) => new Uint8Array(b)));

kit.setAssets({
  font: (file) => load('fonts/' + file),
  logo: () => load('img/logo.png'),
});

window.RSPdf = api;
