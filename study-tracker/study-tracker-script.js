// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: book;
// ─────────────────────────────────────────
//  STUDY TRACKER — weekly study widget + Pomodoro logger
//  Widget: this week's minutes per subject, highlights subjects under target.
//  Run directly: pick a subject → log a session, or start a 25-min Pomodoro.
//
//  Note: Scriptable can't run a live 25-min foreground timer, so "start timer"
//  schedules a local notification; tapping it reopens this script and logs the
//  session. Manual "log now" is always available.
// ─────────────────────────────────────────

const LOG_FILE = "study-log.json"
let SUBJECTS = [
  { name: "Wiskunde",  weeklyTargetHours: 2 },
  { name: "Engels",    weeklyTargetHours: 1 },
  { name: "Economie",  weeklyTargetHours: 1 },
  { name: "Nederlands",weeklyTargetHours: 1 },
]
let POMODORO_MIN = 25

const C = {
  bg:      new Color("#0b1020"),
  bg2:     new Color("#111934"),
  accent:  new Color("#60a5fa"),
  warn:    new Color("#fb923c"),
  primary: new Color("#e4ecff"),
  sub:     new Color("#7787a8"),
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

async function loadConfig() {
  const cfg = await loadJson("Config/study-config.json", null)
  if (!cfg) return
  if (Array.isArray(cfg.subjects) && cfg.subjects.length) SUBJECTS = cfg.subjects
  if (typeof cfg.pomodoroMin === "number") POMODORO_MIN = cfg.pomodoroMin
}

// ─── DERIVE ───────────────────────────────────────────
function startOfWeek() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7  // 0 = Monday
  d.setDate(d.getDate() - dow)
  return d
}
function weeklyMinutes(entries) {
  const wk = startOfWeek().getTime()
  const totals = {}
  for (const e of entries) {
    if (new Date(`${e.date}T00:00:00`).getTime() < wk) continue
    totals[e.subject] = (totals[e.subject] || 0) + (Number(e.durationMin) || 0)
  }
  return totals
}
function fmtDuration(min) {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h}u ${m}m` : `${m}m`
}

// ─── WIDGET ───────────────────────────────────────────
function buildWidget(entries) {
  const w = new ListWidget()
  const grad = new LinearGradient()
  grad.colors = [C.bg, C.bg2]; grad.locations = [0, 1]
  w.backgroundGradient = grad
  w.setPadding(14, 16, 12, 16)

  const hdr = w.addText("STUDY · THIS WEEK")
  hdr.font = Font.boldSystemFont(9); hdr.textColor = C.accent
  w.addSpacer(6)

  const totals = weeklyMinutes(entries)
  for (const s of SUBJECTS) {
    const mins   = totals[s.name] || 0
    const target = (Number(s.weeklyTargetHours) || 0) * 60
    const under  = target > 0 && mins < target
    const row = w.addStack()
    row.layoutHorizontally(); row.centerAlignContent()
    const name = row.addText(s.name)
    name.font = Font.systemFont(12); name.textColor = under ? C.warn : C.primary
    name.lineLimit = 1
    row.addSpacer()
    const val = row.addText(target ? `${fmtDuration(mins)} / ${s.weeklyTargetHours}u` : fmtDuration(mins))
    val.font = Font.mediumSystemFont(11); val.textColor = under ? C.warn : C.sub
    w.addSpacer(3)
  }

  w.url = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name())
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)
  return w
}

// ─── LOGGING ──────────────────────────────────────────
function appendSession(entries, subject, durationMin) {
  const now = new Date()
  entries.push({ date: isoDate(now), subject, durationMin, ts: now.toISOString() })
  saveJson(LOG_FILE, entries)
}

async function pickSubject() {
  const a = new Alert()
  a.title = "Study session"
  a.message = "Pick a subject"
  for (const s of SUBJECTS) a.addAction(s.name)
  a.addCancelAction("Cancel")
  const idx = await a.presentSheet()
  return idx === -1 ? null : SUBJECTS[idx].name
}

async function startPomodoro(subject) {
  const n = new Notification()
  n.title = "Pomodoro done"
  n.body  = `${subject} — tap to log your ${POMODORO_MIN}-min session`
  n.scriptName = Script.name()
  n.userInfo = { pendingSubject: subject, minutes: POMODORO_MIN }
  n.setTriggerDate(new Date(Date.now() + POMODORO_MIN * 60 * 1000))
  await n.schedule()
  const ok = new Alert()
  ok.title = "Timer started"
  ok.message = `${POMODORO_MIN} min on ${subject}. You'll get a notification when it's done.`
  ok.addAction("OK")
  await ok.presentAlert()
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  await loadConfig()
  let entries = await loadJson(LOG_FILE, [])
  if (!Array.isArray(entries)) entries = []

  // Reopened from a finished Pomodoro notification → log it.
  const ui = (typeof args !== "undefined" && args.notification) ? args.notification.userInfo : null
  if (ui && ui.pendingSubject) {
    appendSession(entries, ui.pendingSubject, Number(ui.minutes) || POMODORO_MIN)
    const done = new Alert()
    done.title = "Logged"
    done.message = `${ui.minutes || POMODORO_MIN} min of ${ui.pendingSubject} added.`
    done.addAction("Done")
    await done.presentAlert()
    Script.complete()
    return
  }

  if (config.runsInWidget) {
    Script.setWidget(buildWidget(entries))
    Script.complete()
    return
  }

  const subject = await pickSubject()
  if (!subject) { Script.complete(); return }

  const a = new Alert()
  a.title = subject
  a.message = "Log a finished session or start a Pomodoro timer."
  a.addTextField("Minutes (for manual log)", String(POMODORO_MIN))
  a.addAction("Log now")
  a.addAction(`Start ${POMODORO_MIN}-min timer`)
  a.addCancelAction("Cancel")
  const idx = await a.presentAlert()
  if (idx === 0) {
    const m = parseInt(a.textFieldValue(0), 10)
    appendSession(entries, subject, isNaN(m) ? POMODORO_MIN : m)
    await buildWidget(await loadJson(LOG_FILE, [])).presentMedium()
  } else if (idx === 1) {
    await startPomodoro(subject)
  }
  Script.complete()
}

main()
