# Shortcuts

Shortcut links, groups, pinned links, the notepad, and sticky notes are stored in MongoDB. The app currently uses a solid black background.

The shared workspace lives in the `workspaces` collection. Each notepad file is stored as its own document in the `notes` collection.

## Run locally

1. Start a local MongoDB server, or create a MongoDB Atlas database.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string. The defaults connect to a local MongoDB server.
3. Install dependencies with `npm install`.
4. Run `npm run dev` and open the Vite URL shown in the terminal.

The first launch imports existing shortcut groups and pinned links from this browser's local storage into MongoDB. Existing notes remain in the `notes` collection. After that, MongoDB is the source of truth.

For production, run `npm run build` and then `npm start` with the MongoDB environment variables configured. The server serves the built app and its API on the configured `PORT` (3001 by default).

This app stores one private workspace and requires sign-in (see below).

## Sign-in

Every API route requires a login, and the server checks the password (the browser never sees it).

- Default account: `demo@gmail.com` / `demo@123`
- Change it with `AUTH_EMAIL` and `AUTH_PASSWORD` in `.env`, and in your host's environment variables when you deploy.
- Optional: set `AUTH_SECRET` to a long random string to sign the login cookie.
- Sessions last 7 days. After 8 wrong attempts from one address, sign-in is paused for 15 minutes.
