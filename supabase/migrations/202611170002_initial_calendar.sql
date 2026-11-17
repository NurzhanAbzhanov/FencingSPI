begin;
-- Initial calendar source supplied by the user; retained byte-for-byte.
insert into public.calendar_versions(id,filename,html) values('c2000000-0000-4000-8000-000000000001','index--2-.html',$initial_calendar_20261117$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>2026–27 College Fencing Composite Calendar (Nov–Feb)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#fff; --card:#fff; --ink:#1d1d1f; --muted:#6b6b70; --line:#e4e3df;
  --inv:#2f6fdb; --dual:#7a52c7; --conf:#d2691e; --champ:#c0392b; --nat:#0f8a5f;
  --done:#9a9a9f;
}
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.45}
header{padding:28px 24px 8px;max-width:1240px;margin:0 auto}
h1{font-size:24px;margin:0 0 4px;letter-spacing:-.01em}
.sub{color:var(--muted);margin:0 0 14px}
.wrap{max-width:1240px;margin:0 auto;padding:0 24px 48px}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 18px}
.controls input,.controls select{font:inherit;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
.controls input{min-width:240px}
.tabs{display:flex;gap:4px;margin-left:auto}
.tabs button{font:inherit;padding:7px 12px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;cursor:pointer}
.tabs button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.legend{display:flex;flex-wrap:wrap;gap:14px;color:var(--muted);font-size:12.5px;margin-bottom:14px}
.legend span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px;background:var(--c)}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:120px}
.stat b{font-size:20px;display:block}
.stat small{color:var(--muted)}
.month{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:22px;overflow:hidden}
.month h2{margin:0;padding:12px 16px;font-size:16px;border-bottom:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(7,1fr)}
.dow{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line)}
.day{min-height:96px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:4px 5px;position:relative}
.day:nth-child(7n){border-right:none}
.day .n{font-size:11.5px;color:var(--muted);font-weight:600}
.day.out{background:repeating-linear-gradient(45deg,transparent 0 6px,rgba(127,127,127,.05) 6px 12px)}
.day.today .n{background:var(--ink);color:var(--bg);border-radius:10px;padding:0 6px}
.chip{display:block;font-size:11.5px;line-height:1.25;padding:3px 5px;margin-top:3px;border-radius:5px;background:color-mix(in srgb,var(--c) 14%,transparent);border-left:3px solid var(--c);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip.past{opacity:.55}
.chip.flag::after{content:" ⚠"}
.list .row{display:grid;grid-template-columns:130px 1fr 200px;gap:14px;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--c);border-radius:10px;padding:12px 14px;margin-bottom:8px}
.row .d{font-weight:600}
.row .d small{display:block;color:var(--muted);font-weight:400}
.row .t{font-weight:600}
.row .loc{color:var(--muted)}
.row .teams{margin-top:4px;font-size:12.5px}
.row .note{margin-top:6px;font-size:12.5px;color:var(--champ)}
.row .meta{font-size:12px;color:var(--muted);text-align:right}
.badge{display:inline-block;font-size:11px;padding:1px 7px;border-radius:20px;border:1px solid var(--line);margin-left:4px;color:var(--muted)}
.notes{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin-top:10px}
.notes h3{margin:0 0 8px;font-size:15px}
.notes li{margin-bottom:5px}
dialog{border:1px solid var(--line);border-radius:12px;max-width:560px;width:92%;background:var(--card);color:var(--ink);padding:20px}
dialog::backdrop{background:rgba(0,0,0,.35)}
dialog h3{margin:0 0 6px}
dialog button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;margin-top:12px}
@media (max-width:760px){
  .day{min-height:64px}.chip{font-size:10px}
  .list .row{grid-template-columns:1fr}.row .meta{text-align:left}
  .tabs{margin-left:0}
}
</style>
</head>
<body>
<header>
  <h1>2026–27 College Fencing Composite Calendar</h1>
  <p class="sub">College meets from November 2026 through February 2027 for all 46 programs on the USFCA SPI list (men and women). Taken from each school's athletics schedule page and checked against the SPI results database. NACs, Junior Olympics and alumni events are left out. Last checked Nov 14, 2026.</p>
</header>
<div class="wrap">
  <div class="stats" id="stats"></div>
  <div class="controls">
    <input id="q" type="search" placeholder="Filter by school, meet or city…">
    <select id="type">
      <option value="">All meet types</option>
      <option value="inv">Invitationals / multi-team</option>
      <option value="dual">Duals / tri-meets</option>
      <option value="conf">Conference meets</option>
      <option value="champ">Conference championships</option>
      <option value="nat">National (D-III)</option>
    </select>
    <select id="gender">
      <option value="">Men &amp; women</option>
      <option value="M">Includes men</option>
      <option value="W">Includes women</option>
    </select>
    <label style="color:var(--muted);font-size:13px"><input type="checkbox" id="hidePast"> Hide completed</label>
    <div class="tabs"><button id="tCal" class="on">Calendar</button><button id="tList">List</button></div>
  </div>
  <div class="legend">
    <span style="--c:var(--inv)">Invitational / multi-team</span>
    <span style="--c:var(--dual)">Dual / tri-meet</span>
    <span style="--c:var(--conf)">Conference meet</span>
    <span style="--c:var(--champ)">Conference championship</span>
    <span style="--c:var(--nat)">National championship</span>
    <span>⚠ = schools' sites disagree</span>
  </div>
  <div id="cal"></div>
  <div id="list" class="list" hidden></div>

  <div class="notes">
    <h3>Notes on coverage and conflicts</h3>
    <ul>
      <li><b>Not posted yet:</b> St. John's and LIU still show their 2025-26 schedules. Their meets here come from other schools' schedules (for example, the St. John's Super Cup on Jan 16).</li>
      <li><b>Elite Invitational (Nov 14–15):</b> Notre Dame's site lists it as "Canceled due to all competing team travel difficulties," but Penn, UNC, Columbia and others show results. It looks like Notre Dame alone withdrew.</li>
      <li><b>D-III Championships at Drew:</b> NYU and Haverford list Sat Feb 13. Drew, Brandeis, Denison, Vassar, Wellesley, Tufts and JHU list Sun Feb 14. Lawrence lists Feb 27–28 and CCNY lists Poughkeepsie, which are probably mistakes.</li>
      <li><b>ECFC Championships:</b> Wagner, JHU, NJIT, Stevens and Haverford list Sat Feb 27. Drew, the host, lists Sun Feb 28.</li>
      <li><b>NEIFC Championships (Feb 28):</b> Wheaton (host), MIT and Brandeis list Norton, MA. Vassar lists Northampton, MA.</li>
      <li><b>NIWFA Championships:</b> Tufts lists Feb 28 in Madison, NJ. Lafayette, Temple and CCNY list Mar 6 at Lafayette, which is outside this window.</li>
      <li><b>Columbia midweek meets:</b> JHU lists a Columbia Invitational on Thu Jan 14, and Sacred Heart lists an "NYC Duel at Columbia" on Wed Feb 17. Neither is on Columbia's own schedule, which shows only the Kolombatovich meet on Feb 24.</li>
      <li><b>FDU Invitational (W):</b> Lafayette lists Jan 24 and CCNY lists Feb 14.</li>
      <li><b>Penn State Invitational:</b> Haverford lists Sun Jan 24. Every other school lists Sat Jan 23.</li>
      <li>Yeshiva's site shows the Vassar Invitational on Nov 11 and the Sollee on Dec 31. These are clearly typos for Nov 22 and Jan 31.</li>
      <li>Some schools list a meet under a different name. Brandeis Invitational = Carla-Mae Richards Invitational. Haverford Invitational = Black Squirrels Invitational. Stevens Invitational = Linda Volkmer-Lynch Invitational. Penn State's "Duke Invitational" = the Beguinet Classic and Miller Invitational weekend. Northwestern Invitational/Duals = Schiller Duals.</li>
      <li>Team lists show which SPI programs list each meet on their own schedule. Non-SPI schools such as Navy and Smith aren't counted. For schools with separate men's and women's pages, the men's page was used unless the women's schedule was different.</li>
    </ul>
  </div>
</div>

<dialog id="dlg"><div id="dlgBody"></div><button onclick="document.getElementById('dlg').close()">Close</button></dialog>

<script>
const TODAY = "2026-11-14";
// [start, end, name, host, location, type, gender, teams, note]
const E = [
 ["2026-11-01","2026-11-01","NJIT Invitational","NJIT","Newark, NJ — Bloom Wellness & Events Center","inv","MW","NJIT, Drew, Hunter",""],
 ["2026-11-01","2026-11-01","NYU Invitational","NYU","New York, NY — John A. Paulson Center","inv","MW","NYU, Yale, St. John's, LIU, Wagner",""],
 ["2026-11-07","2026-11-07","Duke vs. North Carolina","Duke","Durham, NC","dual","MW","Duke, UNC",""],
 ["2026-11-07","2026-11-08","Western Invitational","UC San Diego","La Jolla, CA — Main Gym","inv","MW","UC San Diego, Stanford, Air Force, Ohio State, Northwestern (W), Incarnate Word, Brandeis",""],
 ["2026-11-07","2026-11-08","Drew Invitational (Ranger Invite)","Drew","Madison, NJ — Simon Forum","inv","MW","Drew, NJIT, Stevens, Johns Hopkins, Lawrence, Wayne State, Detroit Mercy, Cleveland State, Denison, Wheaton, Vassar, Haverford, Wagner, NYU, Wellesley (W)",""],
 ["2026-11-08","2026-11-08","Columbia Invitational","Columbia","New York, NY — Dodge Fitness Center","inv","MW","Columbia, LIU, Hunter, NJIT",""],
 ["2026-11-14","2026-11-15","Elite Invitational","Penn","Philadelphia, PA — Ott Center","inv","MW","Penn, Columbia, Harvard, Yale, Princeton, Cornell (W), Temple (W), Duke, UNC, Ohio State, Penn State, Johns Hopkins, Cleveland State, Denison","Notre Dame withdrew (travel), per its site."],
 ["2026-11-15","2026-11-15","Northeast Fencing Conference Meet #1","Brown","Providence, RI — OMAC","conf","MW","Brown (W), Boston College, Brandeis, Sacred Heart, Vassar, MIT (W), Tufts (W), Wellesley (W)",""],
 ["2026-11-15","2026-11-15","MACFA North","Hunter","New York, NY — Hunter Sportsplex","conf","MW","Hunter, Lafayette, Yeshiva",""],
 ["2026-11-18","2026-11-18","Beanpot","MIT","Cambridge, MA — Johnson Athletic Center","inv","MW","MIT, Harvard, Boston College, Brandeis",""],
 ["2026-11-22","2026-11-22","Vassar Invitational","Vassar","Poughkeepsie, NY — Walker Field House","inv","MW","Vassar, Yeshiva, Drew, NJIT, Haverford, Lafayette, LIU, Wagner, Stevens, Sacred Heart, Hunter, Yale, FDU (W), Tufts (W), Wellesley (W), CCNY (W)",""],
 ["2026-12-04","2026-12-04","Hunter College Homecoming","Hunter","New York, NY","dual","W","Hunter, CCNY (W)",""],
 ["2026-12-05","2026-12-05","Denison Open","Denison","Granville, OH — Alumni Memorial Fieldhouse","inv","MW","Denison, Cleveland State",""],
 ["2026-12-06","2026-12-06","Carla-Mae Richards Invitational (Brandeis Invitational)","Brandeis","Waltham, MA","inv","MW","Brandeis, Boston College, MIT, Penn State, Drew, Haverford, Lawrence, Wheaton, Brown (W), Cornell (W), Tufts (W), Wellesley (W)",""],
 ["2026-12-06","2026-12-06","Sacred Heart Tradition Meet","Sacred Heart","Fairfield, CT — Pitt Center","inv","MW","Sacred Heart, Princeton, Yale, NJIT, NYU, Vassar, LIU, Temple (W)",""],
 ["2026-12-06","2026-12-06","Seahawk Challenge","Wagner","Staten Island, NY — Curtis HS Gym","inv","MW","Wagner, Hunter, Yeshiva",""],
 ["2027-01-13","2027-01-13","Wellesley at UC San Diego","UC San Diego","La Jolla, CA — Main Gym","dual","W","UC San Diego (W), Wellesley",""],
 ["2027-01-13","2027-01-13","Princeton Invitational (tri-meet)","Princeton","Princeton, NJ — Stan Sieja Fencing Room","dual","MW","Princeton, NJIT, Wagner",""],
 ["2027-01-14","2027-01-14","Columbia Invitational (midweek)","Columbia","New York, NY","inv","M","Johns Hopkins","Listed by JHU only; not on Columbia's schedule."],
 ["2027-01-15","2027-01-15","Philadelphia Invitational (Temple)","Temple","Philadelphia, PA — TU Pavilion","inv","MW","Temple (W), Brown (W), Lafayette",""],
 ["2027-01-16","2027-01-16","St. John's Super Cup","St. John's","Queens, NY — Carnesecca Arena / Taffner Field House","inv","MW","St. John's, Ohio State, Notre Dame, Harvard, Columbia, Princeton","St. John's 2026-27 schedule not posted; taken from other schools' schedules."],
 ["2027-01-16","2027-01-17","Dave Micahnik Penn Invitational","Penn","Philadelphia, PA — Tse Center","inv","MW","Penn, UC San Diego, Ohio State, Notre Dame, Duke, Penn State, Yale, NYU, NJIT, Wagner, Sacred Heart, Lafayette, Haverford, Cornell (W), Brown (W), FDU (W), Temple (W)",""],
 ["2027-01-17","2027-01-17","Johns Hopkins Invitational","Johns Hopkins","Baltimore, MD — Goldfarb Gym","inv","MW","Johns Hopkins, UNC, Cleveland State, Drew, Denison, Haverford, Hunter",""],
 ["2027-01-17","2027-01-17","Tufts Invitational","Tufts","Medford, MA","inv","W","Tufts, Northwestern, Cornell, Brown, Wellesley",""],
 ["2027-01-19","2027-01-19","Cornell at Princeton","Princeton","Princeton, NJ — Stan Sieja Fencing Room","dual","W","Princeton (W), Cornell",""],
 ["2027-01-23","2027-01-23","Penn State Invitational","Penn State","University Park, PA — Mary B. White Center","inv","MW","Penn State, Penn, Princeton, Columbia, UNC, Johns Hopkins, Wagner, Haverford, Northwestern (W), Cornell (W), Temple (W)","Haverford lists Sun Jan 24."],
 ["2027-01-23","2027-01-24","Michael DeCicco Duals","Notre Dame","Notre Dame, IN — Castellan Family Fencing Facility","inv","MW","Notre Dame",""],
 ["2027-01-23","2027-01-23","Northeast Fencing Conference Meet #2","Wellesley","Wellesley, MA — Dorothy Towne Fieldhouse","conf","MW","Wellesley, Boston College, Brandeis, MIT, Sacred Heart, Vassar, Wheaton, Brown (W), Tufts (W)",""],
 ["2027-01-23","2027-01-23","Navy Invitational","Navy","Annapolis, MD","inv","MW","Lafayette",""],
 ["2027-01-24","2027-01-24","Syd Fadner Invitational","Boston College","Chestnut Hill, MA — Margot Connell Rec Center","inv","MW","Boston College, Wheaton",""],
 ["2027-01-24","2027-01-24","FDU Invitational","FDU","Teaneck, NJ","inv","W","FDU, Lafayette (W)","CCNY lists an FDU Invitational on Feb 14."],
 ["2027-01-30","2027-01-30","MACFA South","Navy","Annapolis, MD","conf","MW","Lafayette",""],
 ["2027-01-30","2027-01-30","NYU at Harvard","Harvard","Cambridge, MA","dual","MW","Harvard, NYU",""],
 ["2027-01-30","2027-01-31","Laurence Schiller Duals","Northwestern","Evanston, IL — Ryan Fieldhouse / Patten Gym","inv","MW","Northwestern (W), Stanford, UC San Diego, Air Force, Incarnate Word, Ohio State, Notre Dame, Cleveland State, Detroit Mercy, Wayne State, Denison, Lawrence, Vassar, Wheaton, FDU (W), Temple (W), Tufts (W)",""],
 ["2027-01-31","2027-01-31","Eric Sollee Invitational","MIT","Cambridge, MA — Johnson Athletic Center","inv","MW","MIT, Boston College, Brandeis, NYU, Hunter, NJIT, Yeshiva, Stevens","NJIT lists Waltham; MIT (host) and others list Cambridge."],
 ["2027-01-31","2027-01-31","Brian Palestis Memorial Invitational","Wagner","Staten Island, NY — Spiro Sports Center","inv","MW","Wagner, Penn State, Penn",""],
 ["2027-02-06","2027-02-06","Alex & Elizabeth Beguinet Classic","Duke","Durham, NC — Wilson Recreation Center","inv","MW","Duke, UNC, Notre Dame, Boston College, Penn State, Brandeis, Air Force (W), Temple (W), MIT (W)",""],
 ["2027-02-06","2027-02-06","Black Squirrels Invitational (Haverford Invitational)","Haverford","Haverford, PA — Alumni Field House","inv","MW","Haverford, Drew, Lafayette",""],
 ["2027-02-06","2027-02-06","Danosi Open","Wayne State","Detroit, MI — Matthaei Center","inv","MW","Wayne State, Detroit Mercy",""],
 ["2027-02-06","2027-02-06","Lawrence Home Meet","Lawrence","Appleton, WI","inv","M","Lawrence",""],
 ["2027-02-06","2027-02-07","Ivy League Championships","Yale","New Haven, CT","champ","MW","Yale, Harvard, Princeton, Penn, Columbia, Cornell (W), Brown (W)",""],
 ["2027-02-07","2027-02-07","Ron Miller Invitational","North Carolina","Chapel Hill, NC — Eddie Smith Fieldhouse","inv","MW","UNC, Duke, Notre Dame, Boston College, Penn State, Johns Hopkins, Air Force (M), MIT (M)",""],
 ["2027-02-07","2027-02-07","Stevens Invitational (Linda Volkmer-Lynch)","Stevens","Hoboken, NJ — Canavan Arena","inv","MW","Stevens, NJIT, Yeshiva",""],
 ["2027-02-07","2027-02-07","Matt Lampell Invitational","Vassar","Poughkeepsie, NY — Walker Field House","inv","MW","Vassar, CCNY (W)",""],
 ["2027-02-13","2027-02-14","USFCA Division III National Championships","Drew","Madison, NJ — Simon Forum","nat","MW","Drew, Johns Hopkins, Stevens, Brandeis, NYU, Haverford, Denison, Vassar, Wellesley, Tufts, CCNY (W)","Day conflict: NYU & Haverford list Sat Feb 13; most others Sun Feb 14."],
 ["2027-02-17","2027-02-17","NYC Duel at Columbia","Columbia","New York, NY","dual","MW","Sacred Heart","Listed by Sacred Heart only; Columbia lists its NYC meet on Feb 24."],
 ["2027-02-20","2027-02-21","ACC Championships","Stanford","Stanford, CA — Maples Pavilion","champ","MW","Stanford, Duke, UNC, Notre Dame, Boston College",""],
 ["2027-02-20","2027-02-21","CCFC Championships","Cleveland State","Cleveland, OH — Woodling Gym / Wolstein Center","champ","MW","Cleveland State, Ohio State, Northwestern (W), Detroit Mercy, Wayne State, Denison, Lawrence",""],
 ["2027-02-21","2027-02-21","Temple Invitational","Temple","Philadelphia, PA — McGonigle Hall","inv","MW","Temple (W), Penn State, Penn, Princeton, Johns Hopkins, Stevens",""],
 ["2027-02-21","2027-02-21","EWFC Championships","Drew","Madison, NJ","champ","W","CCNY","Tufts lists EWFC alongside D-III on Feb 14."],
 ["2027-02-24","2027-02-24","George Kolombatovich Historical Meet","Columbia","New York, NY","inv","MW","Columbia, NYU, Vassar, Sacred Heart",""],
 ["2027-02-27","2027-02-27","East Coast Fencing Conference (ECFC) Championships","Drew","Madison, NJ — Simon Forum","champ","MW","Drew, Wagner, Johns Hopkins, NJIT, Stevens, Haverford","Drew (host) lists Sun Feb 28."],
 ["2027-02-28","2027-02-28","NEIFC Championships (New England Intercollegiate)","Wheaton (MA)","Norton, MA — Beard Field House","champ","MW","Wheaton, MIT, Brandeis, Sacred Heart, Vassar","Vassar lists Northampton, MA."],
 ["2027-02-28","2027-02-28","LIU Invitational","LIU","Brooklyn, NY","inv","MW","Lafayette","LIU 2026-27 schedule not posted."],
 ["2027-02-28","2027-02-28","NIWFA Championships","—","Madison, NJ (per Tufts)","champ","W","Tufts","Lafayette, Temple & CCNY list NIWFA on Mar 6 at Lafayette (Easton, PA)."]
];
const C = {inv:"var(--inv)",dual:"var(--dual)",conf:"var(--conf)",champ:"var(--champ)",nat:"var(--nat)"};
const TYPE = {inv:"Invitational",dual:"Dual / tri",conf:"Conference meet",champ:"Conf. championship",nat:"National"};
const ev = E.map((r,i)=>({id:i,s:r[0],e:r[1],name:r[2],host:r[3],loc:r[4],type:r[5],g:r[6],teams:r[7],note:r[8]}));
const fmt = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
const wd = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
const range = x => x.s===x.e ? `${wd(x.s)} ${fmt(x.s)}` : `${wd(x.s)} ${fmt(x.s)} – ${wd(x.e)} ${fmt(x.e)}`;
const gtxt = g => g==="MW"?"Men & Women":g==="M"?"Men":"Women";

function filtered(){
  const q=document.getElementById('q').value.trim().toLowerCase();
  const t=document.getElementById('type').value, g=document.getElementById('gender').value;
  const hp=document.getElementById('hidePast').checked;
  return ev.filter(x=>(!q||(x.name+" "+x.host+" "+x.loc+" "+x.teams).toLowerCase().includes(q))
    &&(!t||x.type===t)&&(!g||x.g.includes(g))&&(!hp||x.e>=TODAY));
}
function stats(list){
  const schools=new Set();list.forEach(x=>x.teams.split(",").forEach(t=>schools.add(t.replace(/\(.*\)/,"").trim())));
  const up=list.filter(x=>x.e>=TODAY).length;
  document.getElementById('stats').innerHTML=
   `<div class="stat"><b>${list.length}</b><small>college meets</small></div>
    <div class="stat"><b>${up}</b><small>upcoming (from Nov 14)</small></div>
    <div class="stat"><b>${list.filter(x=>x.type==='champ'||x.type==='nat').length}</b><small>championships</small></div>
    <div class="stat"><b>${list.filter(x=>x.note).length}</b><small>flagged conflicts</small></div>`;
}
function renderCal(list){
  const months=[[2026,10],[2026,11],[2027,0],[2027,1]];
  let h="";
  for(const [y,m] of months){
    const first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(), pad=first.getDay();
    h+=`<section class="month"><h2>${first.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</h2><div class="grid">`;
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d=>h+=`<div class="dow">${d}</div>`);
    for(let i=0;i<pad;i++) h+=`<div class="day out"></div>`;
    for(let d=1;d<=days;d++){
      const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const items=list.filter(x=>x.s<=iso&&x.e>=iso);
      h+=`<div class="day${iso===TODAY?' today':''}"><span class="n">${d}</span>`;
      items.forEach(x=>h+=`<span class="chip${x.e<TODAY?' past':''}${x.note?' flag':''}" style="--c:${C[x.type]}" data-id="${x.id}" title="${x.name} — ${x.host}">${x.name}</span>`);
      h+=`</div>`;
    }
    const tail=(7-((pad+days)%7))%7; for(let i=0;i<tail;i++) h+=`<div class="day out"></div>`;
    h+=`</div></section>`;
  }
  document.getElementById('cal').innerHTML=h;
}
function renderList(list){
  let h="", cur="";
  list.slice().sort((a,b)=>a.s.localeCompare(b.s)||a.name.localeCompare(b.name)).forEach(x=>{
    const mo=new Date(x.s+"T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"});
    if(mo!==cur){cur=mo;h+=`<h2 style="font-size:16px;margin:18px 0 8px">${mo}</h2>`;}
    h+=`<div class="row" style="--c:${C[x.type]}${x.e<TODAY?';opacity:.65':''}">
      <div class="d">${range(x)}${x.e<TODAY?'<small>Completed</small>':''}</div>
      <div><div class="t">${x.name}</div><div class="loc">Host: ${x.host} · ${x.loc}</div>
      <div class="teams"><b>SPI teams listing it:</b> ${x.teams}</div>${x.note?`<div class="note">⚠ ${x.note}</div>`:''}</div>
      <div class="meta">${TYPE[x.type]}<br>${gtxt(x.g)}</div></div>`;
  });
  document.getElementById('list').innerHTML=h||'<p>No meets match.</p>';
}
function render(){const l=filtered();stats(l);renderCal(l);renderList(l);}
function show(id){
  const x=ev[id];
  document.getElementById('dlgBody').innerHTML=`<h3>${x.name}</h3><p style="margin:0;color:var(--muted)">${range(x)} · ${TYPE[x.type]} · ${gtxt(x.g)}</p>
   <p><b>Host:</b> ${x.host}<br><b>Location:</b> ${x.loc}</p><p><b>SPI teams listing it:</b> ${x.teams}</p>${x.note?`<p style="color:var(--champ)">⚠ ${x.note}</p>`:''}`;
  document.getElementById('dlg').showModal();
}
document.addEventListener('click',e=>{const c=e.target.closest('.chip');if(c)show(+c.dataset.id);});
['q','type','gender','hidePast'].forEach(id=>document.getElementById(id).addEventListener('input',render));
const tC=document.getElementById('tCal'),tL=document.getElementById('tList');
function view(v){document.getElementById('cal').hidden=v!=='cal';document.getElementById('list').hidden=v!=='list';tC.classList.toggle('on',v==='cal');tL.classList.toggle('on',v==='list');}
tC.onclick=()=>view('cal');tL.onclick=()=>view('list');
render();
</script>
</body>
</html>
$initial_calendar_20261117$) on conflict(id) do nothing;
insert into public.calendar_publication(singleton,version_id) values(true,'c2000000-0000-4000-8000-000000000001') on conflict(singleton) do nothing;
commit;
