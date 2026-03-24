# Shared Growth Sanctuary

A private personal-growth website for exactly two users. Both users can log in, see each other's updates, and write synchronized daily progress notes in three areas:

- Body
- Mind
- Career

## Features

- Two-user-only login gate (fixed allowed users)
- Shared timeline with clear author identity
- Real-time updates via Socket.IO
- Entry creation and self-editing
- Calm, elegant pink/blue minimal interface

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Login Credentials (Fixed)

Only these two accounts can log in:

- Username: `oncet`
- Password: `20030621`

- Username: `yellody`
- Password: `20030717`

## Notes

- Data is stored locally in `data.json`.
- This setup is intentionally private and minimal, not public-facing.
- The user list is intentionally fixed in `server.js` to exactly two accounts.
- For internet deployment, add HTTPS, stronger password management, and secure production session settings.
