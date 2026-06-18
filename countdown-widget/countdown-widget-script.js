// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: hourglass-half;
// ─────────────────────────────────────────
//  COUNTDOWN WIDGET — lock-screen countdown to named dates
//  Families: accessoryInline ("Toetsenweek — 19d")
//            accessoryRectangular (name + date + days left)
//  Targets come from Config/countdown-config.json
// ─────────────────────────────────────────

// Built-in defaults — overridden by Config/countdown-config.json if present.
let TARGETS = [
  { name: "Toetsenweek",    date: "2026-06-22" },
  { name: "GPO eindexamen", date: "2026-06-29" },
]

// ─── CONFIG ───────────────────────────────────────────
async function loadConfig() {
  try {
    const fm   = FileManager.iCloud()
    const path = fm.joinPath(fm.documentsDirectory(), "Config/countdown-config.json")
    if (!fm.fileExists(path)) return
    await fm.downloadFileFromiCloud(path)
    const data = JSON.parse(fm.readString(path))
    if (Array.isArray(data.targets) && data.targets.length) TARGETS = data.targets
  } catch {}
}

// ─── HELPERS ──────────────────────────────────────────
function daysUntil(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  if (isNaN(d.getTime())) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

// Nearest upcoming target (days >= 0). null if none upcoming.
function nearestTarget() {
  let best = null
  for (const t of TARGETS) {
    if (!t || !t.date) continue
    const days = daysUntil(t.date)
    if (days == null || days < 0) continue
    if (!best || days < best.days) best = { name: t.name, date: t.date, days }
  }
  return best
}

function fmtDutchDate(isoDate) {
  const months = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"]
  const d = new Date(`${isoDate}T00:00:00`)
  return `${d.getDate()} ${months[d.getMonth()]}`
}

function daysLabel(days) {
  if (days === 0) return "vandaag"
  if (days === 1) return "morgen"
  return `${days} dagen`
}

// ─── WIDGETS ──────────────────────────────────────────
function buildInline(target) {
  const widget = new ListWidget()
  const text = target
    ? `${target.name} — ${target.days === 0 ? "vandaag" : target.days === 1 ? "1d" : target.days + "d"}`
    : "Geen countdown"
  const t = widget.addText(text)
  t.font = Font.systemFont(13)
  return widget
}

function buildRectangular(target) {
  const widget = new ListWidget()
  widget.backgroundColor = new Color("#000000", 0)

  if (!target) {
    const t = widget.addText("Geen countdown")
    t.font = Font.systemFont(13)
    t.textColor = Color.white()
    return widget
  }

  const name = widget.addText(target.name)
  name.font      = Font.boldSystemFont(15)
  name.textColor = Color.white()
  name.lineLimit = 1

  widget.addSpacer(2)

  const big = widget.addText(daysLabel(target.days))
  big.font      = Font.boldSystemFont(20)
  big.textColor = Color.white()

  widget.addSpacer(1)

  const sub = widget.addText(fmtDutchDate(target.date))
  sub.font      = Font.systemFont(11)
  sub.textColor = new Color("#FFFFFF", 0.75)
  return widget
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  await loadConfig()
  const target = nearestTarget()
  const family = config.runsInWidget ? config.widgetFamily : null

  const widget = family === "accessoryInline"
    ? buildInline(target)
    : buildRectangular(target)

  // Re-evaluate around midnight (day count changes) — cap at 6h.
  widget.refreshAfterDate = new Date(Date.now() + 6 * 60 * 60 * 1000)

  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else if (family === "accessoryInline") {
    await widget.presentAccessoryInline()
  } else {
    await buildRectangular(target).presentAccessoryRectangular()
  }
  Script.complete()
}

main()
