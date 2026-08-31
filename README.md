# 806 & CO.

Website for **806 & CO.** (Amarillo, TX) — custom spray tans, birthday signs, and creative services.

Built from the [Aubs & Ends](https://github.com/rmonty/AubsAndEnds) template: same navigation, admin, shop, cart, and Firebase backend — rebranded for 806 & CO.

## Stack

- **Frontend:** React + Vite + Tailwind (Cloudflare Pages)
- **Backend:** Firebase Auth, Firestore, Storage, Cloud Functions
- **Transactional email:** Resend (via Firebase Functions)
- **Inbox / domain email:** Cloudflare Email Routing (recommended)

## Local development

```bash
cp .env.example .env   # fill Firebase + email values
npm install --legacy-peer-deps
npm run dev
```

## Deploy (Cloudflare Pages)

1. Create a Cloudflare Pages project named `eight0sixandcompany` (or update `package.json` / workflow).
2. Point DNS for `806andcompany.com` to Cloudflare.
3. Set GitHub Actions secrets for Firebase env vars (same names as `.env.example` `VITE_*` keys).
4. Push to `main` — `.github/workflows/deploy-cloudflare.yml` builds and deploys.

Manual deploy:

```bash
npm run pages:deploy
```

## Email setup

1. **Receiving mail** — Cloudflare Email Routing: create addresses like `hello@`, `orders@`, `support@` and forward to Laney's inbox.
2. **Sending mail** — Verify `806andcompany.com` in [Resend](https://resend.com), then set `RESEND_API_KEY` / `RESEND_FROM_EMAIL` on Firebase Functions (same pattern as Aubs & Ends).

## Firebase

Create a new Firebase project (do not reuse Aubs & Ends). Update `.firebaserc` and `.env`, deploy rules/functions:

```bash
firebase deploy --only firestore:rules,storage,functions
```

## Branding assets to add

Place these in `public/` when ready:

- `laney.jpg` — founder / hero photo
- `smallicon.svg` / `smallicon.png` — favicon
- Logo overrides can also be uploaded via Admin → Settings
