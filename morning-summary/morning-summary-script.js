// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: magic;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: magic;
// ══════════════════════════════════════════════════════
//  MORNING SUMMARY — Visual Card + Telegram
//  Design: "Daybreak Ledger" — warm espresso / gold,
//  Hoefler Text + Menlo + Avenir Next
//  Paste into Scriptable, fill in token + chatId
// ══════════════════════════════════════════════════════

// ─── CONFIG ───────────────────────────────────────────
const CFG = {
  token:     "8640101139:AAHXGd_zOmbshBEtSUjcFW-zkap4JNr47hE",
  chatId:    "8005583266",
  calendars: ["Events","Family","Rooster","School","Personal","Barber Appointments","Admin","Other"],
  thresh:    { wind: 25, cold: 3, warm: 25, uv: 6 }
}

// ─── DESIGN ───────────────────────────────────────────
const SCALE      = 1          // 1pt = let respectScreenScale handle device res
const TOP_INSET  = 62         // Dynamic Island safe area (pt)
const W          = 390 * SCALE
const PAD        = 18  * SCALE
const CORNER     = 12  * SCALE

function sc(n) { return n * SCALE }

// Palette — warm espresso canvas, single gold accent ("daybreak")
// Each card has a distinct dark tint for at-a-glance section recognition
const C = {
  bg:          new Color("#15110C"),
  glowTop:     new Color("#33220F"),   // sunrise glow behind masthead
  cardWeather: new Color("#171C22"),   // dark slate-blue  (sky)
  calCard:     new Color("#231E10"),   // amber-warm       (hero/gold)
  cardRemind:  new Color("#151A15"),   // dark forest      (tasks)
  cardAdvice:  new Color("#1C161A"),   // dark plum        (guidance)
  accent:      new Color("#E2B262"),   // warm gold — labels, bars, group names
  accentDeep:  new Color("#C9924A"),   // deeper gold — kicker, underline
  textMain:    new Color("#F0E9DA"),   // warm cream
  textSub:     new Color("#8A8070"),   // warm taupe
  textTime:    new Color("#B7AC92"),   // muted warm — times
  hair:        new Color("#2E2619")    // hairline divider
}

// Type system — distinctive iOS-native pairing
const F = {
  mast:     new Font("HoeflerText-Black",  sc(26)),
  dateline: new Font("HoeflerText-Italic", sc(11.5)),
  kicker:   new Font("Menlo-Bold",         sc(9.5)),
  secLbl:   new Font("Menlo-Bold",         sc(9)),
  calGrp:   new Font("Menlo-Bold",         sc(10.5)),
  wMain:    new Font("AvenirNext-Medium",  sc(14.5)),
  wSub:     new Font("AvenirNext-Regular", sc(11.5)),
  evtName:  new Font("AvenirNext-Medium",  sc(13.5)),
  evtTime:  new Font("Menlo-Regular",      sc(11.5)),
  advTxt:   new Font("AvenirNext-Regular", sc(12.5)),
  remTxt:   new Font("AvenirNext-Regular", sc(12.5)),
  overflow: new Font("AvenirNext-Italic",  sc(11)),
  empty:    new Font("AvenirNext-Italic",  sc(12.5))
}

const S = {
  headerH: TOP_INSET + 100,   // 62pt DI inset + 100pt content
  cp:      sc(15),   // card padding
  slH:     sc(23),   // section label → content
  glH:     sc(28),   // calendar group label row
  evH:     sc(27),   // event row
  gg:      sc(13),   // gap between calendar groups
  adH:     sc(22),   // advice row
  rmH:     sc(24),   // reminder row
  sg:      sc(12),   // gap between sections
  bp:      sc(26)    // bottom padding
}

// ─── COLOR / TRACK HELPERS ────────────────────────────
function clamp01(v) { return Math.max(0, Math.min(1, v)) }
function lerp(a, b, t) { return a + (b - a) * t }
function ch(v) { return Math.round(clamp01(v) * 255).toString(16).padStart(2, "0") }
function lerpColor(a, b, t) {
  return new Color("#" + ch(lerp(a.red, b.red, t)) + ch(lerp(a.green, b.green, t)) + ch(lerp(a.blue, b.blue, t)))
}
// subtle editorial letter-tracking using thin spaces
function trk(s) { return s.split("").join("\u200A") }
// truncate string to n chars with ellipsis — drawTextInRect does not add one
function capStr(s, n) { return s.length > n ? s.slice(0, n - 1) + "\u2026" : s }

// Minimalist sunrise/sunset icon — upper semicircle + rays up (rise) or lower semicircle + rays down (set)
function sunIcon(dc, x, y, sz, color, isRise) {
  dc.setStrokeColor(color)
  dc.setLineWidth(0.75)
  const cx   = x + sz * 0.5
  const base = y + sz * 0.68
  const r    = sz * 0.25
  const gap  = sz * 0.10
  const rLen = sz * 0.20
  // Horizon line
  const h = new Path()
  h.move(new Point(x, base))
  h.addLine(new Point(x + sz, base))
  dc.addPath(h); dc.strokePath()
  // Semicircle — upper half for rise, lower half for set
  const arc = new Path()
  for (let i = 0; i <= 12; i++) {
    const a  = Math.PI * i / 12
    const px = isRise ? cx - r * Math.cos(a) : cx + r * Math.cos(a)
    const py = isRise ? base - r * Math.sin(a) : base + r * Math.sin(a)
    i === 0 ? arc.move(new Point(px, py)) : arc.addLine(new Point(px, py))
  }
  dc.addPath(arc); dc.strokePath()
  // Rays — fan upward for rise, downward for set
  const angles = isRise
    ? [Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.25]
    : [Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75]
  for (const a of angles) {
    const sx = cx + (r + gap) * Math.cos(a)
    const sy = base - (r + gap) * Math.sin(a)
    const ex = cx + (r + gap + rLen) * Math.cos(a)
    const ey = base - (r + gap + rLen) * Math.sin(a)
    const ray = new Path()
    ray.move(new Point(sx, sy))
    ray.addLine(new Point(ex, ey))
    dc.addPath(ray); dc.strokePath()
  }
}

// ─── DRAW HELPERS ─────────────────────────────────────
function rrect(dc, x, y, w, h, color) {
  dc.setFillColor(color)
  const p = new Path()
  p.addRoundedRect(new Rect(x, y, w, h), CORNER, CORNER)
  dc.addPath(p)
  dc.fillPath()
}

function fillR(dc, x, y, w, h, color) {
  dc.setFillColor(color)
  dc.fillRect(new Rect(x, y, w, h))
}

function vGradient(dc, x, y, w, h, top, bottom) {
  const step = 2
  for (let i = 0; i < h; i += step) {
    dc.setFillColor(lerpColor(top, bottom, i / h))
    dc.fillRect(new Rect(x, y + i, w, step + 1))
  }
}

function dtxt(dc, text, x, y, font, color) {
  dc.setFont(font)
  dc.setTextColor(color)
  dc.setTextAlignedLeft()
  dc.drawText(String(text), new Point(x, y))
}

function dtxtR(dc, text, x, y, w, h, font, color) {
  dc.setFont(font)
  dc.setTextColor(color)
  dc.setTextAlignedRight()
  dc.drawTextInRect(String(text), new Rect(x, y, w, h))
}

function dtxtIn(dc, text, x, y, w, h, font, color) {
  dc.setFont(font)
  dc.setTextColor(color)
  dc.setTextAlignedLeft()
  dc.drawTextInRect(String(text), new Rect(x, y, w, h))
}

// ─── SECTION RENDERERS ────────────────────────────────
// dc = null → measure only, dc = DrawContext → draw

function renderHeader(dc, y, data) {
  if (dc) {
    // gradient bleeds behind Dynamic Island — intentional
    vGradient(dc, 0, y, W, S.headerH, C.glowTop, C.bg)

    // all text starts below Dynamic Island safe area
    const ty = y + TOP_INSET
    const battStr = data.charging ? `${data.battery}%\u2191` : `${data.battery}%`
    const kick = data.city
      ? `${trk(data.city.toUpperCase())}   \u00B7   ${data.timeStr}   \u00B7   ${battStr}`
      : `${data.timeStr}   \u00B7   ${battStr}`
    dtxt(dc, kick, PAD, ty + 8, F.kicker, C.accentDeep)
    dtxt(dc, "Morning Summary", PAD, ty + 24, F.mast, C.textMain)
    dtxt(dc, data.dateStr, PAD, ty + 58, F.dateline, C.textSub)
    fillR(dc, PAD, ty + 74, 54, 2, C.accent)
  }
  return y + S.headerH
}

function renderWeather(dc, y, weather) {
  const cardH = S.cp + S.slH + sc(19) + sc(17) + sc(17) + S.cp
  if (dc) {
    rrect(dc, PAD, y, W - PAD * 2, cardH, C.cardWeather)
    const cx = PAD + S.cp
    let cy = y + S.cp
    dtxt(dc, trk("WEATHER"), cx, cy, F.secLbl, C.accent)
    cy += S.slH
    const wd = weatherLabel(weather.code)
    dtxt(dc, `${wd.text}   \u00B7   ${weather.temp}\u00B0   \u00B7   feels ${weather.feelsLike}\u00B0`, cx, cy, F.wMain, C.textMain)
    cy += sc(19)
    dtxt(dc, `High ${weather.high}\u00B0    Low ${weather.low}\u00B0    Wind ${weather.windSpeed} km/h`, cx, cy, F.wSub, C.textSub)
    cy += sc(17)
    const iSz  = sc(12)
    const tGap = sc(4)
    const grpW = sc(56)   // width per icon+time group
    if (weather.sunriseStr) {
      sunIcon(dc, cx, cy, iSz, C.textSub, true)
      dtxt(dc, weather.sunriseStr, cx + iSz + tGap, cy + sc(1), F.wSub, C.textSub)
    }
    if (weather.sunsetStr) {
      const offX = weather.sunriseStr ? cx + grpW : cx
      sunIcon(dc, offX, cy, iSz, C.textSub, false)
      dtxt(dc, weather.sunsetStr, offX + iSz + tGap, cy + sc(1), F.wSub, C.textSub)
    }
  }
  return y + cardH
}

function calHeight(calendar) {
  if (!calendar.ok) return S.cp + S.slH + sc(22) + S.cp
  const sorted = sortedCals(calendar)
  const perCal = sorted.length === 1 ? 7 : 4
  let h = S.cp + S.slH
  for (let i = 0; i < sorted.length; i++) {
    const evCount     = Math.min(sorted[i].events.length, perCal)
    const hasOverflow = sorted[i].events.length > perCal
    h += S.glH + sc(1) + evCount * S.evH
    if (hasOverflow) h += S.evH
    if (i < sorted.length - 1) h += S.gg
  }
  return h + S.cp
}

function renderCalendar(dc, y, calendar) {
  const cardH  = calHeight(calendar)
  const innerW = W - PAD * 2 - S.cp * 2
  if (dc) {
    // hero card — lifted background
    rrect(dc, PAD, y, W - PAD * 2, cardH, C.calCard)
    const cx = PAD + S.cp
    let cy = y + S.cp

    // section label + gold underline (signals hero)
    const lbl = calendar.ok
      ? `${trk("CALENDAR")}    ${calendar.total} EVENT${calendar.total !== 1 ? "S" : ""}`
      : trk("CALENDAR")
    dtxt(dc, lbl, cx, cy, F.secLbl, C.accent)
    fillR(dc, cx, cy + sc(14), sc(26), sc(1.5), C.accentDeep)
    cy += S.slH

    if (!calendar.ok) {
      dtxt(dc, "No events today", cx, cy, F.empty, C.textSub)
    } else {
      const sorted = sortedCals(calendar)
      const perCal = sorted.length === 1 ? 7 : 4
      for (let i = 0; i < sorted.length; i++) {
        const { name, events } = sorted[i]
        // gold accent bar + group label
        fillR(dc, cx, cy + sc(5), sc(3), sc(14), C.accent)
        dtxt(dc, name.toUpperCase(), cx + sc(10), cy + sc(6), F.calGrp, C.accent)
        cy += S.glH
        // hairline
        fillR(dc, cx, cy, innerW, sc(1), C.hair)
        cy += sc(1)
        // events (capped)
        const visible = events.slice(0, perCal)
        for (const e of visible) {
          const nameW = innerW - sc(72)
          dtxtIn(dc, capStr(e.title, 28), cx + sc(4), cy + sc(6), nameW, S.evH - sc(4), F.evtName, C.textMain)
          const timeStr = e.isAllDay ? "all day" : `${fmt(e.startDate)} - ${fmt(e.endDate)}`
          dtxtR(dc, timeStr, PAD + S.cp, cy + sc(7), innerW, S.evH - sc(4), F.evtTime, C.textTime)
          cy += S.evH
        }
        // overflow indicator
        if (events.length > perCal) {
          const extra = events.length - perCal
          dtxt(dc, `+ ${extra} more`, cx + sc(4), cy + sc(6), F.overflow, C.textSub)
          cy += S.evH
        }
        if (i < sorted.length - 1) cy += S.gg
      }
    }
  }
  return y + cardH
}

function remHeight(reminders) {
  const SL  = sc(20)
  const CAP = 5
  const buckets = [reminders.overdue, reminders.dueToday, reminders.upcoming].filter(b => b.length > 0)
  const multi   = buckets.length > 1
  let h = S.cp + S.slH
  for (const b of buckets) {
    if (multi) h += SL
    h += Math.min(b.length, CAP) * S.rmH
    if (b.length > CAP) h += S.rmH   // overflow row
  }
  return h + S.cp
}

function renderReminders(dc, y, reminders) {
  const cardH  = remHeight(reminders)
  const innerW = W - PAD * 2 - S.cp * 2
  if (dc) {
    rrect(dc, PAD, y, W - PAD * 2, cardH, C.cardRemind)
    const cx = PAD + S.cp
    let cy = y + S.cp
    dtxt(dc, trk("REMINDERS"), cx, cy, F.secLbl, C.accent)
    cy += S.slH

    const SL  = sc(20)
    const CAP = 5
    const buckets = [
      { items: reminders.overdue,  label: "OVERDUE",  dot: C.accentDeep, col: C.textMain },
      { items: reminders.dueToday, label: "TODAY",    dot: C.accent,     col: C.textMain },
      { items: reminders.upcoming, label: "UPCOMING", dot: C.textSub,    col: C.textSub  }
    ].filter(b => b.items.length > 0)
    const multi = buckets.length > 1

    for (const bucket of buckets) {
      if (multi) {
        dtxt(dc, bucket.label, cx, cy, F.calGrp, bucket.dot)
        cy += SL
      }
      const visible = bucket.items.slice(0, CAP)
      for (const r of visible) {
        const prio        = r.priority
        const hasPrio     = prio > 0
        const marks       = prio === 1 ? "!!!" : prio === 5 ? "!!" : prio === 9 ? "!" : ""
        const prioCol     = prio === 1 ? C.accentDeep : prio === 5 ? C.textTime : C.textSub
        // Title x offset — shifts right to make room for marks after bullet
        // sc(14) = no priority, sc(20/26/32) = !/!!/!!! (estimated at ~5pt per ! in AvenirNext 12.5pt)
        const marksOffset = prio === 1 ? sc(32) : prio === 5 ? sc(26) : prio === 9 ? sc(20) : sc(14)

        // Bullet — always shown
        fillR(dc, cx + sc(2), cy + sc(8), sc(4), sc(4), bucket.dot)
        // Priority marks — sit between bullet and title
        if (hasPrio) dtxt(dc, marks, cx + sc(12), cy + sc(4), F.remTxt, prioCol)

        const titleX = cx + marksOffset
        const baseW  = innerW - marksOffset   // available width from title to card edge
        if (bucket.label === "UPCOMING") {
          const dueLbl = fmtShort(r.dueDate)
          dtxtIn(dc, capStr(r.title, 32), titleX, cy + sc(4), baseW - sc(46), S.rmH - sc(4), F.remTxt, bucket.col)
          dtxtR(dc, dueLbl, PAD + S.cp, cy + sc(5), innerW, S.rmH - sc(4), F.evtTime, C.textSub)
        } else {
          dtxtIn(dc, capStr(r.title, 38), titleX, cy + sc(4), baseW, S.rmH - sc(4), F.remTxt, bucket.col)
        }
        cy += S.rmH
      }
      if (bucket.items.length > CAP) {
        const extra = bucket.items.length - CAP
        dtxt(dc, `+ ${extra} more`, cx + sc(14), cy + sc(4), F.overflow, C.textSub)
        cy += S.rmH
      }
    }
  }
  return y + cardH
}

function renderAdvice(dc, y, advice) {
  const cardH  = S.cp + S.slH + advice.length * S.adH + S.cp
  const innerW = W - PAD * 2 - S.cp * 2
  if (dc) {
    rrect(dc, PAD, y, W - PAD * 2, cardH, C.cardAdvice)
    const cx = PAD + S.cp
    let cy = y + S.cp
    dtxt(dc, trk("ADVICE"), cx, cy, F.secLbl, C.accent)
    cy += S.slH
    for (const a of advice) {
      fillR(dc, cx + sc(2), cy + sc(7), sc(4), sc(4), C.accent)   // square bullet
      dtxtIn(dc, a, cx + sc(14), cy + sc(3), innerW - sc(14), S.adH - sc(2), F.advTxt, C.textMain)
      cy += S.adH
    }
  }
  return y + cardH
}

// ─── LAYOUT ───────────────────────────────────────────
function runLayout(dc, data) {
  let y = 0
  y = renderHeader(dc, y, data);   y += S.sg
  if (data.weather.ok)     { y = renderWeather(dc, y, data.weather);     y += S.sg }
  y = renderCalendar(dc, y, data.calendar)
  if (data.reminders.ok)   { y += S.sg; y = renderReminders(dc, y, data.reminders) }
  if (data.advice.length)  { y += S.sg; y = renderAdvice(dc, y, data.advice) }
  return y + S.bp
}

// ─── CALENDAR HELPERS ─────────────────────────────────
function sortedCals(calendar) {
  return CFG.calendars
    .filter(n => calendar.grouped[n]?.length)
    .sort((a, b) => calendar.grouped[a][0].startDate - calendar.grouped[b][0].startDate)
    .map(n => ({ name: n, events: calendar.grouped[n] }))
}

// ─── DATA FETCHING ────────────────────────────────────
async function getWeather() {
  try {
    Location.setAccuracyToHundredMeters()
    const loc = await Location.current()

    const [geo, res] = await Promise.all([
      Location.reverseGeocode(loc.latitude, loc.longitude),
      new Request(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `&daily=temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset` +
        `&hourly=precipitation_probability&timezone=auto&wind_speed_unit=kmh`
      ).loadJSON()
    ])

    const place = geo[0]
    const city  = place?.city || place?.subLocality || place?.administrativeArea || ""
    const c = res.current, d = res.daily, h = res.hourly

    // Rain timing — find hourly windows ≥40% probability from now until midnight
    const nowH       = new Date().getHours()
    const rainHours  = []
    for (let i = nowH; i < 24; i++) {
      if ((h.precipitation_probability[i] ?? 0) >= 40) rainHours.push(i)
    }
    // Group consecutive hours into ranges
    const rainRanges = []
    let rangeStart = null
    for (let i = 0; i < rainHours.length; i++) {
      if (rangeStart === null) rangeStart = rainHours[i]
      if (rainHours[i + 1] !== rainHours[i] + 1) {
        rainRanges.push({ from: rangeStart, to: rainHours[i] + 1 })
        rangeStart = null
      }
    }
    const rainStr = rainRanges.length
      ? rainRanges.map(r => `${String(r.from).padStart(2,"0")}:00\u2013${String(r.to).padStart(2,"0")}:00`).join(", ")
      : null

    // Sunrise + Sunset — parse ISO strings from daily response
    const sunriseRaw = d.sunrise?.[0]
    const sunsetRaw  = d.sunset?.[0]
    const sunriseStr = sunriseRaw ? sunriseRaw.slice(11, 16) : null
    const sunsetStr  = sunsetRaw  ? sunsetRaw.slice(11, 16)  : null

    return {
      ok: true, city,
      temp:      Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      windSpeed: Math.round(c.wind_speed_10m),
      code:      c.weather_code,
      high:      Math.round(d.temperature_2m_max[0]),
      low:       Math.round(d.temperature_2m_min[0]),
      uv:        Math.round(d.uv_index_max[0]),
      rainStr,
      sunriseStr,
      sunsetStr
    }
  } catch { return { ok: false, city: "" } }
}

async function getCalendar() {
  try {
    const allCals = await Calendar.forEvents()
    const allowed = allCals.filter(c => CFG.calendars.includes(c.title))
    if (!allowed.length) return { ok: false, grouped: {}, total: 0 }
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end   = new Date(); end.setHours(23, 59, 59, 999)
    const events = await CalendarEvent.between(start, end, allowed)
    if (!events.length) return { ok: false, grouped: {}, total: 0 }
    const grouped = {}
    for (const e of events) {
      const n = e.calendar.title
      if (!grouped[n]) grouped[n] = []
      grouped[n].push(e)
    }
    return { ok: true, grouped, total: events.length }
  } catch { return { ok: false, grouped: {}, total: 0 } }
}

async function getReminders() {
  try {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    const endOfToday   = new Date(); endOfToday.setHours(23, 59, 59, 999)
    const in3Days      = new Date(startOfToday.getTime() + 3 * 86400000)

    const all      = await Reminder.allIncomplete()
    const sortPrio = arr => [...arr].sort((a, b) => {
      const pa = a.priority === 0 ? 999 : a.priority  // 0=none sorts last
      const pb = b.priority === 0 ? 999 : b.priority
      return pa - pb
    })
    const overdue  = sortPrio(all.filter(r => r.dueDate && r.dueDate < startOfToday))
    const dueToday = sortPrio(all.filter(r => r.dueDate && r.dueDate >= startOfToday && r.dueDate <= endOfToday))
    const upcoming = sortPrio(all.filter(r => r.dueDate && r.dueDate > endOfToday && r.dueDate <= in3Days))

    const ok = overdue.length > 0 || dueToday.length > 0 || upcoming.length > 0
    return { ok, overdue, dueToday, upcoming }
  } catch { return { ok: false, overdue: [], dueToday: [], upcoming: [] } }
}

// ─── ADVICE ───────────────────────────────────────────
function buildAdvice(weather, calendar) {
  const advice = [], now = new Date()
  if (calendar.ok) {
    const all = []
    for (const n of CFG.calendars) if (calendar.grouped[n]) all.push(...calendar.grouped[n])
    all.sort((a, b) => a.startDate - b.startDate)

    // busy / light day
    if (calendar.total >= 4) {
      advice.push(`Heavy day \u2014 ${calendar.total} events. Stay on schedule`)
    } else if (calendar.total <= 1) {
      advice.push(`Light day \u2014 good time to study or prep the shop`)
    }

    // late finish (any timed event ending at or after 21:00)
    const timed = all.filter(e => !e.isAllDay && e.endDate)
    if (timed.length) {
      const latest = timed.reduce((a, b) => a.endDate > b.endDate ? a : b)
      if (latest.endDate.getHours() >= 21) {
        advice.push(`Late finish \u2014 last event ends at ${fmt(latest.endDate)}`)
      }
    }
  }
  if (weather.ok) {
    const wd = weatherLabel(weather.code)
    if (weather.rainStr)                               advice.push(`Rain likely ${weather.rainStr} \u2014 bring an umbrella`)
    if (weather.windSpeed >= CFG.thresh.wind)          advice.push(`Windy (${weather.windSpeed} km/h) \u2014 bring a windproof jacket`)
    if (weather.temp - weather.feelsLike >= 4)         advice.push(`Feels ${weather.feelsLike}\u00B0 due to wind chill \u2014 dress warmer`)
    if (weather.high < CFG.thresh.cold)                advice.push(`Very cold (${weather.high}\u00B0C) \u2014 add gloves`)
    if (weather.high >= CFG.thresh.warm)               advice.push(`Warm day (${weather.high}\u00B0C) \u2014 light clothing`)
    if (wd.sunny || weather.uv >= CFG.thresh.uv)       advice.push(`Consider sunscreen`)
  }
  if (calendar.ok) {
    const barberCount = calendar.grouped["Barber Appointments"]?.length ?? 0
    if (barberCount > 3) advice.push(`${barberCount} clients today \u2014 busy one at the shop`)
  }
  return advice
}

// ─── WEATHER LABEL ────────────────────────────────────
function weatherLabel(code) {
  if (code === 0)  return { text: "Clear sky",       sunny: true  }
  if (code <= 2)   return { text: "Mainly clear",    sunny: true  }
  if (code === 3)  return { text: "Overcast",        sunny: false }
  if (code <= 48)  return { text: "Foggy",           sunny: false }
  if (code <= 55)  return { text: "Drizzle",         sunny: false }
  if (code <= 57)  return { text: "Freezing drizzle",sunny: false }
  if (code <= 65)  return { text: "Rain",            sunny: false }
  if (code <= 67)  return { text: "Freezing rain",   sunny: false }
  if (code <= 75)  return { text: "Snow",            sunny: false }
  if (code === 77) return { text: "Snow grains",     sunny: false }
  if (code <= 82)  return { text: "Rain showers",    sunny: false }
  if (code <= 86)  return { text: "Snow showers",    sunny: false }
  return                  { text: "Thunderstorm",    sunny: false }
}

// ─── HELPERS ──────────────────────────────────────────
function fmt(date) {
  return date.getHours().toString().padStart(2, "0") + ":" +
         date.getMinutes().toString().padStart(2, "0")
}

function fmtDate(date) {
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function fmtShort(date) {
  const days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}

// ─── TELEGRAM ─────────────────────────────────────────
async function sendPhoto(image, caption) {
  const req = new Request(`https://api.telegram.org/bot${CFG.token}/sendPhoto`)
  req.method = "POST"
  req.addParameterToMultipart("chat_id", CFG.chatId)
  req.addParameterToMultipart("caption", caption)
  req.addImageToMultipart(image, "photo", "morning.jpg")
  try { const r = await req.loadJSON(); return r.ok }
  catch { return false }
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  const now = new Date()
  const [weather, calendar, reminders] = await Promise.all([
    getWeather(), getCalendar(), getReminders()
  ])
  const advice = buildAdvice(weather, calendar)
  const battery  = Math.round(Device.batteryLevel() * 100)
  const charging = Device.isCharging()
  const data = {
    weather, calendar, reminders, advice,
    city:    weather.city || "",
    dateStr: fmtDate(now),
    timeStr: fmt(now),
    battery,
    charging
  }

  // Pass 1 — measure
  const totalH = runLayout(null, data)

  // Pass 2 — draw (fill at least one screen height)
  const canvasH = Math.max(totalH, 844 * SCALE)
  const dc = new DrawContext()
  dc.size = new Size(W, canvasH)
  dc.opaque = true
  dc.respectScreenScale = true   // renders at native 3x — no upscaling blur
  dc.setFillColor(C.bg)
  dc.fillRect(new Rect(0, 0, W, canvasH))
  runLayout(dc, data)

  const image = dc.getImage()

  // Caption
  const calPart = calendar.ok ? `${calendar.total} events` : "No events"
  const wxPart  = weather.ok  ? `${weatherLabel(weather.code).text} \u00B7 ${weather.temp}\u00B0C` : ""
  const locPart = data.city
  const caption = [calPart, wxPart, locPart].filter(Boolean).join("  \u00B7  ")

  const sent = await sendPhoto(image, caption)
  if (!sent) {
    const n = new Notification()
    n.title = "Morning Summary"
    n.body  = "Telegram send failed — check token and chat ID"
    await n.schedule()
  }
}

main().finally(() => Script.complete())