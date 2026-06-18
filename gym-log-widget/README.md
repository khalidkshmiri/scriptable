# Gym Log Widget

A Scriptable widget over `gym-log.json` (written by the Post-Gym script).

## Shows
- Today's status (done / not yet), current day streak, last session muscle groups.
- **Run directly** — the same quick-log UI as the post-gym script (muscle picker + duration).

## Setup
1. Paste `gym-log-widget-script.js` into a Scriptable script named **Gym Log**.
2. Add it as a Small or Medium widget. Tapping it opens the quick-log UI.

Data: `gym-log.json` — `[{ "date": "YYYY-MM-DD", "durationMin": 60, "muscles": ["Chest"], "ts": "..." }]`.
