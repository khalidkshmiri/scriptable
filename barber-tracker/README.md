# Barber Tracker

A Scriptable widget + quick-log action for tracking barber earnings. Writes `barber-log.json`
(shared with the Weekly Review card).

## Modes
- **Widget (medium)** — week earnings, cuts this week, last cut.
- **Run directly** — a form to log a new cut (amount €, optional note).

## Setup
1. Paste `barber-tracker-script.js` into a Scriptable script named **Barber Tracker**.
2. Add it as a Medium widget, or run it from the app to log a cut.
3. For one-tap logging, add a Home Screen shortcut to the URL
   `scriptable:///run?scriptName=Barber%20Tracker` (Shortcuts → Open URL).

Data: `barber-log.json` — `[{ "date": "YYYY-MM-DD", "amount": 15, "note": "", "ts": "..." }]`.
