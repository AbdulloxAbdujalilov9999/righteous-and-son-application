# Righteous and Son Inc — Driver Application

A mobile-first web form where a driver applicant fills in the **Job Application and History**, and signs the
**Background Check** and **PSP** consent forms. When they press **Submit application**, the site builds
clean PDFs and **emails them to the company automatically**:

- righteousandson.inc@gmail.com
- jscott.righteousandson@gmail.com

The applicant also gets a **Download my copy (PDF)** button on the confirmation screen.

## What the company receives

One email per applicant, with three PDF attachments (US Letter, real text — not screenshots):

| Attachment | Matches original |
|---|---|
| `Driver Application - <Name>.pdf` | Job Application and History.pdf |
| `Background Check Consent - <Name>.pdf` | BACKGROUND CHECK CONSENT FORM.pdf |
| `PSP Consent - <Name>.pdf` | PSP CONSENT FORM.pdf |

The PSP form is kept as its **own stand-alone PDF** on purpose: the FMCSA notice printed on that form says its
language "must exist as one stand-alone document" and may not be combined with other consent forms.
The email's Reply-To is the applicant, so you can answer them directly.

## Go live (one-time setup)

### 1. Create a Gmail "App Password" for the sending account
The site sends mail through Gmail. Use **righteousandson.inc@gmail.com** as the sender.

1. Sign in to that Google account → <https://myaccount.google.com/security> → turn on **2-Step Verification**.
2. Open <https://myaccount.google.com/apppasswords>, create an app password named e.g. `Application site`.
3. Copy the 16-letter password. (It is **not** the normal Gmail password. Never share it or put it in the code.)

### 2. Deploy to Vercel
```bash
npm i -g vercel
cd righteous-and-son-application
vercel            # first deploy; follow the prompts
```
Then in the Vercel dashboard → your project → **Settings → Environment Variables**, add (for *Production*):

| Name | Value |
|---|---|
| `SMTP_USER` | `righteousandson.inc@gmail.com` |
| `SMTP_PASS` | the 16-letter app password |

Redeploy (`vercel --prod`). Optional: `MAIL_TO` overrides the two recipient addresses (comma-separated).

### 3. Test it
Open the live site, fill in a test application, submit, and confirm both inboxes receive the email with three PDFs.
If email is not configured, the site refuses to submit (it never pretends it worked) and offers the applicant a PDF to email manually.

## Run it locally
```bash
npm install
npm run dev        # http://localhost:3000 — "dry run": PDFs are saved to ./out/submissions, nothing is emailed
npm run sample     # writes sample PDFs to ./out/sample to check the layout
node scripts/test-mail.js   # builds the real email offline and prints headers/attachments
```
To send real email locally, copy `.env.example` to `.env`, fill in `SMTP_PASS`, and run `npm start`.

## How it is built
- `public/` — the static site (no build step). `js/schema.js` defines every question once; the form, validation and the PDF all read it, so they cannot drift apart. `js/consents.js` holds the consent wording (from the original PDFs).
- `api/submit.js` — the one serverless endpoint (`lib/handler.js`): validates, builds the PDFs, emails them.
- `lib/pdf/` — PDF layout (pdf-lib). Fonts in `fonts/` (Arimo/Tinos ≈ Arial/Times, incl. Cyrillic + Uzbek `ʻ`).
- Signatures are stored as vector strokes and exported cropped, so PDFs never contain stretched images.

## Good to know
- **Privacy:** the PDFs contain the applicant's SSN and are emailed to two Gmail inboxes. Nothing is stored on the server.
  Progress is auto-saved in the applicant's own browser for 7 days (the SSN is never saved) and erased after a successful submit.
- **Changing wording:** edit `public/js/consents.js` (consent text) or `public/js/schema.js` (questions). The PSP text is FMCSA-mandated — do not reword it.
- **Spam protection:** a hidden honeypot field plus a per-IP rate limit. Mail can only ever go to the company addresses.
