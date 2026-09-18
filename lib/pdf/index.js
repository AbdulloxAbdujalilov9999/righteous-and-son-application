const { buildApplication } = require('./application');
const { buildBackgroundCheck, buildPsp } = require('./consents');
const { mergePdfs } = require('./kit');

const safeName = (s) =>
  String(s || 'Applicant')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60) || 'Applicant';

/**
 * Builds the three documents. The PSP form is FMCSA-mandated language that must exist as its own
 * stand-alone document, so each form is its own PDF (matching the three originals).
 * `signatures` = { background, psp, final } PNG buffers — the applicant signs all three forms.
 */
async function buildAll(input, signatures) {
  const name = safeName(input.values.fullName);
  const [application, background, psp] = await Promise.all([
    buildApplication({ ...input, signature: signatures.final }),
    buildBackgroundCheck({ ...input, signature: signatures.background }),
    buildPsp({ ...input, signature: signatures.psp }),
  ]);
  return [
    { filename: `Driver Application - ${name}.pdf`, bytes: application },
    { filename: `Background Check Consent - ${name}.pdf`, bytes: background },
    { filename: `PSP Consent - ${name}.pdf`, bytes: psp },
  ];
}

/** One combined PDF, used only for the applicant's own downloadable copy. */
async function buildCombined(files, fullName) {
  const name = safeName(fullName);
  const bytes = await mergePdfs(files.map((f) => f.bytes), { title: `Righteous and Son Inc - Application Packet - ${name}` });
  return { filename: `Righteous and Son - Application Packet - ${name}.pdf`, bytes };
}

module.exports = { buildAll, buildCombined, safeName };
