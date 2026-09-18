# Righteous and Son Inc — Driver Application

A mobile-first web form where a driver applicant fills in the **Job Application and History** first, then reads and
signs the **Background Check** and **PSP** consent forms, then reviews and signs. The final button depends on whether
automatic email is set up:

- **Email set up** → the button reads **Submit application**. The site builds the PDFs and **emails them straight to**
  righteousandson.inc@gmail.com and jscott.righteousandson@gmail.com. The applicant sees "Application submitted" and can download a copy.
- **Email not set up** → the button reads **Download PDF**. The applicant downloads the PDF (or previews it) and emails it
  themselves; the ready screen has an **Open email app** button with the addresses pre-filled.

If sending fails for any reason the applicant keeps all their answers and can retry or download the PDF.

## Turn on automatic email (one-time)

Set these environment variables in Vercel (Project → Settings → Environment Variables → Production), then **redeploy**:

**Gmail** (needs 2-Step Verification and an App Password from `myaccount.google.com/apppasswords`):

| Name | Value |
|---|---|
| `SMTP_USER` | `righteousandson.inc@gmail.com` |
| `SMTP_PASS` | the 16-letter app password (not the normal password) |

**Or any other SMTP service, e.g. Brevo (no 2-Step Verification):** set `SMTP_HOST` (`smtp-relay.brevo.com`), `SMTP_PORT` (`587`),
`SMTP_USER`, `SMTP_PASS` (the service's SMTP login/key) and `MAIL_FROM` (a sender address you verified with the service).

Optional: `MAIL_TO` overrides the recipients. See `.env.example`. Locally, `DRY_RUN=1 npm start` pretends email works without sending anything.

## What is sent

Each email has a short summary and three PDF attachments (US Letter, real text — not screenshots), with the applicant as Reply-To:

| File | Matches original |
|---|---|
| `Driver Application - <Name>.pdf` | Job Application and History.pdf |
| `Background Check Consent - <Name>.pdf` | BACKGROUND CHECK CONSENT FORM.pdf |
| `PSP Consent - <Name>.pdf` | PSP CONSENT FORM.pdf |

The PSP form stays a **stand-alone PDF** on purpose: the FMCSA notice on it says its language "must exist as one
stand-alone document." In download mode the applicant gets one combined PDF by default, or the 3 separate files via a link.

## Deploy (Vercel)
```bash
npm i -g vercel
cd righteous-and-son-application
vercel --prod
```
Or import this GitHub repo in the Vercel dashboard. Environment variables are only needed for automatic email (above).

## Run it locally
```bash
npm install
npm start          # http://localhost:3000
npm run sample     # writes sample PDFs to ./out/sample to check the layout
```

## How it is built
- `public/` — the static site (no build step). `js/schema.js` defines every question once; the form, validation and PDF all read it, so they cannot drift apart. `js/consents.js` holds the consent wording (from the original PDFs).
- `api/pdf.js` — the one serverless endpoint (`lib/handler.js`): validates the answers, builds the PDFs and (if configured) emails them via `lib/mail.js`. Nothing is stored.
- `lib/pdf/` — PDF layout (pdf-lib). Fonts in `fonts/` (Arimo/Tinos ≈ Arial/Times, incl. Cyrillic + Uzbek `ʻ`).
- Signatures are stored as vector strokes and exported cropped, so PDFs never contain stretched images.

## Good to know
- **Privacy:** the PDFs contain the applicant's SSN. The server keeps nothing. Progress is auto-saved in the applicant's own browser for 7 days (the SSN is never saved) and erased after downloading.
- **Changing wording:** edit `public/js/consents.js` (consent text) or `public/js/schema.js` (questions). The PSP text is FMCSA-mandated — do not reword it.
