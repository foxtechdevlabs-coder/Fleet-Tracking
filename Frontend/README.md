# Vehicle Tracking Frontend

FleetTrack frontend built with React and Vite.

## Development

```sh
npm install
npm run dev
```

## Entry points

- `src/main.jsx` — mounts the React application.
- `src/App.jsx` — application routes and page layout.
- `src/Components/Login/Login.jsx` — login form and client-side required-field validation.

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
(`id`, `email`, `name`, and `role`). It keeps only those supported fields in
`sessionStorage` until logout, tab close, or token expiry. The development
server proxies `/api` to `http://localhost:3000`. For a deployed frontend, set
`VITE_API_BASE_URL` to the API origin (for example, `https://api.example.com`).

All application routes are protected. Logout clears the local session and
requests server-side token revocation. Pages without a connected data endpoint
show an empty state instead of sample fleet or telemetry records. The frontend
does not provide a local or fake-auth fallback; login requires the documented
API to be available.
