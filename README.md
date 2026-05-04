# Mailbox Provisioning (Plesk) Starter

This project provisions **real mailboxes** on infrastructure you control via **Plesk XML-RPC**, stores results in **MongoDB**, and exposes a **React + Tailwind** dashboard plus an **Express** API.

## Features

- Node.js + Express API
- React + Tailwind dashboard frontend
- Loop-based multi-mailbox provisioning
- Plesk XML-RPC integration (`src/services/pleskService.js`)
- MongoDB persistence for created/failed records
- Randomized mailbox username + password generation
- Structured JSON logs (`src/utils/logger.js`)
- Retry helper for transient HTTP/network failures (`src/utils/retry.js`)

## Folder Structure

```text
.
├── package.json
├── .env.example
├── README.md
├── src
│   ├── app.js
│   ├── server.js
│   ├── config
│   │   ├── db.js
│   │   └── env.js
│   ├── controllers
│   │   └── provisioningController.js
│   ├── models
│   │   └── ProvisionedAccount.js
│   ├── routes
│   │   └── provisioningRoutes.js
│   ├── services
│   │   ├── accountProvisioningService.js
│   │   └── pleskService.js
│   └── utils
│       ├── delay.js
│       ├── logger.js
│       ├── retry.js
│       └── randomUser.js
└── frontend
    ├── package.json
    ├── vite.config.js
    └── src
        ├── App.jsx
        ├── main.jsx
        └── index.css
```

## Deploy to Vercel

This repo is set up for a **single Vercel project** (no separate frontend project):

1. **Import the Git repository** in the [Vercel dashboard](https://vercel.com/new) and use the repository root as the project root (default).
2. **Install + build**: `vercel.json` runs `npm install && cd frontend && npm install`, then `npm run vercel-build`, which builds the Vite app into the root `public/` folder. Vercel serves those files from the CDN and runs the Express app from `src/app.js` for routes that are not static files (for example `POST /api/provision` and `GET /health`).
3. **Environment variables**: In the Vercel project **Settings → Environment Variables**, add every variable from [`.env.example`](./.env.example) that you use locally (`MONGODB_URI`, `DOMAIN`, `PLESK_*`, and so on). Production builds do not read a committed `.env` file.
4. **MongoDB**: Serverless functions use changing outbound IPs. With MongoDB Atlas, either allow access from anywhere for the deployment user (typical for this pattern) or use a network setup that fits your security model.
5. **Function duration**: Provisioning can take a while. `vercel.json` sets `maxDuration` to **60 seconds** for `src/app.js`. On the Hobby plan, Vercel may cap this lower; upgrade or keep `count` small if you hit timeouts.

Local production-style check: from the repo root, run `npm run vercel-build`, then `npm start` and open `http://localhost:3000` (API and static UI both on the Express port).

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp .env.example .env
```

3. Set your values in `.env` (especially `MONGODB_URI` and the `PLESK_*` + `DOMAIN` fields).

4. Run backend API:

```bash
npm run dev
```

5. Run frontend dashboard:

```bash
cd frontend
npm install
npm run dev
```

6. Open dashboard:

```text
http://localhost:5173
```

7. Trigger provisioning from UI or curl:

```bash
curl -X POST http://localhost:3000/api/provision \
  -H "Content-Type: application/json" \
  -d "{\"count\":2,\"maxRetries\":3,\"retryBaseDelayMs\":500,\"includePassword\":false}"
```

## API

### `POST /api/provision`

Body:

```json
{
  "count": 3,
  "maxRetries": 3,
  "retryBaseDelayMs": 500,
  "includePassword": false
}
```

- `count`: Number of mailboxes to create (1-20)
- `maxRetries`: Extra retries after the first attempt (0-10)
- `retryBaseDelayMs`: Base backoff delay in ms (50-30000)
- `includePassword`: If true, include generated passwords in the API response (not recommended)

## Notes

- Plesk XML-RPC auth is sent using HTTP headers per Plesk docs:
  - `HTTP_AUTH_LOGIN` / `HTTP_AUTH_PASSWD` for plain auth
  - `KEY` for secret key auth
- `mail.create` requires a **site-id**; this service resolves it via `site.get` using `DOMAIN`, unless you set `PLESK_SITE_ID`.
- If your password contains `#`, quote it in `.env` (example: `PLESK_PASSWORD="...#..."`) — `dotenv` treats `#` as a comment delimiter unless quoted. This project strips surrounding quotes from Plesk secrets in `src/config/env.js`.
- Configure either `PLESK_AUTH_METHOD=plain` + `PLESK_USERNAME`/`PLESK_PASSWORD`, or `PLESK_AUTH_METHOD=key` + `PLESK_KEY`.
- Frontend uses Vite proxy (`frontend/vite.config.js`) to call backend `/api` on port `3000`.
- Use this only for authorized server administration workflows.
