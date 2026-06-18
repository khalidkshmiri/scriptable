# Next Event Widget

A Scriptable lock-screen widget showing your next upcoming calendar event.

## Families
- **accessoryInline** — `14:30 — Dentist` (or `Vrij vandaag` when nothing is left today)
- **accessoryRectangular** — time, title, and location

## Setup
1. Copy `Config/next-event-config.example.json` → `Config/next-event-config.json` in your Scriptable
   iCloud `Config/` folder and set the `calendars` list (iOS calendar names) and `horizonDays`.
2. Paste `next-event-widget-script.js` into a new Scriptable script named **Next Event**.
3. Add it to the lock screen and pick this script.

Refreshes every 15 minutes (or exactly when the next event starts, if sooner).
