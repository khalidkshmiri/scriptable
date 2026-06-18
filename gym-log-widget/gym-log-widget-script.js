// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: dumbbell;
// ─────────────────────────────────────────
//  GYM LOG WIDGET — small/medium widget over gym-log.json
//  Shows: today's status, current streak, last session muscle groups.
//  Run directly: quick-log UI (same as the post-gym script).
// ─────────────────────────────────────────

const LOG_FILE = "gym-log.json"
const MUSCLES  = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Forearms", "Core", "Cardio"]
const C = {
  bg:      new Color("#10140f"),
  bg2:     new Color("#161c12"),
  accent:  new Color("#4ade80"),
  primary: new Color("#e7f0e3"),
  sub:     new Color("#7e8c78"),
}

// ─── DATA ─────────────────────────────────────────────
function docPath(name) {
  const fm = FileManager.iCloud()
  return fm.joinPath(fm.documentsDirectory(), name)
}
async function loadJson(name, fallback) {
  try {
    const fm = FileManager.iCloud()
    const p  = docPath(name)
    if (!fm.fileExists(p)) return fallback
    await fm.downloadFileFromiCloud(p)
    return JSON.parse(fm.readString(p))
  } catch { return fallback }
}
function saveJson(name, data) {
  FileManager.iCloud().writeString(docPath(name), JSON.stringify(data, null, 2))
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── DERIVE ───────────────────────────────────────────
function dayKeys(entries) {
  return new Set(entries.map(e => String(e.date || "").slice(0, 10)).filter(Boolean))
}
function streak(entries) {
  const keys = dayKeys(entries)
  if (!keys.size) return 0
  const cursor = new Date(); cursor.setHours(0, 0, 0, 0)
  if (!keys.has(isoDate(cursor))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (keys.has(isoDate(cursor))) { n++; cursor.setDate(cursor.getDate() - 1) }
  return n
}
function trainedToday(entries) {
  return dayKeys(entries).has(isoDate(new Date()))
}
function lastSession(entries) {
  return entries.slice().sort((a, b) => (a.ts || a.date) < (b.ts || b.date) ? 1 : -1)[0] || null
}

// ─── WIDGET ───────────────────────────────────────────
function buildWidget(entries) {
  const w = new ListWidget()
  const grad = new LinearGradient()
  grad.colors = [C.bg, C.bg2]; grad.locations = [0, 1]
  w.backgroundGradient = grad
  w.setPadding(14, 16, 14, 16)

  const today = trainedToday(entries)
  const hdr = w.addText(today ? "GYM · DONE TODAY" : "GYM · NOT YET")
  hdr.font = Font.boldSystemFont(9); hdr.textColor = today ? C.accent : C.sub

  w.addSpacer(6)
  const s = streak(entries)
  const big = w.addText(`${s}🔥`)
  big.font = Font.boldSystemFont(34); big.textColor = C.primary
  const lbl = w.addText(`day streak`)
  lbl.font = Font.systemFont(11); lbl.textColor = C.sub

  w.addSpacer()
  const last = lastSession(entries)
  if (last) {
    const m = (last.muscles && last.muscles.length) ? last.muscles.join(", ") : "session"
    const lt = w.addText(`Last: ${last.date} · ${m}`)
    lt.font = Font.systemFont(10); lt.textColor = C.sub; lt.lineLimit = 2
  } else {
    const e = w.addText("No workouts logged yet — tap to add")
    e.font = Font.systemFont(10); e.textColor = C.sub
  }

  w.url = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name())
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)
  return w
}

// ─── QUICK LOG (direct run) ───────────────────────────
async function pickMuscles(selected) {
  const table = new UITable()
  table.showSeparators = true
  function render() {
    table.removeAllRows()
    const head = new UITableRow(); head.isHeader = true
    head.addText("Trained muscle groups", "Tap to toggle, then swipe down")
    table.addRow(head)
    for (const m of MUSCLES) {
      const row = new UITableRow(); row.height = 48
      row.addText(`${selected.has(m) ? "✓" : "○"}  ${m}`)
      row.onSelect = () => { selected.has(m) ? selected.delete(m) : selected.add(m); render(); table.reload() }
      table.addRow(row)
    }
  }
  render()
  await table.present(false)
}

async function quickLog(entries) {
  const selected = new Set()
  await pickMuscles(selected)
  const a = new Alert()
  a.title = "Log workout?"
  a.message = selected.size ? [...selected].join(", ") : "No muscle groups selected."
  a.addTextField("Duration (min, optional)", "")
  a.addAction("Save"); a.addCancelAction("Cancel")
  if (await a.presentAlert() === -1) return
  const durRaw = a.textFieldValue(0)
  const durationMin = durRaw && !isNaN(parseInt(durRaw, 10)) ? parseInt(durRaw, 10) : null
  const now = new Date()
  entries.push({ date: isoDate(now), durationMin, muscles: [...selected], ts: now.toISOString() })
  saveJson(LOG_FILE, entries)
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  let entries = await loadJson(LOG_FILE, [])
  if (!Array.isArray(entries)) entries = []

  if (config.runsInWidget) {
    Script.setWidget(buildWidget(entries))
  } else {
    await quickLog(entries)
    await buildWidget(await loadJson(LOG_FILE, [])).presentMedium()
  }
  Script.complete()
}

main()
