# Pre-School Briefing

A Scriptable script that sends a compact plain-text Telegram message: first lesson (time + room),
deadlines due today, and the commute weather.

## Setup
1. Requires `Config/morning-summary-config.json` (reuses its Telegram creds). Optionally add
   `Config/pre-school-config.json` to set `roosterName` / `remindersName`.
2. Paste `pre-school-briefing-script.js` into a Scriptable script named **Pre-School Briefing**.
3. In Shortcuts, create a Focus automation: when **School** Focus turns on → Run Script.

Lessons are read from the iOS `Rooster` calendar; deadlines from Reminders due today.
