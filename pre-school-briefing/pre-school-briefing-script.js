// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: school;
// ─────────────────────────────────────────
//  PRE-SCHOOL BRIEFING — compact plain-text Telegram message
//  Trigger via Shortcuts when School Focus activates.
//  First lesson (time + room), deadlines due today, commute weather.
// ─────────────────────────────────────────

let ROOSTER_NAME   = "Rooster"   // iOS calendar with the timetable
let REMINDERS_NAME = null         // null = all incomplete reminders due today

// ─── CONFIG ───────────────────────────────────────────
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
async function loadConfig() {
  const cfg = await loadJson("Config/pre-school-config.json", null)
  if (!cfg) return
  if (cfg.roosterName)   ROOSTER_NAME   = cfg.roosterName
  if (cfg.remindersName) REMINDERS_NAME = cfg.remindersName
}

// ─── HELPERS ──────────────────────────────────────────
function fmt(d) {
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0")
}

// ─── DATA ─────────────────────────────────────────────
async function firstLesson() {
  try {
    const cals = await Calendar.forEvents()
    const cal  = cals.find(c => c.title === ROOSTER_NAME)
    if (!cal) return null
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end   = new Date(); end.setHours(23, 59, 59, 999)
    const evts  = (await CalendarEvent.between(start, end, [cal]))
      .filter(e => !e.isAllDay)
      .sort((a, b) => a.startDate - b.startDate)
    if (!evts.length) return null
    const e = evts[0]
    return { name: String(e.title || "").split(" - ")[0].trim(), start: e.startDate, room: e.location || "" }
  } catch { return null }
}

async function deadlinesToday() {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end   = new Date(); end.setHours(23, 59, 59, 999)
    let all = await Reminder.allIncomplete()
    if (REMINDERS_NAME) {
      const lists = await Calendar.forReminders()
      const list  = lists.find(c => c.title === REMINDERS_NAME)
      if (list) all = await Reminder.allIncomplete([list])
    }
    return all
      .filter(r => r.dueDate && r.dueDate >= start && r.dueDate <= end)
      .map(r => r.title)
  } catch { return [] }
}

async function commuteWeather() {
  try {
    Location.setAccuracyToHundredMeters()
    const loc = await Location.current()
    const res = await new Request(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min` +
      `&hourly=precipitation_probability&timezone=auto`
    ).loadJSON()
    const c = res.current, d = res.daily, h = res.hourly
    const nowH = new Date().getHours()
    let rain = false
    for (let i = nowH; i < Math.min(nowH + 4, 24); i++) {
      if ((h.precipitation_probability?.[i] ?? 0) >= 40) { rain = true; break }
    }
    return {
      temp: Math.round(c.temperature_2m),
      high: Math.round(d.temperature_2m_max[0]),
      low:  Math.round(d.temperature_2m_min[0]),
      rain,
    }
  } catch { return null }
}

// ─── TELEGRAM ─────────────────────────────────────────
async function telegram(text) {
  const cfg = await loadJson("Config/morning-summary-config.json", null)
  if (!cfg || !cfg.token || !cfg.chatId) return false
  const req = new Request(`https://api.telegram.org/bot${cfg.token}/sendMessage`)
  req.method = "POST"
  req.addParameterToMultipart("chat_id", String(cfg.chatId))
  req.addParameterToMultipart("text", text)
  try { const r = await req.loadJSON(); return !!r.ok } catch { return false }
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  await loadConfig()
  const [lesson, deadlines, wx] = await Promise.all([firstLesson(), deadlinesToday(), commuteWeather()])

  const lines = ["🏫 Pre-school briefing"]
  if (lesson) {
    const room = lesson.room && lesson.room !== "verborgen" ? ` · ${lesson.room}` : ""
    lines.push(`First: ${lesson.name} ${fmt(lesson.start)}${room}`)
  } else {
    lines.push("No lessons today")
  }
  lines.push(deadlines.length ? `Due today: ${deadlines.join(", ")}` : "Due today: none")
  if (wx) lines.push(`Weather: ${wx.temp}° (H ${wx.high}° / L ${wx.low}°)${wx.rain ? " · rain likely — umbrella" : ""}`)

  const text = lines.join("\n")
  const sent = await telegram(text)
  if (!sent) {
    const n = new Notification()
    n.title = "Pre-school briefing"
    n.body  = text
    await n.schedule()
  }
  Script.complete()
}

main()
