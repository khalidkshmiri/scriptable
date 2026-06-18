# Weekly Review

A Scriptable recap card sent to Telegram on Sundays: gym sessions + streak, barber cuts +
earnings, and study minutes per subject (subjects with no sessions this week are flagged).

## Setup
1. Requires `Config/morning-summary-config.json` (Telegram creds). Reads subjects from
   `Config/study-config.json` if present. Optional `Config/weekly-review-config.json` to override creds.
2. Reads `gym-log.json`, `barber-log.json`, `study-log.json` (written by Post-Gym, Barber
   Tracker, Study Tracker).
3. Paste `weekly-review-script.js` into a Scriptable script named **Weekly Review**.
4. In Shortcuts, add a time automation every Sunday ~21:00 → Run Script → Weekly Review.
