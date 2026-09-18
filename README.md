# Righteous and Son Inc — Driver Application

A mobile-first web form where a driver applicant fills in the **Job Application and History** and signs the
**Background Check** and **PSP** consent forms. At the end they tap **Download PDF**: the site builds a clean PDF,
downloads it, and shows a "Your PDF is ready" screen. The applicant then emails the PDF as an attachment to:

- righteousandson.inc@gmail.com
- jscott.righteousandson@gmail.com

The ready screen has: **Download PDF**, **Preview PDF** (opens the browser's PDF viewer, which has its own Save/Share
options), **Open email app** (a pre-addressed email — the applicant just attaches the file), **Copy email addresses**,
and **Download as 3 separate files**. **No email account, password or server setup is needed** — the website never sends email itself.

## What the applicant sends

By default one combined PDF (Application + Background Check + PSP). The "3 separate files" link gives the three
documents individually, matching your originals:

| File | Matches original |
|---|---|
| `Driver Application - <Name>.pdf` | Job Application and History.pdf |
| `Background Check Consent - <Name>.pdf` | BACKGROUND CHECK CONSENT FORM.pdf |
| `PSP Consent - <Name>.pdf` | PSP CONSENT FORM.pdf |

Note: the FMCSA notice printed on the PSP form says its language "must exist as one stand-alone document." If your
PSP account requires that, have applicants send the 3 separate files.

## Deploy (Vercel)
```bash
npm i -g vercel
cd righteous-and-son-application
vercel --prod
```
Or import this GitHub repo in the Vercel dashboard. No environment variables are required.

## Run it locally
```bash
npm install
npm start          # http://localhost:3000
npm run sample     # writes sample PDFs to ./out/sample to check the layout
```

## How it is built
- `public/` — the static site (no build step). `js/schema.js` defines every question once; the form, validation and PDF all read it, so they cannot drift apart. `js/consents.js` holds the consent wording (from the original PDFs).
- `api/pdf.js` — the one serverless endpoint (`lib/handler.js`): validates the answers and returns the PDFs. Nothing is stored.
- `lib/pdf/` — PDF layout (pdf-lib). Fonts in `fonts/` (Arimo/Tinos ≈ Arial/Times, incl. Cyrillic + Uzbek `ʻ`).
- Signatures are stored as vector strokes and exported cropped, so PDFs never contain stretched images.

## Good to know
- **Privacy:** the PDFs contain the applicant's SSN. The server keeps nothing. Progress is auto-saved in the applicant's own browser for 7 days (the SSN is never saved) and erased after downloading.
- **Changing wording:** edit `public/js/consents.js` (consent text) or `public/js/schema.js` (questions). The PSP text is FMCSA-mandated — do not reword it.
