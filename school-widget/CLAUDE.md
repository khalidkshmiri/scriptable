# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Scriptable widget (`school-widget-script.js`) that runs on iOS. It shows the school schedule (from a Magister iCal feed) and upcoming deadlines/reminders on the home screen. There is no build step, no package manager, no test runner — the script is copied directly into the Scriptable app on iPhone.

## How to deploy

Copy the contents of `school-widget-script.js` into a new script in the Scriptable iOS app. The script name in Scriptable should be `School Widget`. The widget should be placed as a Large widget. No other setup is needed — the iCloud cache folder is created automatically on first run.

## Architecture

The script is structured in five sections (marked by comment banners):

1. **Config** — `ICAL_URL`, `CAL_NAME`, `SETTINGS`, slot budget constants, and the `C` color palette at the top of the file. Tune these without touching logic.
2. **Cache** — Reads/writes `iCloud Drive/Scriptable/Cache/school_ical.json`. Falls back to cache silently on network failure.
3. **Fetch + parse** — `fetchIcal` fetches the Magister iCal feed and calls `parseIcal`. `fetchDeadlines` and `fetchReminders` use the Scriptable `Calendar`/`Reminder` APIs, looking for a calendar and reminder list both named exactly `"School"`.
4. **Helpers** — Pure utility functions: date formatting, slot counting, break detection, deadline urgency coloring.
5. **Render functions** — `renderLessonCard`, `renderBreakCard`, `renderLessonList`, `renderDeadlines`. Each adds UI elements to the widget stack and returns the number of slots consumed.
6. **buildWidget** — Orchestrates all of the above. Four mutually exclusive schedule states: currently in a lesson, in a break, before first lesson, or today done/free. After the schedule section, remaining slot budget determines how many deadlines to show.

## Key constraints

- **No `lineLimit`** — event and deadline names are never truncated.
- **Slot budget** — `WIDGET_SLOTS` (20), `DEADLINE_OVERHEAD` (2), `DEADLINE_SLOTS` (2) model how many rows fit in a Large widget. Every render call tracks `slotsUsed` so deadlines never overflow the widget.
- **iCal timezone** — Magister uses `TZID=Europe/Amsterdam`. The parser handles both UTC (`Z` suffix) and local time; the device is set to Amsterdam time so `new Date(y, mo, d, h, mi)` gives the correct local result.
- **iOS tap limitation** — There is no URL scheme to open a specific calendar event or reminder. The max is `calshow://` (opens Calendar to a date) and `x-apple-reminder://` (opens Reminders app). This is an Apple platform constraint.
- **Dark theme only** — Background is `#0f0f0f`. No light mode variant.

## Planned widgets (not yet built)

See `school-widget-documentation.md` for full specs. Planned scripts: Barber Widget (Medium), Personal Widget (Medium), Fitness Widget (Medium), Sleep Widget (Small), DND Widget (Small), Driving Widget (Small). Each will be a separate `.js` file — one script per focus mode, no branching in a shared script.
