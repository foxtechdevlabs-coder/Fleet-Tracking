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

The login form does not simulate authentication. It displays an unavailable-service
message until an `onLogin` handler is connected; that handler should resolve only
after the real authentication request succeeds.
