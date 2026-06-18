# Evening Summary

A Scriptable card (same dark/gold style as Morning Summary) sent to Telegram in the evening,
previewing **tomorrow**: weather, agenda, and reminders due within 2 days.

## Setup
1. Requires `Config/morning-summary-config.json` (reuses its Telegram token, chat ID, and
   calendars). Optionally add `Config/evening-summary-config.json` to override.
2. Paste `evening-summary-script.js` into a Scriptable script named **Evening Summary**.
3. In Shortcuts, add a time automation at ~21:30 → Run Script → Evening Summary.
