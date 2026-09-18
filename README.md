# Righteous and Son Inc — Driver Application

A mobile-first web form where a driver applicant fills in the **Job Application and History** first, then reads and signs
the **Background Check** and **PSP** consent forms, then reviews and signs. At the end they tap **Create my PDF**.

**The PDF is built inside the applicant's own browser — there is no server, no email account and nothing to configure.**
The applicant then shares it:

- **Share PDF** — opens the phone's share menu (Gmail, Mail, WhatsApp, …); on browsers without one it becomes **Download PDF**.
- **Preview PDF** — opens the browser's PDF viewer (which has its own Save/Share options).
- **Open email app** — a pre-addressed email; the applicant just attaches the file.
- **Copy email addresses**, **Download as 3 separate files**, **Edit my answers**.

They send it to:

- righteousandson.inc@gmail.com
- jscott.righteousandson@gmail.com

Nothing is sent automatically, and nothing leaves the applicant's device unless they share it.

## What the applicant sends

By default the Share button attaches the three documents (the PSP form stays a **stand-alone PDF** because the FMCSA notice
on it says its language "must exist as one stand-alone document"). **Download PDF** saves one combined file (Application +
Background Check + PSP) that is easy to attach; the "3 separate files" link saves them individually.

| File | Matches original |
|---|---|
| `Driver Application - <Name>.pdf` | Job Application and History.pdf |
| `Background Check Consent - <Name>.pdf` | BACKGROUND CHECK CONSENT FORM.pdf |
| `PSP Consent - <Name>.pdf` | PSP CONSENT FORM.pdf |

PDFs are US Letter with real text (not screenshots). Signatures are kept as vector strokes and cropped, so they never appear stretched.

## Deploy (Vercel)
Import this GitHub repo in the Vercel dashboard (or run `npx vercel --prod`). No environment variables are needed.
Vercel runs `npm run build`, which bundles the PDF code into `public/js/pdf.bundle.js` (the bundle is also committed, so any
static host works: just serve the `public/` folder).

## Run it locally
```bash
npm install
npm start          # http://localhost:3000
npm run build      # rebuild public/js/pdf.bundle.js after changing anything in lib/pdf/
npm run sample     # writes sample PDFs to ./out/sample to check the layout
```

## How it is built
- `public/` — the static site. `js/schema.js` defines every question once; the form, validation and PDF all read it, so they cannot drift apart. `js/consents.js` holds the consent wording (from the original PDFs).
- `lib/pdf/` — PDF layout (pdf-lib). `browser.js` is the browser entry (bundled by esbuild); `node.js` is used by `scripts/sample.js`. Fonts are in `public/fonts/` (Arimo/Tinos ≈ Arial/Times, incl. Cyrillic + Uzbek `ʻ`).

## Good to know
- **Privacy:** the PDFs contain the applicant's SSN. Nothing is stored or sent by the site. Progress is auto-saved in the applicant's own browser for 7 days (the SSN is never saved) and erased after sharing/downloading.
- **iPhones** only open the share menu from a tap, which is why Share is its own button on the "PDF is ready" screen.
- **Changing wording:** edit `public/js/consents.js` (consent text) or `public/js/schema.js` (questions), then `npm run build`. The PSP text is FMCSA-mandated — do not reword it.
- **Automatic email** (Gmail/Brevo) was removed to keep the site simple and dependable. It is in the git history (commit `4f5dbfd`) if you ever want it back.
