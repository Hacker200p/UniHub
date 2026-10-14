# UniHub

![UniHub Logo](public/logo.png)

A free, community-driven academic resource platform for university students.

## Current Phase

Phase 1 establishes the JavaScript MERN foundation:

- Vite/React frontend with the current academic visual direction
- Express API in `backend/`
- Mongoose academic structure models
- JWT authentication and role authorization
- Local MongoDB and MongoDB Atlas support through `MONGO_URI`
- Idempotent academic/admin seed data
- Console password-reset links with optional SMTP configuration

## Project Structure

```text
src/                  React frontend
backend/src/config    Environment and MongoDB connection
backend/src/models    User, academic, and developer schemas
backend/src/routes    REST route definitions
backend/src/controllers Request handlers
backend/src/middleware  Auth, validation, and errors
backend/src/seed.js   Demo academic structure and admin seed
backend/test         API foundation tests
```

## Setup

1. Install frontend dependencies with `npm install`.
2. Install API dependencies with `cd backend` then `npm install`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Set `MONGO_URI` to local MongoDB or MongoDB Atlas.
5. Set a `JWT_SECRET` with at least 32 characters.
6. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before seeding.
7. Run `npm run seed` from `backend/`.

## Run

Terminal 1:

```powershell
cd backend
npm run dev
```

Terminal 2:

```powershell
npm run dev
```

The API runs at `http://localhost:4000`; the frontend runs at `http://localhost:5173`.

## Authentication & Security Architecture

### 1. Token Family Rotation & Reuse Detection
- **HttpOnly Cookies**: Refresh tokens are stored exclusively in HttpOnly, SameSite cookies.
- **Cryptographic Hashes**: Raw refresh tokens are never persisted in the database; only SHA-256 hashes are stored.
- **Family Reuse Detection**: Refresh tokens belong to an issuance family chain (`familyId`). If an already-rotated or revoked token is reused (e.g. by an adversary who intercepted an old token), the entire family is revoked, forcing immediate re-authentication.
- **Race Condition Prevention**: Concurrency locks via atomic MongoDB query updates ensure near-simultaneous refresh requests do not generate duplicate valid replacements.

### 2. Social Login (Google, GitHub, Microsoft)
- **Zero Client Secrets on Frontend**: All OAuth exchanges occur server-side using authorization codes and PKCE state tokens.
- **Role Isolation**: All social registrations strictly default to `role = 'STUDENT'`. Admin and Moderator roles can never be created via OAuth payloads.
- **Safe Account Merging**: Prevents account hijacking by not silently merging accounts solely based on unverified email claims. Existing email accounts require manual linking via **Settings > Security**.
- **Lockout Prevention**: Users cannot unlink their sole remaining authentication provider without first setting a secure password.

### 3. University Domain Policy
- Configurable `AUTH_REQUIRE_UNIVERSITY_EMAIL=true|false` and `ALLOWED_EMAIL_DOMAINS=silicon.ac.in,university.edu` to restrict registration to verified institutional domains and subdomains.

### 4. Session & Privacy Management
- **Active Sessions (`/settings/sessions`)**: View all connected devices, browsers, and IP addresses with granular revocation controls ("Revoke Session" and "Logout All Other Devices").
- **Privacy Preferences (`/settings/privacy`)**: Granular controls for avatar visibility, bio, social links, and public contributor profile visibility.

---

## Complete API Reference

### Authentication & Sessions
- `GET /api/auth/providers` — List enabled social auth providers
- `GET /api/auth/:provider` — Initiate OAuth authorization URL with PKCE state
- `GET /api/auth/:provider/callback` — Server callback and identity resolution
- `POST /api/auth/oauth/exchange` — Exchange single-use handoff token for access token
- `POST /api/auth/register` — Email/password registration
- `POST /api/auth/login` — Email/password login with refresh cookie
- `POST /api/auth/refresh` — Rotate refresh token within active family
- `POST /api/auth/logout` — Revoke active refresh session and clear cookie
- `POST /api/auth/logout-all` — Revoke all sessions across all devices
- `GET /api/auth/me` — Current user context
- `POST /api/auth/forgot-password` & `POST /api/auth/reset-password`

### User Profile, Security & Privacy
- `GET /api/user/security` — Connected OAuth providers and password status
- `POST /api/user/unlink-provider` — Safely unlink OAuth provider
- `POST /api/user/set-password` — Set password for OAuth users or update existing password
- `GET /api/user/sessions` — List active sessions with device/IP metadata
- `DELETE /api/user/sessions/:sessionId` — Revoke specific session
- `DELETE /api/user/sessions-other` — Revoke all other sessions except current
- `PATCH /api/user/privacy` — Update profile privacy flags
- `GET /api/user/dashboard` & `GET /api/user/bookmarks` & `GET /api/user/notifications`

### Academic Structure & Resources
- `GET /api/programs`, `GET /api/branches`, `GET /api/semesters`, `GET /api/subjects`
- `GET /api/resources` (public search & filter)
- `GET /api/resources/:id` & `POST /api/resources/:id/download`
- `POST /api/resources/upload` (multipart PDF upload with Magic Byte signature check)

### Admin & Moderation
- `GET /api/admin/overview`, `GET /api/admin/queue`, `GET /api/admin/resources/pending`
- `PATCH /api/admin/resources/:id/approve` & `PATCH /api/admin/resources/:id/reject`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, `PATCH /api/admin/users/:id/status`
- `POST /api/admin/academic/programs`, `POST /api/admin/academic/branches`, `POST /api/admin/academic/subjects`
- `GET /api/admin/audit-logs`, `GET /api/admin/analytics`

---

## Testing

```powershell
# Run backend tests (Vitest)
npm --prefix backend test

# Run frontend unit tests (Vitest)
npm test

# Run end-to-end Playwright tests (Desktop & Mobile)
npm run test:e2e
```

## Deployment

Use MongoDB Atlas and one or more private storage providers for production. Local disk remains the default for development. To enable S3-compatible storage (including Cloudflare R2 or Backblaze B2), add `s3` to `STORAGE_ENABLED_PROVIDERS`, set `STORAGE_DEFAULT_PROVIDER=s3`, and provide the bucket, endpoint, region, and credential placeholders from `backend/.env.example`. Existing `STORAGE_PROVIDER=s3` configurations remain supported.

### Storage providers

Each upload is assigned to one provider and stores its provider-specific identifier in the resource metadata. Files are streamed through the backend, so private S3 and Google Drive objects do not need public URLs.

- **Local disk:** keep `STORAGE_ENABLED_PROVIDERS=local`; files are stored under `backend/storage`.
- **S3-compatible:** set `STORAGE_ENABLED_PROVIDERS=local,s3` (or `s3`), `STORAGE_DEFAULT_PROVIDER=s3`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, and `STORAGE_SECRET_KEY`. Use an endpoint such as the R2 or B2 S3 endpoint when required.
- **Google Drive:** create a Google Cloud OAuth client with the Drive API enabled, generate an owner refresh token with Drive scope, then set `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN`. Add `google-drive` to `STORAGE_ENABLED_PROVIDERS`; optionally set `GOOGLE_DRIVE_FOLDER_ID` to a dedicated private folder. The refresh token stays in backend environment configuration and is never sent to students.

Set `STORAGE_UPLOAD_POLICY=admin-selected` only when administrators or moderators should be allowed to choose among enabled providers. Otherwise uploads use `STORAGE_DEFAULT_PROVIDER`. Do not place provider credentials in frontend configuration or commit them.

Before production:
- Rotate all database, SMTP, OAuth, and JWT secrets.
- Use a minimum 32-character random `JWT_SECRET`.
- Set `NODE_ENV=production` and `COOKIE_SECURE=true`.
- Restrict `CLIENT_URL` to your production HTTPS domain.

### Environment Variables
Ensure all environment variables in `.env.example` are configured correctly. The frontend requires `VITE_API_URL` while the backend relies on variables like `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, and the storage settings described above.

### Free-tier Deployment Considerations
- Storage: Use Cloudflare R2, AWS S3 Free Tier, or Supabase Storage for affordable or free S3-compatible object storage.
- Database: MongoDB Atlas offers an M0 free cluster which is suitable for initial usage.
- Backend Hosting: Render, Railway, or Fly.io offer free or low-cost tiers for Node.js backends. Note that instances may sleep on free tiers, causing slow cold starts.
- Frontend Hosting: Vercel, Netlify, or Cloudflare Pages are ideal for hosting the static React frontend.
