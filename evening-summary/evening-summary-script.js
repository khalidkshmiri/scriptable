// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: moon;
// ─────────────────────────────────────────
//  EVENING SUMMARY — visual card + Telegram, for tomorrow
//  Mirrors the morning-summary "Daybreak Ledger" style (dark / gold).
//  Trigger via Shortcuts at ~21:30. Reuses morning-summary Telegram creds.
// ─────────────────────────────────────────

const CFG = {
  token: "", chatId: "",
  calendars: ["Events","Family","Rooster","School","Personal","Barber Appointments","Admin","Other"],
}

async function loadConfig() {
  const fm = FileManager.iCloud()
  const mPath = fm.joinPath(fm.documentsDirectory(), "Config/morning-summary-config.json")
  if (fm.fileExists(mPath)) {
    await fm.downloadFileFromiCloud(mPath)
    const m = JSON.parse(fm.readString(mPath))
    CFG.token = m.token; CFG.chatId = m.chatId
    if (Array.isArray(m.calendars) && m.calendars.length) CFG.calendars = m.calendars
  }
  const ePath = fm.joinPath(fm.documentsDirectory(), "Config/evening-summary-config.json")
  if (fm.fileExists(ePath)) {
    await fm.downloadFileFromiCloud(ePath)
    const e = JSON.parse(fm.readString(ePath))
    if (e.token)  CFG.token  = e.token
    if (e.chatId) CFG.chatId = e.chatId
    if (Array.isArray(e.calendars) && e.calendars.length) CFG.calendars = e.calendars
  }
  if (!CFG.token || !CFG.chatId) throw new Error("Telegram token/chatId not found (set Config/morning-summary-config.json)")
}

// ─── DESIGN ───────────────────────────────────────────
const W = 390, PAD = 18, CORNER = 12, TOP_INSET = 28
const C = {
  bg:      new Color("#0E0B14"),
  glow:    new Color("#241733"),
  card:    new Color("#171320"),
  card2:   new Color("#1A1422"),
  accent:  new Color("#A98BD8"),
  accentD: new Color("#8A6FB8"),
  text:    new Color("#ECE6F2"),
  sub:     new Color("#8A8296"),
  time:    new Color("#B0A6BE"),
  hair:    new Color("#272031"),
}
const F = {
  mast:  new Font("HoeflerText-Black", 26),
  date:  new Font("HoeflerText-Italic", 11.5),
  kick:  new Font("Menlo-Bold", 9.5),
  sec:   new Font("Menlo-Bold", 9),
  main:  new Font("AvenirNext-Medium", 14.5),
  sub:   new Font("AvenirNext-Regular", 11.5),
  evt:   new Font("AvenirNext-Medium", 13.5),
  evtT:  new Font("Menlo-Regular", 11.5),
}

function trk(s) { return s.split("").join(" ") }
function cap(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s }
function clamp01(v){ return Math.max(0,Math.min(1,v)) }
function lerp(a,b,t){ return a+(b-a)*t }
function ch(v){ return Math.round(clamp01(v)*255).toString(16).padStart(2,"0") }
function lerpColor(a,b,t){ return new Color("#"+ch(lerp(a.red,b.red,t))+ch(lerp(a.green,b.green,t))+ch(lerp(a.blue,b.blue,t))) }

function rrect(dc,x,y,w,h,color){ dc.setFillColor(color); const p=new Path(); p.addRoundedRect(new Rect(x,y,w,h),CORNER,CORNER); dc.addPath(p); dc.fillPath() }
function fillR(dc,x,y,w,h,color){ dc.setFillColor(color); dc.fillRect(new Rect(x,y,w,h)) }
function vGrad(dc,x,y,w,h,a,b){ for(let i=0;i<h;i+=2){ dc.setFillColor(lerpColor(a,b,i/h)); dc.fillRect(new Rect(x,y+i,w,3)) } }
function txt(dc,t,x,y,f,c){ dc.setFont(f); dc.setTextColor(c); dc.setTextAlignedLeft(); dc.drawText(String(t),new Point(x,y)) }
function txtR(dc,t,x,y,w,h,f,c){ dc.setFont(f); dc.setTextColor(c); dc.setTextAlignedRight(); dc.drawTextInRect(String(t),new Rect(x,y,w,h)) }
function txtIn(dc,t,x,y,w,h,f,c){ dc.setFont(f); dc.setTextColor(c); dc.setTextAlignedLeft(); dc.drawTextInRect(String(t),new Rect(x,y,w,h)) }

// ─── HELPERS ──────────────────────────────────────────
function fmt(d){ return d.getHours().toString().padStart(2,"0")+":"+d.getMinutes().toString().padStart(2,"0") }
function fmtDate(d){
  const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  const mo=["January","February","March","April","May","June","July","August","September","October","November","December"]
  return `${days[d.getDay()]}, ${d.getDate()} ${mo[d.getMonth()]}`
}
function weatherLabel(code){
  if(code===0)return"Clear sky"; if(code<=2)return"Mainly clear"; if(code===3)return"Overcast"
  if(code<=48)return"Foggy"; if(code<=55)return"Drizzle"; if(code<=65)return"Rain"
  if(code<=75)return"Snow"; if(code<=82)return"Rain showers"; if(code<=86)return"Snow showers"
  return"Thunderstorm"
}

// ─── DATA ─────────────────────────────────────────────
async function getTomorrowWeather(loc){
  try{
    const res=await new Request(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}`+
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&timezone=auto&forecast_days=2`
    ).loadJSON()
    const d=res.daily, i=1
    return { ok:true, high:Math.round(d.temperature_2m_max[i]), low:Math.round(d.temperature_2m_min[i]),
             code:d.weather_code[i], sunrise:d.sunrise?.[i]?.slice(11,16), sunset:d.sunset?.[i]?.slice(11,16) }
  }catch{ return {ok:false} }
}
async function getTomorrowEvents(){
  try{
    const cals=(await Calendar.forEvents()).filter(c=>CFG.calendars.includes(c.title))
    if(!cals.length) return []
    const s=new Date(); s.setDate(s.getDate()+1); s.setHours(0,0,0,0)
    const e=new Date(s); e.setHours(23,59,59,999)
    return (await CalendarEvent.between(s,e,cals)).sort((a,b)=>a.startDate-b.startDate)
  }catch{ return [] }
}
async function getSoonReminders(){
  try{
    const now=new Date(); const in2=new Date(now.getTime()+2*86400000)
    return (await Reminder.allIncomplete())
      .filter(r=>r.dueDate && r.dueDate<=in2)
      .sort((a,b)=>(a.dueDate||0)-(b.dueDate||0))
  }catch{ return [] }
}

// ─── RENDER ───────────────────────────────────────────
async function buildImage(data){
  // Collapse the school timetable so it isn't 9 rows
  const events=[]
  let school=null
  for(const e of data.events){
    if(e.calendar && e.calendar.title==="Rooster"){
      if(!school) school={ title:"School", startDate:e.startDate, endDate:e.endDate, isAllDay:false }
      else if(e.endDate>school.endDate) school.endDate=e.endDate
      if(e.startDate<school.startDate) school.startDate=e.startDate
    } else events.push(e)
  }
  if(school) events.unshift(school)
  events.sort((a,b)=>a.startDate-b.startDate)
  const evShown=events.slice(0,7)
  const remShown=data.reminders.slice(0,6)

  const headerH=TOP_INSET+96
  const wxH=data.weather.ok? 15+20+19+19+15 : 0
  const evH=evShown.length? 15+23+evShown.length*27+15 : 15+23+24+15
  const remH=remShown.length? 15+23+remShown.length*24+15 : 0
  const sg=12, bp=26
  let total=headerH+sg+(wxH?wxH+sg:0)+evH+(remH?sg+remH:0)+bp

  const dc=new DrawContext()
  dc.size=new Size(W, Math.max(total, 600))
  dc.opaque=true; dc.respectScreenScale=true
  dc.setFillColor(C.bg); dc.fillRect(new Rect(0,0,W,Math.max(total,600)))

  let y=0
  // Header
  vGrad(dc,0,y,W,headerH,C.glow,C.bg)
  const ty=y+TOP_INSET
  txt(dc,`${trk("TOMORROW")}   ·   ${data.dateStr}`,PAD,ty+8,F.kick,C.accentD)
  txt(dc,"Evening Briefing",PAD,ty+24,F.mast,C.text)
  txt(dc,"Prep tonight, win the morning",PAD,ty+58,F.date,C.sub)
  fillR(dc,PAD,ty+74,54,2,C.accent)
  y+=headerH+sg

  // Weather (tomorrow)
  if(data.weather.ok){
    rrect(dc,PAD,y,W-PAD*2,wxH,C.card)
    const cx=PAD+15; let cy=y+15
    txt(dc,trk("TOMORROW'S WEATHER"),cx,cy,F.sec,C.accent); cy+=20
    txt(dc,`${weatherLabel(data.weather.code)}   ·   H ${data.weather.high}°   ·   L ${data.weather.low}°`,cx,cy,F.main,C.text); cy+=19
    const sun=[data.weather.sunrise&&`sunrise ${data.weather.sunrise}`,data.weather.sunset&&`sunset ${data.weather.sunset}`].filter(Boolean).join("    ")
    if(sun) txt(dc,sun,cx,cy,F.sub,C.sub)
    y+=wxH+sg
  }

  // Tomorrow's events
  rrect(dc,PAD,y,W-PAD*2,evH,C.card2)
  const innerW=W-PAD*2-30
  { const cx=PAD+15; let cy=y+15
    txt(dc,`${trk("AGENDA")}    ${events.length} EVENT${events.length!==1?"S":""}`,cx,cy,F.sec,C.accent)
    fillR(dc,cx,cy+14,26,1.5,C.accentD); cy+=23
    if(!evShown.length){ txt(dc,"Nothing scheduled — a free day",cx,cy,F.date,C.sub) }
    else for(const e of evShown){
      txtIn(dc,cap(e.title,30),cx+4,cy+6,innerW-72,23,F.evt,C.text)
      txtR(dc,e.isAllDay?"all day":`${fmt(e.startDate)} - ${fmt(e.endDate)}`,PAD+15,cy+7,innerW,23,F.evtT,C.time)
      cy+=27
    }
  }
  y+=evH

  // Reminders due within 2 days
  if(remShown.length){
    y+=sg
    rrect(dc,PAD,y,W-PAD*2,remH,C.card)
    const cx=PAD+15; let cy=y+15
    txt(dc,trk("DUE SOON"),cx,cy,F.sec,C.accent); cy+=23
    for(const r of remShown){
      fillR(dc,cx+2,cy+8,4,4,C.accent)
      txtIn(dc,cap(r.title,30),cx+14,cy+4,innerW-46,20,F.sub,C.text)
      const due=r.dueDate
      const lbl=due? (due.toDateString()===new Date().toDateString()?"today":fmt(due)) : ""
      txtR(dc,lbl,PAD+15,cy+5,innerW,20,F.evtT,C.sub)
      cy+=24
    }
  }

  return dc.getImage()
}

async function sendPhoto(image,caption){
  const req=new Request(`https://api.telegram.org/bot${CFG.token}/sendPhoto`)
  req.method="POST"
  req.addParameterToMultipart("chat_id",String(CFG.chatId))
  req.addParameterToMultipart("caption",caption)
  req.addImageToMultipart(image,"photo","evening.jpg")
  try{ const r=await req.loadJSON(); return !!r.ok }catch{ return false }
}

// ─── MAIN ─────────────────────────────────────────────
async function main(){
  await loadConfig()
  Location.setAccuracyToHundredMeters()
  let loc; try{ loc=await Location.current() }catch{ loc=null }
  const [weather,events,reminders]=await Promise.all([
    loc?getTomorrowWeather(loc):Promise.resolve({ok:false}),
    getTomorrowEvents(),
    getSoonReminders(),
  ])
  const tomorrow=new Date(); tomorrow.setDate(tomorrow.getDate()+1)
  const data={ weather, events, reminders, dateStr:fmtDate(tomorrow) }
  const image=await buildImage(data)
  const caption=`Tomorrow · ${events.length} event${events.length!==1?"s":""}${weather.ok?` · H ${weather.high}°`:""}`
  const sent=await sendPhoto(image,caption)
  if(!sent){ const n=new Notification(); n.title="Evening Summary"; n.body="Telegram send failed"; await n.schedule() }
  Script.complete()
}

main().finally(()=>Script.complete())
