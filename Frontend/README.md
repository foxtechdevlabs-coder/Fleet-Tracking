# Vehicle Tracking Frontend

FleetTrack frontend built with React and Vite.

## Development

```sh
npm install
npm run dev
```

## Entry points

- `src/main.tsx` — mounts the React application.
- `src/App.tsx` — application routes and page layout.
- `src/Components/Login/Login.tsx` — login form and client-side required-field validation.
- `src/Components/Map/MapViewport.tsx` — Leaflet map of the latest vehicle positions (Live Tracking page).
- `src/Components/Reports/ReportResultsTable.tsx` — searchable, paginated report table with CSV, PDF, and Excel export.

## Checks

```sh
npm run typecheck   # TypeScript
npm test            # Vitest unit tests
npm run build       # type check + production build
```

## Routes

- `/login` — email and password sign-in form.
- `/device-vehicle` — device and vehicle management.
- `/live-tracking` — live tracking view.
- `/reports` — operational reports.
- `/dashboard` — fleet overview (also the default route).

## Authentication

The login form sends `POST /api/v1/auth/login` with `{ "email", "password" }`.
It accepts the documented `data.accessToken`, `data.tokenType`, and
`data.expiresIn` fields along with the documented `data.admin` identity
(`email`, `name`, and `role`). It keeps only those user fields required by the
interface (`email`, `name`, and `role`) together with the token and its
expiry in `sessionStorage` until logout, tab close, or token expiry. The
development server proxies `/api` to `http://localhost:3000`. For a deployed
frontend, set
`VITE_API_BASE_URL` to the API origin (for example, `https://api.example.com`).
When restoring a tab session, the frontend verifies the stored bearer token
with `GET /api/v1/auth/me` before rendering protected pages. Logout clears the
local session immediately and then requests server-side token revocation.

All application routes are protected. Pages without a connected data endpoint
show an empty state instead of sample fleet or telemetry records. The frontend
does not provide a local or fake-auth fallback; login requires the documented
API to be available.
