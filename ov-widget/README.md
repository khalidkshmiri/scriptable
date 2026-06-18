# OV Widget

A Scriptable widget showing the next NS/RET departures from a stop, using the free, keyless
`ovapi.nl` endpoint.

## Setup
1. Find your stop's area code: open `http://v0.ovapi.nl/stopareacode` and locate your stop
   (e.g. Rotterdam Centraal). Copy its area code.
2. Copy `Config/ov-config.example.json` → `Config/ov-config.json` and set `stopAreaCode`,
   `maxDepartures`, and optional `lineFilter` (list of line numbers).
3. Paste `ov-widget-script.js` into a Scriptable script named **OV** and add it as a widget.

Refreshes every ~2 minutes. Delays are shown as `+N` after the time.
