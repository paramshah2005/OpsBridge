# OpsBridge — M1

M1 provides GitHub OAuth login and a live repository picker. Selecting a repository currently lands on a small M1 completion screen; the per-repository chatroom is intentionally reserved for M2.

## Local setup

1. Create a GitHub OAuth App at **Settings → Developer settings → OAuth Apps**.
2. Set its callback URL to `http://localhost:3000/api/auth/github/callback`.
3. Copy `.env.example` to `.env.local` and fill in the client ID, client secret, and a long session secret.
4. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and choose **Sign in with GitHub**.

## Vercel deployment

Import this repository into Vercel. Add the same environment variables with `NEXT_PUBLIC_APP_URL` set to the deployed HTTPS URL. Update the GitHub OAuth App callback URL to `https://your-domain.vercel.app/api/auth/github/callback`. Every push to the connected GitHub repository will then trigger a Vercel deployment.

The current OAuth scope is `read:user repo` so the picker can show repositories owned by the signed-in user, including private repositories. The GitHub token is stored only in an encrypted, HttpOnly cookie and is never exposed to browser JavaScript.

## Neon setup for M2

Create a Neon project, copy its pooled connection string into `DATABASE_URL`, then run the SQL in `db/schema.sql` from Neon’s SQL Editor. The chat API will then persist messages per GitHub repository.
