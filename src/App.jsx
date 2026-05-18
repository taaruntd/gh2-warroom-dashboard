import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── BRAND ────────────────────────────────────────────────────────────────────
const B = {
  olive:   "#A6C83D",
  blue:    "#3E5BA6",
  green:   "#1AAE48",
  red:     "#C8102E",
  amber:   "#E8910A",
  oliveL:  "#f0f5d6",
  blueL:   "#eef1f9",
  greenL:  "#e8f8ed",
  redL:    "#fef2f2",
  amberL:  "#fff8e6",
  bg:      "#f7f9f2",
  white:   "#ffffff",
  text:    "#1a2310",
  muted:   "#5a6b4a",
  border:  "#e2ebd0",
  navy:    "#0f1f3d",
};

const STATUS_STYLE = {
  "Open":        { bg: B.blueL,  color: B.blue,  dot: B.blue  },
  "In Progress": { bg: B.amberL, color: "#7a4a00", dot: B.amber },
  "Done":        { bg: B.greenL, color: "#0d7a32", dot: B.green },
  "Blocked":     { bg: B.redL,   color: B.red,   dot: B.red   },
};

const PRI_BORDER = {
  "Critical": B.red,
  "Push":     B.amber,
  "Normal":   "transparent",
};

const CAT_COLOR = {
  "Project Updates": "#1a2f54", "SCM": "#3d3000",
  "SCM Payments": "#5c2800",   "Cash Flow": "#1a4a2e",
  "IPO": "#7a0a1e",            "Outstanding": "#6b0000",
  "Solar BD": "#004a8f",       "H2 BD": "#3d0070",
  "Factory": "#004040",        "Finance": "#1a3d5c",
  "O&M": "#2d4a00",            "HR": "#0a4a5c",
  "IT": "#2c2c6e",             "Legal": "#4a3000",
  "Compliance": "#3d001a",
};
const CAT_LIGHT = {
  "Project Updates": "#E8EDF5", "SCM": "#F5F0DC",
  "SCM Payments": "#F5E8DC",   "Cash Flow": "#E0EDDE",
  "IPO": "#F5DCE0",            "Outstanding": "#F5DCDC",
  "Solar BD": "#DCE8F5",       "H2 BD": "#EBE0F5",
  "Factory": "#DCF0F0",        "Finance": "#DCE8F5",
  "O&M": "#E8F0DC",            "HR": "#DCE8EF",
  "IT": "#DCDCF5",             "Legal": "#F5EEDC",
  "Compliance": "#F0DCE8",
};

const CATS = [
  "Project Updates","SCM","SCM Payments","Cash Flow","IPO",
  "Outstanding","Solar BD","H2 BD","Factory","Finance",
  "O&M","HR","IT","Legal","Compliance",
];

const DATA_URL = "https://raw.githubusercontent.com/taaruntd/gh2-warroom-data/main/data/tracker.json";
const REFRESH_MS = 30 * 60 * 1000;

// ── PDF ──────────────────────────────────────────────────────────────────────
async function downloadPDF(data, filters) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
  const PW = 190;
  const NAVY = [15,31,61], MID = [62,91,166], RED = [200,16,46], AMBER = [232,145,10];

  const rows = data.filter(r =>
    (!filters.cat    || r.category === filters.cat) &&
    (!filters.owner  || r.owner === filters.owner) &&
    (!filters.status || r.status === filters.status) &&
    (!filters.pri    || r.priority === filters.pri)
  );
  const grouped = {};
  rows.forEach(r => { if (!grouped[r.category]) grouped[r.category]=[]; grouped[r.category].push(r); });

  doc.setFillColor(...NAVY);
  doc.rect(10,10,PW,12,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(255,255,255);
  doc.text("GH2 SOLAR — Task MOM", 105, 18, { align:"center" });
  doc.setFillColor(240,245,214);
  doc.rect(10,22,PW,7,"F");
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(90,107,74);
  const filterDesc = [
    filters.cat && `Category: ${filters.cat}`,
    filters.owner && `Owner: ${filters.owner}`,
    filters.status && `Status: ${filters.status}`,
    filters.pri && `Priority: ${filters.pri}`,
  ].filter(Boolean).join("  |  ") || "All tasks";
  doc.text(`Date: ${today}   |   Filters: ${filterDesc}   |   Total: ${rows.length} tasks`, 105, 27, { align:"center" });

  let y = 32;
  Object.keys(grouped).forEach(cat => {
    const catRows = grouped[cat];
    if (y > 260) { doc.addPage(); y = 15; }
    doc.setFillColor(...NAVY); doc.rect(10,y,PW,8,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(255,255,255);
    doc.text(cat.toUpperCase(), 14, y+5.5);
    doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.text(`${catRows.length} item${catRows.length>1?"s":""}`, 196, y+5.5, { align:"right" });
    y += 9;
    const tableRows = catRows.map(r => {
      const remarkLines = (r.remarks||"").split("\n").filter(Boolean);
      // Sort by date prefix so latest is always last
      const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
      const parseEntryDate = (line) => {
        const p = line.match(/(\d{1,2})[\-\/](\w{3})/);
        return p ? (months[p[2]]||0)*100 + parseInt(p[1]) : 0;
      };
      const sorted = [...remarkLines].sort((a,b) => parseEntryDate(a) - parseEntryDate(b));
      // Show last 3 sorted entries in PDF
      const remarkStr = sorted.slice(-3).join("\n");
      const flagIcon = r.priority==="Critical"?"! ":r.priority==="Push"?"> ":"";
      return [flagIcon+(r.task||""), r.owner||"—", remarkStr||"—", fmtDate(r.dueDate)];
    });
    autoTable(doc, {
      startY: y,
      head: [["SITE / ITEM","OWNER","WHAT TO ASK / PUSH POINT","DUE DATE"]],
      body: tableRows, theme:"grid",
      margin:{ left:10, right:10 }, tableWidth: PW,
      columnStyles: {
        0:{ cellWidth:38, fontStyle:"bold", fontSize:8 },
        1:{ cellWidth:24, fontSize:8, textColor:[90,106,130] },
        2:{ cellWidth:100, fontSize:8 },
        3:{ cellWidth:28, fontSize:8, fontStyle:"bold", halign:"center" },
      },
      headStyles:{ fillColor:MID, textColor:[255,255,255], fontSize:8, fontStyle:"bold", cellPadding:3 },
      bodyStyles:{ cellPadding:{top:3,bottom:3,left:4,right:4}, lineColor:[200,208,222], lineWidth:0.2, valign:"top" },
      alternateRowStyles:{ fillColor:[248,250,253] },
      didParseCell(d) {
        if (d.section==="body") {
          const row = catRows[d.row.index]; if (!row) return;
          if (d.column.index===0 && row.priority==="Critical") d.cell.styles.textColor=RED;
          if (d.column.index===0 && row.priority==="Push") d.cell.styles.textColor=AMBER;
          if (d.column.index===3 && row.dueDate) {
            const dd = parseDate(row.dueDate);
            if (dd) {
              const diff=(dd-new Date())/86400000;
              if (diff<0) d.cell.styles.textColor=RED;
              else if (diff<=3) d.cell.styles.textColor=AMBER;
            }
          }
        }
      },
      didDrawPage(h) { y=h.cursor.y; },
    });
    y = doc.lastAutoTable.finalY + 5;
  });
  const pc = doc.getNumberOfPages();
  for (let i=1;i<=pc;i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(170,170,170);
    doc.text(`GH2 Solar Limited  ·  Task MOM  ·  ${today}  ·  Prepared by Taarun Dhingra  ·  Page ${i} of ${pc}`, 105, 292, { align:"center" });
  }
  doc.save(`GH2_Tracker_MOM_${today.replace(/ /g,"-")}.pdf`);
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function excelSerialToDate(serial) {
  // Excel serial: days since 1 Jan 1900 (with leap year bug)
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return d;
}
function parseDate(due) {
  if (!due || due === "—" || due === "-" || due === "") return null;
  // Excel serial number (e.g. 46159)
  const num = Number(due);
  if (!isNaN(num) && num > 40000 && num < 60000) return excelSerialToDate(num);
  const m={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  // Format 1: 11-May-26 or 11-May-2026
  const p1 = due.match(/^(\d{1,2})[\-\/](\w{3})[\-\/](\d{2,4})$/);
  if (p1) {
    const yr = p1[3].length===2 ? 2000+parseInt(p1[3]) : parseInt(p1[3]);
    return new Date(yr, m[p1[2]], parseInt(p1[1]));
  }
  // Format 2: ISO 2026-05-11 or 2026-05-11T00:00:00Z
  const p2 = due.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (p2) return new Date(parseInt(p2[1]), parseInt(p2[2])-1, parseInt(p2[3]));
  // Format 3: 11/05/2026 or 11/05/26
  const p3 = due.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})$/);
  if (p3) {
    const yr = p3[3].length===2 ? 2000+parseInt(p3[3]) : parseInt(p3[3]);
    return new Date(yr, parseInt(p3[2])-1, parseInt(p3[1]));
  }
  const d = new Date(due);
  return isNaN(d) ? null : d;
}
// Convert any date value to display string DD-Mon-YY
function fmtDate(due) {
  if (!due || due === "—" || due === "-" || due === "") return "—";
  const d = parseDate(due);
  if (!d) return String(due);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return String(d.getDate()).padStart(2,"0") + "-" + months[d.getMonth()] + "-" + String(d.getFullYear()).slice(2);
}
function dueClass(due) {
  const d = parseDate(due);
  if (!d) return null;
  const diff = (d - new Date()) / 86400000;
  return diff < 0 ? "overdue" : diff <= 3 ? "soon" : null;
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status]||STATUS_STYLE["Open"];
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 10, padding: "3px 9px", borderRadius: 20,
      fontWeight: 600, display:"inline-flex", alignItems:"center", gap: 5,
    }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot, display:"inline-block" }}></span>
      {status}
    </span>
  );
}

function CatTag({ cat }) {
  return (
    <span style={{
      background: CAT_LIGHT[cat]||"#eee", color: CAT_COLOR[cat]||"#333",
      fontSize: 10, padding: "2px 7px", borderRadius: 4,
      fontWeight: 600, display:"inline-block", whiteSpace:"nowrap",
    }}>{cat}</span>
  );
}

function RemarkLog({ raw, expanded }) {
  const entries = (raw||"").split("\n").filter(Boolean).map(line => {
    const c = line.indexOf(":");
    return c===-1 ? {date:"",text:line} : {date:line.slice(0,c).trim(), text:line.slice(c+1).trim()};
  });
  if (!entries.length) return <span style={{color:"#aaa",fontSize:11}}>—</span>;
  // Sort entries by date — oldest first, newest last
  const sortedEntries = [...entries].sort((a, b) => {
    const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    const parseEntryDate = (d) => {
      const p = d.match(/(\d{1,2})[\-\/](\w{3})/);
      return p ? (months[p[2]]||0)*100 + parseInt(p[1]) : 0;
    };
    return parseEntryDate(a.date) - parseEntryDate(b.date);
  });
  const show = expanded ? sortedEntries : sortedEntries.slice(-1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
      {show.map((e,i) => (
        <div key={i} style={{
          display:"flex", gap:6, padding:"3px 7px", borderRadius:3,
          background: i===show.length-1 ? B.oliveL : "#f4f6fa",
          borderLeft: i===show.length-1 ? `2px solid ${B.olive}` : "2px solid #ddd",
        }}>
          <span style={{ fontSize:10, fontWeight:700, color:B.olive, whiteSpace:"nowrap", minWidth:46 }}>{e.date}</span>
          <span style={{ fontSize:11, color:"#444", lineHeight:1.4 }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}

function KPICard({ label, value, color, icon, sub }) {
  return (
    <div style={{
      background: B.white, borderRadius: 10, padding: "16px 20px",
      borderTop: `3px solid ${color}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:11, color:B.muted, marginBottom:6, fontWeight:500 }}>{label}</div>
          <div style={{ fontSize:30, fontWeight:700, color, lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:10, color:B.muted, marginTop:4 }}>{sub}</div>}
        </div>
        <span style={{ fontSize:20 }}>{icon}</span>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fCat, setFCat]       = useState("");
  const [fOwner, setFOwner]   = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPri, setFPri]       = useState("");
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState(1);
  const [expanded, setExpanded] = useState({});
  const intervalRef = useRef(null);

  async function fetchData() {
    try {
      const res = await fetch(DATA_URL+"?t="+Date.now());
      if (!res.ok) throw new Error("HTTP "+res.status);
      const json = await res.json();
      // handle both key formats (camelCase from PA or direct)
      const cleaned = json.map(r => ({
        category:    r.category    || r["Category"]          || "",
        task:        r.task        || r["Task / Site"]        || "",
        owner:       r.owner       || r["Owner"]              || "",
        nextMeeting: r.nextMeeting || r["Next Meeting"]       || "—",
        dueDate:     r.dueDate     || r["Due Date"]           || "—",
        status:      r.status      || r["Status"]             || "Open",
        priority:    r.priority    || r["Priority"]           || "Normal",
        remarks:     r.remarks     || r["Full Remarks Log"]   || "",
        lastUpdated: r.lastUpdated || r["Last Updated"]       || "",
      }));
      setData(cleaned);
      console.log('DEBUG dueDate sample:', cleaned[0]?.dueDate);
      console.log('DEBUG lastUpdated sample:', cleaned[0]?.lastUpdated);
      const dates = cleaned.map(r => r.lastUpdated).filter(Boolean);
      if (dates.length) setLastUpdated(dates[0]);
      setError(null);
    } catch(e) {
      setError("Could not load live data — showing cached view");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  const activeData = data.filter(r => r.status !== "Done");
  const owners     = [...new Set(activeData.map(r=>r.owner))].sort();
  const statuses   = [...new Set(activeData.map(r=>r.status))].sort();

  const filtered = activeData.filter(r =>
    (!fCat    || r.category===fCat) &&
    (!fOwner  || r.owner===fOwner) &&
    (!fStatus || r.status===fStatus) &&
    (!fPri    || r.priority===fPri) &&
    (!search  || r.task?.toLowerCase().includes(search.toLowerCase()) ||
                 r.owner?.toLowerCase().includes(search.toLowerCase()))
  ).sort((a,b) => !sortKey ? 0 : ((a[sortKey]||"").localeCompare(b[sortKey]||""))*sortDir);

  const total    = activeData.length;
  const openC    = activeData.filter(r=>r.status==="Open").length;
  const overdueC = activeData.filter(r=>dueClass(r.dueDate)==="overdue").length;
  const doneTotal= data.filter(r=>r.status==="Done").length;
  const criticalC= activeData.filter(r=>r.priority==="Critical").length;

  const statusData = Object.entries(
    activeData.reduce((acc,r)=>{ acc[r.status]=(acc[r.status]||0)+1; return acc; },{})
  ).map(([name,value])=>({name,value}));

  const catData = Object.entries(
    activeData.reduce((acc,r)=>{ acc[r.category]=(acc[r.category]||0)+1; return acc; },{})
  ).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));

  function toggleSort(k) {
    if (sortKey===k) setSortDir(d=>d*-1); else { setSortKey(k); setSortDir(1); }
  }
  function toggleExpand(i) { setExpanded(p=>({...p,[i]:!p[i]})); }

  const selStyle = {
    fontSize:12, padding:"7px 12px", borderRadius:6,
    border:`1px solid ${B.border}`, background:B.white,
    color:B.text, height:34, outline:"none",
  };

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:B.bg, gap:12 }}>
      <div style={{ width:36, height:36, border:`3px solid ${B.olive}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}></div>
      <div style={{ color:B.muted, fontSize:13 }}>Loading tracker data...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily:"Arial, sans-serif", background:B.bg, minHeight:"100vh", padding:16 }}>
      <div style={{ maxWidth:1440, margin:"0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{
          background:B.navy, borderRadius:12, padding:"16px 24px",
          marginBottom:16, display:"flex", alignItems:"center",
          justifyContent:"space-between", flexWrap:"wrap", gap:10,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{
              background:B.olive, borderRadius:8, width:44, height:44,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:700, fontSize:12, color:B.navy, lineHeight:1.1, textAlign:"center",
            }}>GH2<br/>SOLAR</div>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:B.white, letterSpacing:"-0.3px" }}>
                Task Tracker
              </div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", marginTop:2 }}>
                {lastUpdated
  ? (() => {
      const d = new Date(lastUpdated);
      return isNaN(d)
        ? `Updated: ${lastUpdated} · Auto-refreshes every 30 min`
        : `${d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} · Auto-refreshes every 30 min`;
    })()
  : 'Auto-refreshes every 30 min'}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={fetchData} style={{
              fontSize:12, padding:"7px 14px", borderRadius:6,
              border:`1px solid rgba(255,255,255,0.2)`, background:"rgba(255,255,255,0.1)",
              color:B.white, cursor:"pointer", fontWeight:500,
            }}>↻ Refresh</button>
            <button
              onClick={()=>downloadPDF(data,{cat:fCat,owner:fOwner,status:fStatus,pri:fPri})}
              style={{
                fontSize:12, padding:"7px 16px", borderRadius:6,
                border:"none", background:B.olive,
                color:B.navy, cursor:"pointer", fontWeight:700,
              }}>⬇ Download MOM PDF</button>
          </div>
        </div>

        {error && (
          <div style={{ background:B.amberL, border:`1px solid ${B.amber}`, borderRadius:8, padding:"8px 14px", fontSize:12, color:"#7a4a00", marginBottom:12 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── KPIs ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
          <KPICard label="Total Active" value={total}    color={B.blue}  icon="📋" sub="tasks in tracker" />
          <KPICard label="Open"         value={openC}    color={B.olive} icon="🔵" sub="not started" />
          <KPICard label="Critical"     value={criticalC} color={B.red}  icon="🔴" sub="needs action today" />
          <KPICard label="Overdue"      value={overdueC} color={B.red}   icon="⚠️" sub="past due date" />

        </div>

        {/* ── CHARTS ── */}
        <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:12, marginBottom:14 }}>

          {/* Donut */}
          <div style={{ background:B.white, borderRadius:10, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize:12, fontWeight:600, color:B.navy, marginBottom:10 }}>Tasks by Status</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusData} cx="40%" cy="50%" innerRadius={50} outerRadius={75}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {statusData.map((e,i)=>(
                    <Cell key={i} fill={({Open:B.blue,"In Progress":B.amber,Done:B.green,Blocked:B.red})[e.name]||"#888"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v,n)=>[v,n]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar */}
          <div style={{ background:B.white, borderRadius:10, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize:12, fontWeight:600, color:B.navy, marginBottom:10 }}>Pending by Category</div>
            <ResponsiveContainer width="100%" height={Math.max(160, catData.length*26+30)}>
              <BarChart data={catData} layout="vertical" margin={{left:0,right:24,top:0,bottom:0}}>
                <XAxis type="number" tick={{fontSize:10}} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={115} axisLine={false} tickLine={false} />
                <Tooltip formatter={v=>[v,"pending"]} cursor={{fill:"rgba(166,200,61,0.08)"}} />
                <Bar dataKey="value" radius={[0,4,4,0]} maxBarSize={18}>
                  {catData.map((e,i)=><Cell key={i} fill={CAT_COLOR[e.name]||B.blue} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── FILTERS ── */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search task or owner..."
            style={{...selStyle, width:200}} />
          <select value={fCat}    onChange={e=>setFCat(e.target.value)}    style={selStyle}>
            <option value="">All categories</option>
            {CATS.map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={fOwner}  onChange={e=>setFOwner(e.target.value)}  style={selStyle}>
            <option value="">All owners</option>
            {owners.map(o=><option key={o}>{o}</option>)}
          </select>
          <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={selStyle}>
            <option value="">All statuses</option>
            {statuses.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={fPri}    onChange={e=>setFPri(e.target.value)}    style={selStyle}>
            <option value="">All priorities</option>
            <option>Critical</option><option>Push</option><option>Normal</option>
          </select>
          <span style={{ marginLeft:"auto", fontSize:11, color:B.muted, fontWeight:500 }}>
            {filtered.length} of {total} tasks
          </span>
        </div>

        {/* ── TABLE ── */}
        <div style={{
          background:B.white, borderRadius:10, overflow:"auto",
          boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
          border:`1px solid ${B.border}`,
        }}>
          <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed", minWidth:900 }}>
            <colgroup>
              <col style={{width:108}}/><col style={{width:155}}/><col style={{width:100}}/>
              <col style={{width:86}}/><col style={{width:88}}/><col style={{width:110}}/><col/>
            </colgroup>
            <thead>
              <tr style={{ borderBottom:`2px solid ${B.olive}` }}>
                {[["category","Category"],["task","Task / Site"],["owner","Owner"],
                  ["nextMeeting","Next Mtg"],["dueDate","Due Date"],["status","Status"],
                  ["remarks","Remarks"]].map(([k,label])=>(
                  <th key={k} onClick={()=>toggleSort(k)} style={{
                    fontSize:11, fontWeight:600, color:B.navy,
                    background:B.oliveL, padding:"9px 10px",
                    textAlign:"left", cursor:"pointer", userSelect:"none",
                    whiteSpace:"nowrap",
                  }}>
                    {label}
                    <span style={{opacity:0.4,marginLeft:3,fontSize:10}}>
                      {sortKey===k?(sortDir===1?"↑":"↓"):"↕"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={7} style={{padding:"3rem",textAlign:"center",color:B.muted,fontSize:13}}>
                  No tasks match the selected filters.
                </td></tr>
              ) : filtered.map((row,i)=>{
                const dc = dueClass(row.dueDate);
                const isExp = expanded[i];
                const rowBg = row.priority==="Critical" ? "#fffafa" :
                              row.priority==="Push"     ? "#fffdf5" : B.white;
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${B.border}`, background:rowBg }}
                    onMouseEnter={e=>e.currentTarget.style.background=B.oliveL+"88"}
                    onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                    <td style={{ padding:"9px 10px", borderLeft:`3px solid ${PRI_BORDER[row.priority]||"transparent"}` }}>
                      <CatTag cat={row.category} />
                    </td>
                    <td style={{ padding:"9px 10px", fontWeight:600, fontSize:12, color:B.navy }}>{row.task}</td>
                    <td style={{ padding:"9px 10px", fontSize:11, color:B.muted }}>{row.owner}</td>
                    <td style={{ padding:"9px 10px", fontSize:11, color:B.muted }}>{fmtDate(row.nextMeeting)}</td>
                    <td style={{ padding:"9px 10px", fontSize:11, fontWeight:dc?600:400,
                      color:dc==="overdue"?B.red:dc==="soon"?B.amber:B.muted }}>
                      {fmtDate(row.dueDate)}
                      {dc==="overdue"&&<span style={{marginLeft:4,fontSize:10}}>⚠</span>}
                    </td>
                    <td style={{ padding:"9px 10px" }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding:"9px 10px" }} onClick={()=>toggleExpand(i)}>
                      <RemarkLog raw={row.remarks} expanded={isExp} />
                      {(row.remarks||"").split("\n").filter(Boolean).length > 1 && (
                        <span style={{ fontSize:10, color:B.blue, cursor:"pointer", marginTop:3, display:"inline-block" }}>
                          {isExp ? "▲ less" : `+${(row.remarks||"").split("\n").filter(Boolean).length-1} more ▾`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop:12, fontSize:11, color:B.muted, textAlign:"center" }}>
          GH2 Solar Limited  ·  Task Tracker  ·
        </div>
      </div>
    </div>
  );
}
