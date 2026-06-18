# Study Tracker

A Scriptable widget + Pomodoro logger. Writes `study-log.json` (shared with the Weekly Review card).

## Modes
- **Widget** — this week's minutes per subject; subjects below their weekly target are highlighted.
- **Run directly** — pick a subject, then either log a finished session or start a Pomodoro.

## Pomodoro note
Scriptable can't run a live 25-minute foreground timer, so "Start timer" schedules a local
notification; tapping it reopens the script and logs the session automatically. "Log now" records
a session immediately with a chosen duration.

## Setup
1. Copy `Config/study-config.example.json` → `Config/study-config.json` and set your subjects +
   weekly hour targets.
2. Paste `study-tracker-script.js` into a Scriptable script named **Study Tracker**.

Data: `study-log.json` — `[{ "date": "YYYY-MM-DD", "subject": "Wiskunde", "durationMin": 25, "ts": "..." }]`.
