import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

// ── PDF Export ──────────────────────────────────────────────────────────────
async function downloadPDF(data, filters) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("https://esm.sh/jspdf@2.5.1"),
    import("https://esm.sh/jspdf-autotable@3.8.2"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
  const PW = 190;
  const NAVY = [15, 31, 61];
  const MID  = [46, 117, 182];
  const RED  = [200, 16, 46];
  const AMBER= [232, 145, 10];

  // Filter data same as dashboard
  const rows = data.filter(r =>
    (!filters.cat    || r.category === filters.cat) &&
    (!filters.owner  || r.owner === filters.owner) &&
    (!filters.status || r.status === filters.status) &&
    (!filters.pri    || r.priority === filters.pri)
  );

  // Group by category
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  // ── Header ──
  doc.setFillColor(...NAVY);
  doc.rect(10, 10, PW, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("GH2 SOLAR — WAR ROOM WEEKLY MOM", 105, 18, { align: "center" });

  doc.setFillColor(230, 235, 245);
  doc.rect(10, 22, PW, 7, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 106, 130);
  const filterDesc = [
    filters.cat    && `Category: ${filters.cat}`,
    filters.owner  && `Owner: ${filters.owner}`,
    filters.status && `Status: ${filters.status}`,
    filters.pri    && `Priority: ${filters.pri}`,
  ].filter(Boolean).join("  |  ") || "All tasks";
  doc.text(`Date: ${today}   |   Filters: ${filterDesc}   |   Total: ${rows.length} tasks`, 105, 27, { align: "center" });

  let y = 32;

  // ── Categories ──
  const cats = Object.keys(grouped);
  cats.forEach((cat, ci) => {
    const catRows = grouped[cat];
    if (y > 260) { doc.addPage(); y = 15; }

    // Category header bar
    doc.setFillColor(...NAVY);
    doc.rect(10, y, PW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(cat.toUpperCase(), 14, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${catRows.length} item${catRows.length > 1 ? "s" : ""}`, 196, y + 5.5, { align: "right" });
    y += 9;

    // Table
    const tableRows = catRows.map(r => {
      // Build date-wise remarks — last 3 entries
      const remarkLines = (r.remarks || "").split("\n").filter(Boolean);
      const remarkStr = remarkLines.slice(-3).join("\n");
      const flagIcon = r.priority === "Critical" ? "! " : r.priority === "Push" ? "> " : "";
      return [
        flagIcon + (r.task || ""),
        r.owner || "—",
        remarkStr || "—",
        r.dueDate || "—",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["SITE / ITEM", "OWNER", "WHAT TO ASK / PUSH POINT", "DUE DATE"]],
      body: tableRows,
      theme: "grid",
      margin: { left: 10, right: 10 },
      tableWidth: PW,
      columnStyles: {
        0: { cellWidth: 38, fontStyle: "bold", fontSize: 8 },
        1: { cellWidth: 24, fontSize: 8, textColor: [90,106,130] },
        2: { cellWidth: 100, fontSize: 8 },
        3: { cellWidth: 28, fontSize: 8, fontStyle: "bold", halign: "center" },
      },
      headStyles: {
        fillColor: MID,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        cellPadding: 3,
      },
      bodyStyles: {
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        lineColor: [200, 208, 222],
        lineWidth: 0.2,
        valign: "top",
      },
      alternateRowStyles: { fillColor: [248, 250, 253] },
      didParseCell(data) {
        if (data.section === "body") {
          const row = catRows[data.row.index];
          if (!row) return;
          // Red left border for critical
          if (row.priority === "Critical") {
            data.cell.styles.textColor = [0,0,0];
          }
          // Due date color
          if (data.column.index === 3 && row.dueDate) {
            const m={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
            const p = row.dueDate.split("-");
            if (p.length >= 3) {
              const d = new Date(parseInt("20"+p[2]), m[p[1]], parseInt(p[0]));
              const diff = (d - new Date()) / 86400000;
              if (diff < 0) data.cell.styles.textColor = RED;
              else if (diff <= 3) data.cell.styles.textColor = AMBER;
            }
          }
          // Site/item col — red text for critical
          if (data.column.index === 0 && row.priority === "Critical") {
            data.cell.styles.textColor = RED;
          }
          if (data.column.index === 0 && row.priority === "Push") {
            data.cell.styles.textColor = [180, 100, 0];
          }
        }
      },
      didDrawPage(hookData) { y = hookData.cursor.y; },
    });

    y = doc.lastAutoTable.finalY + 5;
  });

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(170, 170, 170);
    doc.text(
      `GH2 Solar Limited  ·  War Room MOM  ·  ${today}  ·  Prepared by Taarun Dhingra, Strategy & Operations  ·  Page ${i} of ${pageCount}`,
      105, 292, { align: "center" }
    );
  }

  const fname = `GH2_WarRoom_MOM_${today.replace(/ /g,"-")}.pdf`;
  doc.save(fname);
}

// ── CONFIG — change this to your actual GitHub raw URL ──
const DATA_URL = "https://raw.githubusercontent.com/taaruntd/gh2-warroom-data/main/data/tracker.json";
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

const CATS = [
  "Project Updates","SCM","SCM Payments","Cash Flow","IPO",
  "Outstanding","Solar BD","H2 BD","Factory","Finance",
  "O&M","HR","IT","Legal","Compliance"
];

const CAT_COLOR = {
  "Project Updates":"#1a2f54","SCM":"#3d3000","SCM Payments":"#5c2800",
  "Cash Flow":"#1a4a2e","IPO":"#7a0a1e","Outstanding":"#6b0000",
  "Solar BD":"#004a8f","H2 BD":"#3d0070","Factory":"#004040",
  "Finance":"#1a3d5c","O&M":"#2d4a00","HR":"#0a4a5c",
  "IT":"#2c2c6e","Legal":"#4a3000","Compliance":"#3d001a"
};
const CAT_LIGHT = {
  "Project Updates":"#E8EDF5","SCM":"#F5F0DC","SCM Payments":"#F5E8DC",
  "Cash Flow":"#E0EDDE","IPO":"#F5DCE0","Outstanding":"#F5DCDC",
  "Solar BD":"#DCE8F5","H2 BD":"#EBE0F5","Factory":"#DCF0F0",
  "Finance":"#DCE8F5","O&M":"#E8F0DC","HR":"#DCE8EF",
  "IT":"#DCDCF5","Legal":"#F5EEDC","Compliance":"#F0DCE8"
};
const STATUS_COLOR = { "Open":"#3E5BA6","In Progress":"#BA7517","Done":"#1a7a3c","Blocked":"#C8102E" };
const STATUS_BADGE = {
  "Open":"#E6F1FB:#0C447C","In Progress":"#FFF3DC:#7a4a00",
  "Done":"#EAF3DE:#27500A","Blocked":"#FCEBEB:#791F1F"
};
const PRI_BORDER = { "Critical":"#C8102E","Push":"#E8910A","Normal":"transparent" };

function badge(status) {
  const [bg, col] = (STATUS_BADGE[status] || "#eee:#333").split(":");
  return (
    <span style={{
      background: bg, color: col, fontSize: 10, padding: "2px 8px",
      borderRadius: 20, fontWeight: 600, whiteSpace: "nowrap", display:"inline-block"
    }}>{status}</span>
  );
}

function catTag(cat) {
  return (
    <span style={{
      background: CAT_LIGHT[cat] || "#eee", color: CAT_COLOR[cat] || "#333",
      fontSize: 10, padding: "2px 7px", borderRadius: 3, fontWeight: 600,
      display: "inline-block", whiteSpace: "nowrap", lineHeight: 1.6
    }}>{cat}</span>
  );
}

function dueClass(due) {
  if (!due || due === "—") return null;
  const m = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const p = due.split("-");
  if (p.length < 3) return null;
  const d = new Date(parseInt("20"+p[2]), m[p[1]], parseInt(p[0]));
  const today = new Date();
  const diff = (d - today) / 86400000;
  return diff < 0 ? "overdue" : diff <= 3 ? "soon" : null;
}

function RemarkLog({ raw }) {
  const entries = (raw || "").split("\n").filter(Boolean).map(line => {
    const colon = line.indexOf(":");
    if (colon === -1) return { date: "", text: line };
    return { date: line.slice(0, colon).trim(), text: line.slice(colon + 1).trim() };
  });
  if (!entries.length) return <span style={{ color: "#999", fontSize: 11 }}>—</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {entries.map((e, i) => (
        <div key={i} style={{
          display: "flex", gap: 6, padding: "3px 7px", borderRadius: 3,
          background: i === entries.length - 1 ? "#eef6f0" : "#f7f9f2",
          borderLeft: i === entries.length - 1 ? "2px solid #A6C83D" : "2px solid #c8d0de"
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#A6C83D", fontWeight:700, whiteSpace: "nowrap", minWidth: 50, paddingTop: 1 }}>{e.date}</span>
          <span style={{ fontSize: 11, color: "#444", lineHeight: 1.4 }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}

function KPI({ label, value, color }) {
  return (
    <div style={{
      background: "#fff", borderTop: "3px solid #A6C83D", borderLeft:"0.5px solid #c8d0de", borderRight:"0.5px solid #c8d0de", borderBottom:"0.5px solid #c8d0de", borderRadius: 8,
      padding: "12px 16px", minWidth: 0
    }}>
      <div style={{ fontSize: 11, color: "#5a6a82", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: color || "#3E5BA6" }}>{value}</div>
    </div>
  );
}

export default function App() {
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [fCat, setFCat]         = useState("");
  const [fOwner, setFOwner]     = useState("");
  const [fStatus, setFStatus]   = useState("");
  const [fPri, setFPri]         = useState("");
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState("");
  const [sortDir, setSortDir]   = useState(1);
  const [expanded, setExpanded] = useState({});
  const intervalRef = useRef(null);

  async function fetchData() {
    try {
      const res = await fetch(DATA_URL + "?t=" + Date.now());
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      setData(json);
      setLastSync(new Date());
      setError(null);
    } catch (e) {
      setError("Could not load live data. Showing last known data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Derived — Done items never shown in dashboard ──
  const activeData = data.filter(r => r.status !== "Done");
  const owners   = [...new Set(activeData.map(r => r.owner))].sort();
  const statuses = [...new Set(activeData.map(r => r.status))].sort();

  const filtered = activeData.filter(r =>
    (!fCat    || r.category === fCat) && 
    (!fOwner  || r.owner === fOwner) && 
    (!fStatus || r.status === fStatus) && 
    (!fPri    || r.priority === fPri) && 
    (!search  || r.task?.toLowerCase().includes(search.toLowerCase()) ||
                 r.owner?.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    if (!sortKey) return 0;
    return ((a[sortKey] || "").localeCompare(b[sortKey] || "")) * sortDir;
  });

  const total    = activeData.length;
  const openC    = activeData.filter(r => r.status === "Open").length;
  const overdueC = activeData.filter(r => dueClass(r.dueDate) === "overdue").length;
  const doneTotal = data.filter(r => r.status === "Done").length;

  const statusData = Object.entries(
    activeData.reduce((acc, r) => { acc[r.status] = (acc[r.status]||0)+1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const pendingCat = activeData.reduce((acc, r) => {
  }, {});
  const catData = Object.entries(pendingCat).sort((a,b) => b[1]-a[1]).map(([name, value]) => ({ name, value }));

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(1); }
  }

  function toggleExpand(i) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const sel = { fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #c8d0de", background: "#fff", color: "#1a1a2e", height: 32 };
  const th = { fontSize: 11, fontWeight: 600, color: "#3E5BA6", background: "#edf3e8", padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #A6C83D", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", fontFamily:"Arial", color:"#5a6a82" }}>
      Loading tracker data...
    </div>
  );

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f7f9f2", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom: 14, flexWrap:"wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#3E5BA6", letterSpacing:"-0.3px" }}>GH2 Solar — War Room Tracker</div>
            <div style={{ fontSize: 11, color: "#5a6a82", marginTop: 2 }}>
              {lastSync ? `Last synced: ${lastSync.toLocaleTimeString()} · Auto-refreshes every 5 min` : "Syncing..."}
            </div>
          </div>
          <div style={{ display:"flex", gap: 8 }}>
            <button onClick={fetchData} style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "0.5px solid #c8d0de", background: "#fff", cursor: "pointer", color: "#3E5BA6", fontWeight:500 }}>
              ↻ Refresh
            </button>
            <button
              onClick={() => downloadPDF(data, { cat: fCat, owner: fOwner, status: fStatus, pri: fPri })}
              style={{ fontSize: 12, padding: "5px 16px", borderRadius: 6, border: "none", background: "#A6C83D", color: "#fff", cursor: "pointer", fontWeight: 600, display:"flex", alignItems:"center", gap: 6 }}>
              ⬇ Download MOM PDF
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#FFF3DC", border: "0.5px solid #E8910A", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#7a4a00", marginBottom: 12 }}>
            ⚠ {error}
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          <KPI label="Total tasks" value={total} color="#3E5BA6" />
          <KPI label="Open" value={openC} color="#A6C83D" />
          <KPI label="Overdue" value={overdueC} color="#C8102E" />
          <KPI label="Completed (total)" value={doneTotal} color="#1AAE48" />
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ background: "#fff", border: "0.5px solid #c8d0de", borderTop:"2px solid #3E5BA6", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#3E5BA6", fontWeight:600, marginBottom: 10 }}>Tasks by status</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  dataKey="value" nameKey="name">
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLOR[entry.name] || "#888"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {statusData.map((s, i) => (
                <span key={i} style={{ display:"flex", alignItems:"center", gap: 4, fontSize: 11, color: "#5a6a82" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: STATUS_COLOR[s.name]||"#888", flexShrink: 0 }}></span>
                  {s.name} ({s.value})
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "0.5px solid #c8d0de", borderTop:"2px solid #3E5BA6", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#3E5BA6", fontWeight:600, marginBottom: 10 }}>Pending by category</div>
            <ResponsiveContainer width="100%" height={Math.max(180, catData.length * 26 + 40)}>
              <BarChart data={catData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip formatter={(v) => [v, "pending"]} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {catData.map((entry, i) => (
                    <Cell key={i} fill={CAT_COLOR[entry.name] || "#555"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search task or owner..."
            style={{ ...sel, width: 200, borderRadius: 6 }} />
          <select value={fCat} onChange={e => setFCat(e.target.value)} style={sel}>
            <option value="">All categories</option>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={fOwner} onChange={e => setFOwner(e.target.value)} style={sel}>
            <option value="">All owners</option>
            {owners.map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={sel}>
            <option value="">All statuses</option>
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={fPri} onChange={e => setFPri(e.target.value)} style={sel}>
            <option value="">All priorities</option>
            <option>Critical</option><option>Push</option><option>Normal</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#5a6a82" }}>{filtered.length} tasks</span>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #A6C83D", borderRadius: 10, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 900 }}>
            <colgroup>
              <col style={{ width: 105 }} /><col style={{ width: 160 }} /><col style={{ width: 100 }} />
              <col style={{ width: 88 }} /><col style={{ width: 88 }} /><col style={{ width: 105 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                {[["category","Category"],["task","Task / Site"],["owner","Owner"],
                  ["nextMeeting","Next mtg"],["dueDate","Due date"],["status","Status"],
                  ["remarks","Remarks"]].map(([key, label]) => (
                  <th key={key} style={th} onClick={() => toggleSort(key)}>
                    {label} <span style={{ opacity: 0.4 }}>{sortKey===key ? (sortDir===1?"↑":"↓") : "↕"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#5a6a82", fontSize: 13 }}>No tasks match filters.</td></tr>
              ) : filtered.map((row, i) => {
                const dc = dueClass(row.dueDate);
                const flagColor = PRI_BORDER[row.priority] || "transparent";
                const isExpanded = expanded[i];
                return (
                  <tr key={i} style={{ borderBottom: "0.5px solid #eef1f7" }}
                    onMouseEnter={e => e.currentTarget.style.background="#f8fafd"}
                    onMouseLeave={e => e.currentTarget.style.background=""}>
                    <td style={{ padding: "8px 10px", borderLeft: `3px solid ${flagColor}` }}>
                      {catTag(row.category)}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, fontSize: 12 }}>{row.task}</td>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: "#5a6a82" }}>{row.owner}</td>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: "#5a6a82" }}>{row.nextMeeting}</td>
                    <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: dc ? 600 : 400,
                      color: dc === "overdue" ? "#C8102E" : dc === "soon" ? "#9a6000" : "#5a6a82" }}>
                      {row.dueDate || "—"}
                      {dc === "overdue" && <span style={{ marginLeft: 4, fontSize: 10 }}>⚠</span>}
                    </td>
                    <td style={{ padding: "8px 10px" }}>{badge(row.status)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ cursor: "pointer" }} onClick={() => toggleExpand(i)}>
                        {isExpanded
                          ? <RemarkLog raw={row.remarks} />
                          : <div style={{ display:"flex", alignItems:"center", gap: 6 }}>
                              <span style={{ fontSize: 11, color: "#444" }}>
                                {(row.remarks || "").split("\n").filter(Boolean).slice(-1)[0] || "—"}
                              </span>
                              {(row.remarks || "").split("\n").filter(Boolean).length > 1 &&
                                <span style={{ fontSize: 10, color: "#3E5BA6", cursor:"pointer", whiteSpace:"nowrap" }}>
                                  +{(row.remarks||"").split("\n").filter(Boolean).length - 1} more ▾
                                </span>
                              }
                            </div>
                        }
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: "#aaa", textAlign: "center" }}>
          GH2 Solar Limited  ·  War Room Tracker  ·  Data source: SharePoint via Power Automate → GitHub  ·  Proprietary & Confidential
        </div>
      </div>
    </div>
  );
}
