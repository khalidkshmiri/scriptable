// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: chart-line;
// ─────────────────────────────────────────
//  WEEKLY REVIEW — visual recap card + Telegram
//  Reads gym-log.json, barber-log.json, study-log.json (this week).
//  Trigger via Shortcuts on Sundays ~21:00. Reuses morning-summary creds.
// ─────────────────────────────────────────

const CFG = { token: "", chatId: "" }

function docPath(name){ const fm=FileManager.iCloud(); return fm.joinPath(fm.documentsDirectory(),name) }
async function loadJson(name,fb){
  try{ const fm=FileManager.iCloud(); const p=docPath(name); if(!fm.fileExists(p))return fb; await fm.downloadFileFromiCloud(p); return JSON.parse(fm.readString(p)) }
  catch{ return fb }
}
async function loadConfig(){
  const m=await loadJson("Config/morning-summary-config.json",null)
  if(m){ CFG.token=m.token; CFG.chatId=m.chatId }
  const w=await loadJson("Config/weekly-review-config.json",null)
  if(w){ if(w.token)CFG.token=w.token; if(w.chatId)CFG.chatId=w.chatId }
  if(!CFG.token||!CFG.chatId) throw new Error("Telegram token/chatId not found")
}

// ─── DESIGN ───────────────────────────────────────────
const W=390, PAD=18, CORNER=12, TOP_INSET=28
const C={
  bg:new Color("#15110C"), glow:new Color("#33220F"), card:new Color("#1C1710"),
  accent:new Color("#E2B262"), accentD:new Color("#C9924A"), text:new Color("#F0E9DA"),
  sub:new Color("#8A8070"), time:new Color("#B7AC92"), hair:new Color("#2E2619"),
  good:new Color("#8FBF7F"), warn:new Color("#D6995A"),
}
const F={
  mast:new Font("HoeflerText-Black",26), date:new Font("HoeflerText-Italic",11.5),
  kick:new Font("Menlo-Bold",9.5), sec:new Font("Menlo-Bold",9),
  main:new Font("AvenirNext-Medium",14.5), sub:new Font("AvenirNext-Regular",11.5),
  big:new Font("HoeflerText-Black",20), lbl:new Font("AvenirNext-Medium",12.5),
}
function trk(s){ return s.split("").join(" ") }
function cap(s,n){ return s.length>n?s.slice(0,n-1)+"…":s }
function clamp01(v){ return Math.max(0,Math.min(1,v)) }
function lerp(a,b,t){ return a+(b-a)*t }
function chx(v){ return Math.round(clamp01(v)*255).toString(16).padStart(2,"0") }
function lerpColor(a,b,t){ return new Color("#"+chx(lerp(a.red,b.red,t))+chx(lerp(a.green,b.green,t))+chx(lerp(a.blue,b.blue,t))) }
function rrect(dc,x,y,w,h,c){ dc.setFillColor(c); const p=new Path(); p.addRoundedRect(new Rect(x,y,w,h),CORNER,CORNER); dc.addPath(p); dc.fillPath() }
function fillR(dc,x,y,w,h,c){ dc.setFillColor(c); dc.fillRect(new Rect(x,y,w,h)) }
function vGrad(dc,x,y,w,h,a,b){ for(let i=0;i<h;i+=2){ dc.setFillColor(lerpColor(a,b,i/h)); dc.fillRect(new Rect(x,y+i,w,3)) } }
function txt(dc,t,x,y,f,c){ dc.setFont(f); dc.setTextColor(c); dc.setTextAlignedLeft(); dc.drawText(String(t),new Point(x,y)) }
function txtR(dc,t,x,y,w,h,f,c){ dc.setFont(f); dc.setTextColor(c); dc.setTextAlignedRight(); dc.drawTextInRect(String(t),new Rect(x,y,w,h)) }

// ─── DATA / DERIVE ────────────────────────────────────
function startOfWeek(){
  const d=new Date(); d.setHours(0,0,0,0)
  const dow=(d.getDay()+6)%7  // Monday=0
  d.setDate(d.getDate()-dow); return d
}
function thisWeek(entries){
  const wk=startOfWeek().getTime()
  return (Array.isArray(entries)?entries:[]).filter(e=>new Date(`${e.date}T00:00:00`).getTime()>=wk)
}
function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }
function gymStreak(entries){
  const keys=new Set((Array.isArray(entries)?entries:[]).map(e=>String(e.date||"").slice(0,10)))
  if(!keys.size)return 0
  const cur=new Date(); cur.setHours(0,0,0,0)
  if(!keys.has(isoDate(cur))) cur.setDate(cur.getDate()-1)
  let n=0; while(keys.has(isoDate(cur))){ n++; cur.setDate(cur.getDate()-1) }
  return n
}
function euro(n){ return "€"+(Math.round(n*100)/100).toString().replace(/\.00$/,"") }
function fmtDur(min){ const h=Math.floor(min/60),m=min%60; return h?`${h}u ${m}m`:`${m}m` }

// ─── RENDER ───────────────────────────────────────────
function buildImage(data){
  const { gym, barber, study, subjects } = data
  const studyRows = subjects.length ? subjects : Object.keys(study.perSubject)
  const headerH=TOP_INSET+96, sg=12, bp=26
  const gymH=15+23+19+19+15
  const barbH=15+23+19+15
  const studyH=15+23+(studyRows.length?studyRows.length*22:24)+15
  const total=headerH+sg+gymH+sg+barbH+sg+studyH+bp

  const H=Math.max(total,640)
  const dc=new DrawContext()
  dc.size=new Size(W,H); dc.opaque=true; dc.respectScreenScale=true
  dc.setFillColor(C.bg); dc.fillRect(new Rect(0,0,W,H))
  const innerW=W-PAD*2-30

  let y=0
  vGrad(dc,0,y,W,headerH,C.glow,C.bg)
  const ty=y+TOP_INSET
  txt(dc,`${trk("WEEK IN REVIEW")}   ·   ${data.range}`,PAD,ty+8,F.kick,C.accentD)
  txt(dc,"Weekly Review",PAD,ty+24,F.mast,C.text)
  txt(dc,"What got done this week",PAD,ty+58,F.date,C.sub)
  fillR(dc,PAD,ty+74,54,2,C.accent)
  y+=headerH+sg

  // Gym
  rrect(dc,PAD,y,W-PAD*2,gymH,C.card)
  { const cx=PAD+15; let cy=y+15
    txt(dc,trk("GYM"),cx,cy,F.sec,C.accent); cy+=23
    txt(dc,`${gym.count} workout${gym.count!==1?"s":""}   ·   streak ${gym.streak} day${gym.streak!==1?"s":""}`,cx,cy,F.main,C.text); cy+=19
    const top=gym.muscles.length? gym.muscles.slice(0,4).map(([m,n])=>`${m} ${n}×`).join("   ") : "No sessions logged"
    txt(dc,cap(top,46),cx,cy,F.sub,C.sub)
  }
  y+=gymH+sg

  // Barber
  rrect(dc,PAD,y,W-PAD*2,barbH,C.card)
  { const cx=PAD+15; let cy=y+15
    txt(dc,trk("BARBER"),cx,cy,F.sec,C.accent); cy+=23
    txt(dc,`${barber.cuts} cut${barber.cuts!==1?"s":""}`,cx,cy,F.main,C.text)
    txtR(dc,euro(barber.total),PAD+15,cy-2,innerW,20,F.big,C.accent)
  }
  y+=barbH+sg

  // Study
  rrect(dc,PAD,y,W-PAD*2,studyH,C.card)
  { const cx=PAD+15; let cy=y+15
    txt(dc,trk("STUDY"),cx,cy,F.sec,C.accent); cy+=23
    if(!studyRows.length){ txt(dc,"No study sessions logged",cx,cy,F.date,C.sub) }
    else for(const s of studyRows){
      const mins=study.perSubject[s]||0
      const none=mins===0
      fillR(dc,cx+2,cy+7,4,4,none?C.warn:C.good)
      txt(dc,s,cx+14,cy+3,F.lbl,none?C.warn:C.text)
      txtR(dc,none?"— none":fmtDur(mins),PAD+15,cy+3,innerW,18,F.sub,none?C.warn:C.time)
      cy+=22
    }
  }
  return dc.getImage()
}

async function sendPhoto(image,caption){
  const req=new Request(`https://api.telegram.org/bot${CFG.token}/sendPhoto`)
  req.method="POST"
  req.addParameterToMultipart("chat_id",String(CFG.chatId))
  req.addParameterToMultipart("caption",caption)
  req.addImageToMultipart(image,"photo","weekly.jpg")
  try{ const r=await req.loadJSON(); return !!r.ok }catch{ return false }
}

// ─── MAIN ─────────────────────────────────────────────
async function main(){
  await loadConfig()
  const [gymLog,barberLog,studyLog,studyCfg]=await Promise.all([
    loadJson("gym-log.json",[]), loadJson("barber-log.json",[]),
    loadJson("study-log.json",[]), loadJson("Config/study-config.json",null),
  ])

  const gymWk=thisWeek(gymLog)
  const muscleFreq={}
  for(const e of gymWk) for(const m of (e.muscles||[])) muscleFreq[m]=(muscleFreq[m]||0)+1
  const gym={ count:gymWk.length, streak:gymStreak(gymLog),
              muscles:Object.entries(muscleFreq).sort((a,b)=>b[1]-a[1]) }

  const barbWk=thisWeek(barberLog)
  const barber={ cuts:barbWk.length, total:barbWk.reduce((s,e)=>s+(Number(e.amount)||0),0) }

  const studyWk=thisWeek(studyLog)
  const perSubject={}
  for(const e of studyWk) perSubject[e.subject]=(perSubject[e.subject]||0)+(Number(e.durationMin)||0)
  const subjects=(studyCfg && Array.isArray(studyCfg.subjects)) ? studyCfg.subjects.map(s=>s.name) : []
  const study={ perSubject }

  const wkStart=startOfWeek(), wkEnd=new Date(wkStart.getTime()+6*86400000)
  const mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const range=`${wkStart.getDate()} ${mo[wkStart.getMonth()]} – ${wkEnd.getDate()} ${mo[wkEnd.getMonth()]}`

  const image=buildImage({ gym, barber, study, subjects, range })
  const caption=`Weekly review · ${gym.count} gym · ${barber.cuts} cuts · ${euro(barber.total)}`
  const sent=await sendPhoto(image,caption)
  if(!sent){ const n=new Notification(); n.title="Weekly Review"; n.body="Telegram send failed"; await n.schedule() }
  Script.complete()
}

main().finally(()=>Script.complete())
