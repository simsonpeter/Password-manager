# Vercel deployment

AccessVault is a Next.js App Router application. Vercel can build it with the default settings.

## Steps

1. Push this repository to GitHub.
2. Import the project in Vercel. Framework preset: Next.js. Root directory: the repository root.
3. Add environment variables for Production and Preview:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` set to `https://YOUR_DOMAIN`

4. Do not add a service-role key.
5. Deploy.
6. In Supabase Authentication, add `https://YOUR_DOMAIN/auth/callback` and `https://YOUR_DOMAIN/reset-password` to the redirect allow list. Set the site URL to `https://YOUR_DOMAIN`.
7. Open the deployment, create an account, and confirm the verification email.

## Build command

```bash
npm run build
```

Vercel runs `next build`. Security headers, including Content-Security-Policy, are set in `next.config.ts`.

## After deployment

- Install the app from the browser where the install prompt is supported.
- Create the vault passphrase on a device you control and store the recovery key offline.
- Download an encrypted backup after the first clients are entered.

Preview deployments need their own redirect URLs if you want email links to return to the preview host. Otherwise set `NEXT_PUBLIC_APP_URL` to the production domain only.
