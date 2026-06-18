// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: cut;
// ─────────────────────────────────────────
//  BARBER TRACKER — earnings widget + quick-log action
//  Widget (medium): week earnings, cuts this week, last cut.
//  Run directly: form to log a new cut → barber-log.json (iCloud).
//  Quick-log shortcut: scriptable:///run?scriptName=Barber%20Tracker
// ─────────────────────────────────────────

const LOG_FILE = "barber-log.json"
const C = {
  bg:      new Color("#1a1310"),
  bg2:     new Color("#241a14"),
  accent:  new Color("#E2B262"),
  primary: new Color("#f0e9da"),
  sub:     new Color("#9a8c78"),
}

// ─── DATA ─────────────────────────────────────────────
function logPath() {
  const fm = FileManager.iCloud()
  return fm.joinPath(fm.documentsDirectory(), LOG_FILE)
}

async function loadLog() {
  try {
    const fm = FileManager.iCloud()
    const p  = logPath()
    if (!fm.fileExists(p)) return []
    await fm.downloadFileFromiCloud(p)
    const data = JSON.parse(fm.readString(p))
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

function saveLog(entries) {
  const fm = FileManager.iCloud()
  fm.writeString(logPath(), JSON.stringify(entries, null, 2))
}

// ─── HELPERS ──────────────────────────────────────────
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Monday 00:00 of the current week.
function startOfWeek() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7  // 0 = Monday
  d.setDate(d.getDate() - dow)
  return d
}

function summarize(entries) {
  const wkStart = startOfWeek().getTime()
  const wk = entries.filter(e => new Date(`${e.date}T00:00:00`).getTime() >= wkStart)
  const total = wk.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const sorted = entries.slice().sort((a, b) => (a.ts || a.date) < (b.ts || b.date) ? 1 : -1)
  return { weekTotal: total, weekCuts: wk.length, last: sorted[0] || null }
}

function euro(n) { return "€" + (Math.round(n * 100) / 100).toString().replace(/\.00$/, "") }

// ─── WIDGET ───────────────────────────────────────────
function buildWidget(entries) {
  const { weekTotal, weekCuts, last } = summarize(entries)
  const w = new ListWidget()
  const grad = new LinearGradient()
  grad.colors = [C.bg, C.bg2]; grad.locations = [0, 1]
  w.backgroundGradient = grad
  w.setPadding(14, 16, 14, 16)

  const hdr = w.addText("BARBER · THIS WEEK")
  hdr.font = Font.boldSystemFont(9); hdr.textColor = C.accent

  w.addSpacer(6)

  const amount = w.addText(euro(weekTotal))
  amount.font = Font.boldSystemFont(34); amount.textColor = C.primary

  w.addSpacer(2)
  const cuts = w.addText(`${weekCuts} cut${weekCuts === 1 ? "" : "s"} this week`)
  cuts.font = Font.systemFont(12); cuts.textColor = C.sub

  w.addSpacer()

  if (last) {
    const lastTxt = w.addText(`Last: ${euro(Number(last.amount) || 0)} · ${last.date}${last.note ? " · " + last.note : ""}`)
    lastTxt.font = Font.systemFont(11); lastTxt.textColor = C.sub; lastTxt.lineLimit = 1
  } else {
    const empty = w.addText("No cuts logged yet — tap to add")
    empty.font = Font.systemFont(11); empty.textColor = C.sub
  }

  w.url = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name())
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)
  return w
}

// ─── ACTION (quick log) ───────────────────────────────
async function logCutFlow(entries) {
  const a = new Alert()
  a.title = "Log a cut"
  a.message = "Enter the amount earned and an optional note."
  a.addTextField("Amount (€)", "")
  a.addTextField("Note (optional)", "")
  a.addAction("Save")
  a.addCancelAction("Cancel")
  const idx = await a.presentAlert()
  if (idx === -1) return false

  const amount = parseFloat((a.textFieldValue(0) || "").replace(",", "."))
  if (isNaN(amount)) {
    const err = new Alert(); err.title = "Invalid amount"; err.addAction("OK"); await err.presentAlert()
    return false
  }
  const now = new Date()
  entries.push({ date: isoDate(now), amount, note: (a.textFieldValue(1) || "").trim(), ts: now.toISOString() })
  saveLog(entries)

  const { weekTotal, weekCuts } = summarize(entries)
  const ok = new Alert()
  ok.title = "Saved"
  ok.message = `${euro(amount)} logged.\nThis week: ${euro(weekTotal)} over ${weekCuts} cut${weekCuts === 1 ? "" : "s"}.`
  ok.addAction("Done")
  await ok.presentAlert()
  return true
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  const entries = await loadLog()
  if (config.runsInWidget) {
    Script.setWidget(buildWidget(entries))
  } else {
    await logCutFlow(entries)
    // Show the updated widget as a preview after logging.
    await buildWidget(await loadLog()).presentMedium()
  }
  Script.complete()
}

main()
