# Countdown Widget

A Scriptable lock-screen widget that counts down to named dates (toetsenweek, exams, milestones).

## Families
- **accessoryInline** — `Toetsenweek — 19d`
- **accessoryRectangular** — name, days remaining, and the date

The nearest upcoming target is shown automatically.

## Setup
1. Copy `Config/countdown-config.example.json` → `Config/countdown-config.json` in your Scriptable
   iCloud `Config/` folder and edit the `targets` list (`{ "name": "...", "date": "YYYY-MM-DD" }`).
2. Paste `countdown-widget-script.js` into a new Scriptable script named **Countdown**.
3. Add it to the lock screen as an inline or rectangular widget and pick this script.

Past dates are skipped. With no config file, built-in defaults are used.
