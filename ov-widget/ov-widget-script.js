// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: bus;
// ─────────────────────────────────────────
//  OV WIDGET — next NS/RET departures from a stop (keyless ovapi.nl)
//  Config/ov-config.json: { stopAreaCode, maxDepartures, lineFilter[] }
//  Find a stop area code: http://v0.ovapi.nl/stopareacode  (lists all areas)
// ─────────────────────────────────────────

let STOP_AREA   = ""          // e.g. "rotcs" — required
let MAX_DEP     = 3
let LINE_FILTER = []          // optional: only these LinePublicNumbers

const C = {
  bg:      new Color("#11131a"),
  bg2:     new Color("#181b26"),
  accent:  new Color("#fbbf24"),
  primary: new Color("#eef0f5"),
  sub:     new Color("#8b90a0"),
  late:    new Color("#f87171"),
}

// ─── CONFIG ───────────────────────────────────────────
async function loadConfig() {
  const fm   = FileManager.iCloud()
  const path = fm.joinPath(fm.documentsDirectory(), "Config/ov-config.json")
  if (!fm.fileExists(path)) throw new Error("Config/ov-config.json not found — copy the example and set stopAreaCode")
  await fm.downloadFileFromiCloud(path)
  const data = JSON.parse(fm.readString(path))
  if (!data.stopAreaCode) throw new Error("Set stopAreaCode in Config/ov-config.json")
  STOP_AREA = data.stopAreaCode
  if (typeof data.maxDepartures === "number") MAX_DEP = data.maxDepartures
  if (Array.isArray(data.lineFilter)) LINE_FILTER = data.lineFilter.map(String)
}

// ─── FETCH ────────────────────────────────────────────
async function fetchDepartures() {
  // ovapi historically serves http; try https first, then http fallback.
  const urls = [
    `https://v0.ovapi.nl/stopareacode/${encodeURIComponent(STOP_AREA)}`,
    `http://v0.ovapi.nl/stopareacode/${encodeURIComponent(STOP_AREA)}`,
  ]
  let json = null
  for (const u of urls) {
    try { json = await new Request(u).loadJSON(); if (json) break } catch {}
  }
  if (!json) return []

  const area = json[STOP_AREA] || json[Object.keys(json)[0]]
  if (!area || typeof area !== "object") return []

  const passes = []
  for (const tpc of Object.values(area)) {
    const p = tpc && tpc.Passes
    if (!p) continue
    for (const pass of Object.values(p)) {
      const line = String(pass.LinePublicNumber ?? "")
      if (LINE_FILTER.length && !LINE_FILTER.includes(line)) continue
      const expected = pass.ExpectedDepartureTime || pass.TargetDepartureTime
      const target   = pass.TargetDepartureTime
      if (!expected) continue
      passes.push({
        line,
        dest:     pass.DestinationName50 || pass.DestinationName || "",
        type:     pass.TransportType || "",
        expected: new Date(expected.replace(" ", "T")),
        target:   target ? new Date(target.replace(" ", "T")) : null,
      })
    }
  }
  const now = new Date()
  return passes
    .filter(p => !isNaN(p.expected.getTime()) && p.expected >= new Date(now.getTime() - 60000))
    .sort((a, b) => a.expected - b.expected)
    .slice(0, MAX_DEP)
}

// ─── HELPERS ──────────────────────────────────────────
function fmtTime(d) {
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0")
}
function delayMin(p) {
  if (!p.target) return 0
  return Math.round((p.expected - p.target) / 60000)
}
function capStr(s, n) { return s && s.length > n ? s.slice(0, n - 1) + "…" : (s || "") }

// ─── WIDGET ───────────────────────────────────────────
function buildWidget(departures, error) {
  const w = new ListWidget()
  const grad = new LinearGradient()
  grad.colors = [C.bg, C.bg2]; grad.locations = [0, 1]
  w.backgroundGradient = grad
  w.setPadding(12, 14, 12, 14)

  const hdr = w.addText("DEPARTURES")
  hdr.font = Font.boldSystemFont(9); hdr.textColor = C.accent
  w.addSpacer(6)

  if (error || !departures.length) {
    const t = w.addText(error ? "No data" : "No upcoming departures")
    t.font = Font.systemFont(12); t.textColor = C.sub
    w.refreshAfterDate = new Date(Date.now() + 2 * 60 * 1000)
    return w
  }

  for (const p of departures) {
    const row = w.addStack()
    row.layoutHorizontally(); row.centerAlignContent()

    const line = row.addText(p.line)
    line.font = Font.boldSystemFont(13); line.textColor = C.accent
    line.lineLimit = 1
    row.addSpacer(8)

    const dest = row.addText(capStr(p.dest, 18))
    dest.font = Font.systemFont(12); dest.textColor = C.primary
    dest.lineLimit = 1
    row.addSpacer()

    const d = delayMin(p)
    const time = row.addText(fmtTime(p.expected) + (d > 0 ? ` +${d}` : ""))
    time.font = Font.mediumSystemFont(12); time.textColor = d > 0 ? C.late : C.sub
    w.addSpacer(4)
  }

  // Refresh every 2 min (ovapi is near-real-time)
  w.refreshAfterDate = new Date(Date.now() + 2 * 60 * 1000)
  return w
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  let departures = [], error = false
  try {
    await loadConfig()
    departures = await fetchDepartures()
  } catch { error = true }

  const widget = buildWidget(departures, error)
  if (config.runsInWidget) Script.setWidget(widget)
  else await widget.presentMedium()
  Script.complete()
}

main()
