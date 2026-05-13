# DocScan App — Migration Guide

Complete reference for migrating this project from Replit to Antigravity (or any other environment).

---

## 1. Project Overview

**DocScan** is a Korean document scanning mobile/web application.

- **Purpose**: Allow users (residents of 파주시) to submit scanned family certificates and receipts for refund processing.
- **Stack**: Expo React Native (web + native) frontend + Express TypeScript backend + PostgreSQL (Drizzle ORM) + Object Storage (Google Cloud Storage).
- **Live URL**: https://docuscan.synthya.ai
- **Auth**: Kakao OAuth (with optional skip-login for testing).
- **Languages**: Korean UI, TypeScript codebase.

---

## 2. Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Expo React Native Web  │ ─────►  │  Express API (port 5000) │
│  (port 8081 dev)        │         │  + serves /admin web page│
│                         │         │  + serves dist/ in prod  │
└─────────────────────────┘         └──────────────────────────┘
                                              │
                                              ▼
                              ┌────────────────────────────┐
                              │  PostgreSQL (Drizzle ORM)  │
                              │  Google Cloud Storage      │
                              │  Kakao OAuth API           │
                              └────────────────────────────┘
```

- **Single deployable**: After `npx expo export --platform web` builds the SPA into `dist/`, the Express server serves `dist/index.html` for browser requests and Expo Go manifests for native clients.
- **Port 5000**: Express (API + admin page + production web hosting).
- **Port 8081**: Expo dev server (frontend, dev only).

---

## 3. User Flow

1. **Auth screen** (`/`) — Kakao OAuth login or "로그인 없이 시작하기" (skip).
2. **Personal info** (`/info`) — Name, phone, address (Daum Postcode, 파주시 only), bank account.
3. **Scan select** (`/scan-select`) — Choose family certificate or receipt.
4. **Camera** (`/camera`) — Full-screen camera with guide frames + auto-edge detection.
5. **Review** (`/review`) — Confirm images and personal info.
6. **Complete** (`/complete`) — Submission success.

---

## 4. Tech Stack & Dependencies

### Frontend (Expo SDK 54)
- `expo` ~54.0.27, `expo-router` ~6.0.17 (file-based routing)
- `react-native` 0.81.5, `react` 19.1.0
- `expo-camera`, `expo-image`, `expo-image-manipulator`, `expo-image-picker`
- `react-native-webview` (Kakao login + Daum Postcode modals on native)
- `@tanstack/react-query` for server state
- `expo-file-system` for native uploads
- `react-native-keyboard-controller`, `react-native-reanimated`, `react-native-safe-area-context`

### Backend
- `express` ^5.0.1
- `tsx` (dev), `esbuild` (prod bundling)
- `drizzle-orm` + `drizzle-kit` (PostgreSQL)
- `pg` (node-postgres driver)
- `@google-cloud/storage` + `google-auth-library` (object storage)
- `multer` (file upload)
- `http-proxy-middleware` (Expo dev server proxy)
- `zod` + `drizzle-zod` (validation)

### Build / Tooling
- TypeScript ~5.9.2
- Babel + `babel-plugin-react-compiler` (React Compiler enabled in app.json)
- Patch: `expo-asset+12.0.12.patch` (in `patches/`)

---

## 5. Project Structure

```
.
├── app/                          # Expo Router screens (file-based)
│   ├── _layout.tsx               # Root layout, providers, fonts
│   ├── index.tsx                 # Auth screen (Kakao login + skip button)
│   ├── auth-callback.tsx         # Kakao OAuth callback handler
│   ├── info.tsx                  # Personal info form (name/phone/address/bank)
│   ├── scan-select.tsx           # Document type selection
│   ├── camera.tsx                # Camera with guide frame + edge detection
│   ├── review.tsx                # Review + submit
│   ├── complete.tsx              # Success screen
│   ├── +native-intent.tsx        # Deep link handler
│   └── +not-found.tsx            # 404
├── components/
│   ├── KakaoLogin.tsx            # Kakao OAuth WebView (native) / redirect (web)
│   ├── DaumPostcode.tsx          # Daum 우편번호 search WebView
│   ├── ErrorBoundary.tsx         # React error boundary
│   ├── ErrorFallback.tsx         # Error UI
│   └── KeyboardAwareScrollViewCompat.tsx
├── contexts/
│   └── SubmissionContext.tsx     # Shared state for submission flow
├── client/utils/
│   └── objectStorageExpo.ts      # File/blob upload utilities (presigned URL)
├── lib/
│   └── query-client.ts           # React Query client + apiRequest helper
├── constants/
│   └── colors.ts                 # Color palette
├── server/
│   ├── index.ts                  # Express setup, dist/ serving, Expo Go routing
│   ├── routes.ts                 # All API routes (auth, submissions, admin, vlm)
│   ├── storage.ts                # DatabaseStorage (Drizzle CRUD)
│   ├── db.ts                     # PostgreSQL connection pool
│   ├── objectStorage.ts          # GCS upload/download
│   ├── objectAcl.ts              # Object ACL helpers
│   └── templates/
│       └── admin.html            # Admin web page (no auth, with delete buttons)
├── shared/
│   └── schema.ts                 # Drizzle schema (submissions, scanned_images)
├── scripts/
│   └── build.js                  # Native bundle + Expo web export
├── patches/
│   └── expo-asset+12.0.12.patch  # patch-package patch
├── assets/                       # Icons, splash, fonts
├── app.json                      # Expo config (static, do NOT use app.config.ts)
├── package.json
├── tsconfig.json                 # Path aliases: @/* and @shared/*
├── babel.config.js
├── metro.config.js
├── drizzle.config.ts
├── eslint.config.js
└── replit.md                     # Project README (Replit-specific)
```

---

## 6. Environment Variables / Secrets

Required for the app to function:

| Variable | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Provision your own (Neon, Supabase, RDS, etc.) |
| `SESSION_SECRET` | Express session secret | Generate any random 32+ char string |
| `KAKAO_REST_API_KEY` | Kakao OAuth REST API key | https://developers.kakao.com (existing key: `ae84d790fce824ce293067d9c890b04a`) |
| `KAKAO_CLIENT_SECRET` | Kakao OAuth client secret | Kakao Developer Console |
| `APP_BASE_URL` | Production base URL (overrides host detection for OAuth redirect) | e.g., `https://docuscan.synthya.ai` |
| `EXPO_PUBLIC_DOMAIN` | Domain for the API (used by frontend) | Set automatically in dev; in prod set to deployment domain |
| `PORT` | Express port (default 5000) | Set by hosting platform |
| `NODE_ENV` | `development` or `production` | Set by hosting platform |

### Object Storage (Google Cloud Storage)
The app uses Replit's GCS-backed object storage. To migrate:

| Variable | Purpose |
|---|---|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket ID |
| `PRIVATE_OBJECT_DIR` | Directory within bucket for private uploads (e.g., `bucket-id/.private`) |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Comma-separated list of public asset paths (e.g., `bucket-id/public`) |

**For Antigravity/non-Replit migration**: Provision a new GCS bucket and configure service account credentials. The `server/objectStorage.ts` module uses Replit's sidecar token endpoint (`http://127.0.0.1:1106/token`) — you must replace this with standard GCS authentication (service account JSON via `GOOGLE_APPLICATION_CREDENTIALS` env var). See **Section 11** for details.

---

## 7. Database Schema

Defined in `shared/schema.ts`. Two tables:

### `submissions`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar (uuid) | PK, default `gen_random_uuid()` |
| `name` | text | NOT NULL |
| `phone` | text | NOT NULL |
| `address` | text | NOT NULL |
| `address_detail` | text | nullable |
| `kakao_id` | text | nullable (allows skip-login) |
| `bank_name` | text | nullable |
| `bank_account` | text | nullable |
| `bank_holder` | text | nullable |
| `status` | text | NOT NULL, default `'pending'` |
| `created_at` | timestamp | NOT NULL, default now |
| `updated_at` | timestamp | NOT NULL, default now |

### `scanned_images`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar (uuid) | PK |
| `submission_id` | varchar | FK → submissions.id, NOT NULL |
| `document_type` | text | NOT NULL ('family_certificate' or 'receipt') |
| `image_url` | text | NOT NULL (path like `/objects/uploads/{uuid}`) |
| `image_order` | integer | NOT NULL, default 0 |
| `file_name` | text | nullable (e.g., `{이름}_가족관계증명서.jpg`) |
| `created_at` | timestamp | NOT NULL, default now |

### Migration command
```bash
npm run db:push
```
Uses `drizzle-kit push` to sync schema directly to DB (no migration files).

---

## 8. API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/kakao` | Redirect to Kakao OAuth |
| `GET` | `/api/auth/kakao/callback` | OAuth callback (token exchange + profile) |
| `POST` | `/api/submissions` | Create submission |
| `POST` | `/api/submissions/:id/images` | Add scanned images |
| `GET` | `/api/admin/submissions` | List all submissions |
| `GET` | `/api/admin/submissions/:id` | Get submission detail |
| `PUT` | `/api/admin/submissions/:id/status` | Update status |
| `DELETE` | `/api/admin/submissions/:id` | Delete single submission |
| `DELETE` | `/api/admin/submissions` | Delete all submissions |
| `POST` | `/api/vlm/forward/:id` | Forward submission to external VLM server |
| `POST` | `/api/objects/upload` | Get presigned upload URL |
| `GET` | `/objects/:objectPath(*)` | Serve uploaded objects (proxied from GCS) |
| `GET` | `/admin` | Admin web page (HTML) |

**⚠️ Security Note**: All `/api/admin/*` endpoints and `/admin` are **unauthenticated**. Add auth middleware before production use beyond temporary testing.

---

## 9. Build & Run

### Development
```bash
npm install              # installs deps, runs patch-package via postinstall
npm run db:push          # sync schema to DB
npm run server:dev       # start Express on :5000 (tsx)
npm run expo:dev         # start Expo dev server on :8081
```

The Expo dev script depends on `REPLIT_DEV_DOMAIN` env var to expose the dev server publicly. On Antigravity, replace this:

```bash
# package.json — replace this line:
"expo:dev": "EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN:5000 npx expo start --localhost"

# With something like (depending on your environment):
"expo:dev": "EXPO_PUBLIC_DOMAIN=localhost:5000 npx expo start --localhost"
```

### Production
```bash
npm run expo:static:build   # builds web bundle to dist/
npm run server:build        # bundles server to server_dist/index.js
npm run server:prod         # runs node server_dist/index.js
```

The server detects `dist/index.html` and serves the SPA for browser requests, Expo Go manifests for native.

---

## 10. Kakao OAuth Setup

1. Go to https://developers.kakao.com → My Application → DocScan
2. **Platform → Web platform**: Add your deployment domain (e.g., `https://your-domain.com`)
3. **Kakao Login → Redirect URI**: Add `https://your-domain.com/api/auth/kakao/callback`
4. **Consent items**: Enable nickname (`profile_nickname`) at minimum
5. Set env vars `KAKAO_REST_API_KEY` and `KAKAO_CLIENT_SECRET`
6. Set `APP_BASE_URL` to your production domain (used to override host detection in OAuth redirect URI)

**Web flow**: Redirects via `window.location.href`.
**Native flow**: WebView with `postMessage`. CSRF protected via OAuth state parameter.

---

## 11. Object Storage Migration (CRITICAL for non-Replit)

The current `server/objectStorage.ts` uses Replit's GCS sidecar (a local credential proxy at `http://127.0.0.1:1106/token`). This **will not work** outside Replit.

### To migrate to standalone GCS:

1. Create a GCS bucket in your Google Cloud project
2. Create a service account with `Storage Object Admin` role on the bucket
3. Download the service account JSON key
4. Replace the auth in `server/objectStorage.ts`:

```typescript
// Replace Replit sidecar token logic with:
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  // OR
  credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_JSON ?? '{}'),
});
```

5. Set env vars:
   - `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` (or `GCS_SERVICE_ACCOUNT_JSON` with the JSON content)
   - `DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-name`
   - `PRIVATE_OBJECT_DIR=your-bucket-name/.private`
   - `PUBLIC_OBJECT_SEARCH_PATHS=your-bucket-name/public`

### Alternative: Use a different storage provider
If migrating off GCS entirely (e.g., to S3, R2, or Supabase Storage), rewrite `server/objectStorage.ts` to use the new SDK while preserving the same public interface (`getObjectEntityUploadURL()`, `normalizeObjectEntityPath()`, `getObjectEntityFile()`, etc.) so that `server/routes.ts` and the client upload utilities don't need changes.

---

## 12. Replit-Specific Code That Needs Adjustment

### `package.json` scripts
- `expo:dev` — uses `$REPLIT_DEV_DOMAIN`. Replace with environment-appropriate value.
- `start`, `lint` — fine as-is.

### `app.json`
- `plugins.expo-router.origin = "https://replit.com/"` — change to your production origin.

### `server/objectStorage.ts`
- Sidecar token endpoint at `http://127.0.0.1:1106/token` — replace with standard GCS auth (see Section 11).

### `.replit` file
- Delete entirely. It's Replit's deployment/workflow config.

### Workflows
- The `Start Backend` and `Start Frontend` workflows are Replit-specific. Run scripts directly: `npm run server:dev` and `npm run expo:dev`.

### Deployment target
- Currently configured for Replit's `cloudrun` deployment. For Antigravity, deploy to your platform of choice (Cloud Run, Vercel, Fly.io, Railway, etc.).
- Build command: `npm run expo:static:build && npm run server:build`
- Run command: `npm run server:prod`
- Required port: `5000` (or override with `PORT` env var)

---

## 13. Patch File

`patches/expo-asset+12.0.12.patch` — applied automatically by `patch-package` (runs in `postinstall`). Keep this file; otherwise some assets may break.

---

## 14. Known Issues & Considerations

1. **Admin page has no authentication** — anyone with the URL can view/delete data. Add auth middleware before production.
2. **Object storage cleanup not implemented** — when a submission is deleted, DB records are removed but the underlying GCS objects remain. Implement blob cleanup if storage cost matters.
3. **Web blob URI handling** — camera captures on web are blob URLs. The `client/utils/objectStorageExpo.ts` has `uploadBlobUriToStorage()` to fetch the blob and PUT it to GCS. Native uses `expo-file-system`'s `File` API directly.
4. **파주시 restriction** — address validation in `app/info.tsx` only accepts addresses containing "파주시". Adjust `processAddressResult()` to lift this restriction if expanding regions.
5. **Skip-login** — added for testing. Removes Kakao auth requirement; backend accepts `kakaoId: null`. Remove the skip button (`app/index.tsx`) before production launch if Kakao auth becomes mandatory.
6. **VLM forwarding** — `/api/vlm/forward/:id` POSTs submission data to a configured external URL. The URL is provided per-request from the admin page; no validation/whitelisting.

---

## 15. Quick-Start Checklist for Antigravity

- [ ] Extract zip
- [ ] Run `npm install`
- [ ] Provision PostgreSQL, set `DATABASE_URL`
- [ ] Run `npm run db:push`
- [ ] Provision GCS bucket + service account, set storage env vars
- [ ] Update `server/objectStorage.ts` auth (Section 11)
- [ ] Set Kakao env vars + register new redirect URI in Kakao Console
- [ ] Update `package.json` `expo:dev` script for your environment
- [ ] Update `app.json` `expo-router.origin`
- [ ] Delete `.replit` file
- [ ] Test dev: `npm run server:dev` + `npm run expo:dev`
- [ ] Test prod build: `npm run expo:static:build && npm run server:build && npm run server:prod`
- [ ] Add admin authentication before launching to public
- [ ] Configure deployment platform with build/run commands above

---

## 16. Contact / Reference

- Original Replit project: https://replit.com (project at `docuscan.synthya.ai`)
- Project README: see `replit.md` in the zip
- Schema: `shared/schema.ts`
- All API routes: `server/routes.ts`
