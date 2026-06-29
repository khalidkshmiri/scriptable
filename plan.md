# Plan — resolve all open issues (solvable-now first)

## Goal
Work through all 15 open GitHub issues in the Scriptable repo, solving everything that
needs no external credentials. Defer/stub only sub-items that require API keys/endpoints
I don't have. Commit per logical unit.

## Decisions + why
- **Scope:** "Solvable-now first" (Khalid's choice). Build everything self-contained;
  defer credential-blocked sub-items with clear notes.
- **Credentials available:** only OpenWeatherMap AQI key — but I'll implement AQI via
  **Open-Meteo's keyless air-quality API** instead (no key, matches existing weather fetch).
- **Research issues #7 and #20:** leave untouched (Khalid does these manually).
- **Verification limit:** no on-device Scriptable testing possible. "Done" = code written,
  syntax-valid (`node --check --input-type=module < file`), logic-reviewed, deployed via
  `/deploy-scriptable`. On-device behaviour stated as unverified.
- **OV widget (#15):** build against keyless `v0.ovapi.nl` (no NS key needed).

## Steps
### Quick wins / existing-script fixes
- [done] #3  morning-summary: heavy-day count collapses Rooster lessons into 1 day
- [done] #21 repo hygiene: root CLAUDE.md, morning-summary/CLAUDE.md, top-level overview, Config layout, CHANGELOG.md
- [done] #2  configurable calendars (morning-summary + school-widget) + README docs

### morning-summary enhancements
- [done] #11 first lesson, weekday theming, countdown to key dates, smart workout suggestion
- [done] #12 quote of the day + gym streak (read wired); NS disruption = SKIPPED (no key)
- [done] #10 AQI via Open-Meteo (keyless); gym capacity + barber bookings = DEFERRED (no creds)

### school-widget
- [done] #6  tussenuren — already implemented (verified); no code change needed
- [done] #8  expand Due section to fill empty space
- [done] #1  2-column iPad layout (left timetable / right Due)
- [done] #9  design pass — contrast + typography + spacing (Khalid: all three)

### #13 lock screen widgets
- [done] current lesson accessoryRectangular (school-lockscreen)
- [done] next lesson countdown accessoryCircular (added to school-lockscreen)
- [done] countdown-widget + Config/countdown-config.json
- [done] next-event-widget + Config/next-event-config.json

## Shared log formats (data contract)
- gym-log.json:    [{ date:"YYYY-MM-DD", durationMin:Number|null, muscles:[String], ts:ISO }]
- barber-log.json: [{ date:"YYYY-MM-DD", amount:Number, note:String, ts:ISO }]
- study-log.json:  [{ date:"YYYY-MM-DD", subject:String, durationMin:Number, ts:ISO }]

### #14 automations
- [done] evening-summary, pre-school-briefing, post-gym (writes gym-log.json), weekly-review

### #15 standalone widgets
- [done] barber-tracker, gym-log-widget, study-tracker, ov-widget (keyless ovapi)

## Status: COMPLETE (within agreed scope)
- All 13 buildable issues done, syntax-checked, committed on `resolve-open-issues` (11 commits),
  deployed to Scriptable iCloud, resolution comments posted on GitHub (left open for review).
- Explicitly DEFERRED (need external creds, per Khalid's answer): #10 gym capacity + barber
  bookings, #12 NS disruption alert.
- Left untouched per Khalid: #7, #20 (research/idea-generation, he does these manually).
- NOT verified on-device (no Scriptable test possible here) — esp. #1 iPad column widths,
  the new image-card layouts (evening/weekly), and Pomodoro notification reopen flow.

## Open questions
- #9 design pass: what specifically feels off? (spacing/typography/colour/density) — ask before heavy redesign.

## Files
- morning-summary/morning-summary-script.js
- school-widget/school-widget-script.js
- school-lockscreen/school-lockscreen-script.js
- Config/*.json, CHANGELOG.md, CLAUDE.md (root + per-module)
