import { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── PDF Export ──────────────────────────────────────────────────────────────
async function downloadPDF(data, filters) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const PW = 190;
  const NAVY = [15, 31, 61];
  const MID = [46, 117, 182];
  const RED = [200, 16, 46];
  const AMBER = [232, 145, 10];

  const rows = data.filter(
    (r) =>
      (!filters.cat || r.category === filters.cat) &&
      (!filters.owner || r.owner === filters.owner) &&
      (!filters.status || r.status === filters.status) &&
      (!filters.pri || r.priority === filters.pri)
  );

  const grouped = {};

  rows.forEach((r) => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  doc.setFillColor(...NAVY);
  doc.rect(10, 10, PW, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);

  doc.text("GH2 SOLAR — WAR ROOM WEEKLY MOM", 105, 18, {
    align: "center",
  });

  doc.setFillColor(230, 235, 245);
  doc.rect(10, 22, PW, 7, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 106, 130);

  const filterDesc =
    [
      filters.cat && `Category: ${filters.cat}`,
      filters.owner && `Owner: ${filters.owner}`,
      filters.status && `Status: ${filters.status}`,
      filters.pri && `Priority: ${filters.pri}`,
    ]
      .filter(Boolean)
      .join("  |  ") || "All tasks";

  doc.text(
    `Date: ${today}   |   Filters: ${filterDesc}   |   Total: ${rows.length} tasks`,
    105,
    27,
    { align: "center" }
  );

  let y = 32;

  const cats = Object.keys(grouped);

  cats.forEach((cat) => {
    const catRows = grouped[cat];

    if (y > 260) {
      doc.addPage();
      y = 15;
    }

    doc.setFillColor(...NAVY);
    doc.rect(10, y, PW, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);

    doc.text(cat.toUpperCase(), 14, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.text(
      `${catRows.length} item${catRows.length > 1 ? "s" : ""}`,
      196,
      y + 5.5,
      { align: "right" }
    );

    y += 9;

    const tableRows = catRows.map((r) => {
      const remarkLines = (r.remarks || "")
        .split("\n")
        .filter(Boolean);

      const remarkStr = remarkLines.slice(-3).join("\n");

      const flagIcon =
        r.priority === "Critical"
          ? "! "
          : r.priority === "Push"
          ? "> "
          : "";

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
        1: { cellWidth: 24, fontSize: 8, textColor: [90, 106, 130] },
        2: { cellWidth: 100, fontSize: 8 },
        3: {
          cellWidth: 28,
          fontSize: 8,
          fontStyle: "bold",
          halign: "center",
        },
      },

      headStyles: {
        fillColor: MID,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        cellPadding: 3,
      },

      bodyStyles: {
        cellPadding: {
          top: 3,
          bottom: 3,
          left: 4,
          right: 4,
        },
        lineColor: [200, 208, 222],
        lineWidth: 0.2,
        valign: "top",
      },

      alternateRowStyles: {
        fillColor: [248, 250, 253],
      },

      didParseCell(data) {
        if (data.section === "body") {
          const row = catRows[data.row.index];

          if (!row) return;

          if (data.column.index === 3 && row.dueDate) {
            const m = {
              Jan: 0,
              Feb: 1,
              Mar: 2,
              Apr: 3,
              May: 4,
              Jun: 5,
              Jul: 6,
              Aug: 7,
              Sep: 8,
              Oct: 9,
              Nov: 10,
              Dec: 11,
            };

            const p = row.dueDate.split("-");

            if (p.length >= 3) {
              const d = new Date(
                parseInt("20" + p[2]),
                m[p[1]],
                parseInt(p[0])
              );

              const diff = (d - new Date()) / 86400000;

              if (diff < 0) data.cell.styles.textColor = RED;
              else if (diff <= 3)
                data.cell.styles.textColor = AMBER;
            }
          }
        }
      },

      didDrawPage(hookData) {
        y = hookData.cursor.y;
      },
    });

    y = doc.lastAutoTable.finalY + 5;
  });

  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setFontSize(7);
    doc.setTextColor(170, 170, 170);

    doc.text(
      `GH2 Solar Limited · War Room MOM · ${today} · Prepared by Taarun Dhingra · Page ${i} of ${pageCount}`,
      105,
      292,
      { align: "center" }
    );
  }

  doc.save(`GH2_WarRoom_MOM_${today.replace(/ /g, "-")}.pdf`);
}

// ── CONFIG ──────────────────────────────────────────────────────────────────

const DATA_URL =
  "https://raw.githubusercontent.com/taaruntd/gh2-warroom-data/main/data/tracker.json";

const REFRESH_MS = 5 * 60 * 1000;

const CATS = [
  "Project Updates",
  "SCM",
  "SCM Payments",
  "Cash Flow",
  "IPO",
  "Outstanding",
  "Solar BD",
  "H2 BD",
  "Factory",
  "Finance",
  "O&M",
  "HR",
  "IT",
  "Legal",
  "Compliance",
];

const STATUS_COLOR = {
  Open: "#3E5BA6",
  "In Progress": "#BA7517",
  Done: "#1a7a3c",
  Blocked: "#C8102E",
};

const PRI_BORDER = {
  Critical: "#C8102E",
  Push: "#E8910A",
  Normal: "transparent",
};

function badge(status) {
  return (
    <span
      style={{
        background: "#eef3ff",
        color: "#1a2f54",
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 20,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

function dueClass(due) {
  if (!due || due === "—") return null;

  const m = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const p = due.split("-");

  if (p.length < 3) return null;

  const d = new Date(
    parseInt("20" + p[2]),
    m[p[1]],
    parseInt(p[0])
  );

  const diff = (d - new Date()) / 86400000;

  return diff < 0 ? "overdue" : diff <= 3 ? "soon" : null;
}

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fCat, setFCat] = useState("");
  const [search, setSearch] = useState("");

  const intervalRef = useRef(null);

  async function fetchData() {
    try {
      const res = await fetch(DATA_URL + "?t=" + Date.now());

      const json = await res.json();

      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();

    intervalRef.current = setInterval(fetchData, REFRESH_MS);

    return () => clearInterval(intervalRef.current);
  }, []);

  const activeData = data.filter((r) => r.status !== "Done");

  const filtered = activeData.filter(
    (r) =>
      (!fCat || r.category === fCat) &&
      (!search ||
        r.task?.toLowerCase().includes(search.toLowerCase()))
  );

  const total = activeData.length;

  const openC = activeData.filter(
    (r) => r.status === "Open"
  ).length;

  const overdueC = activeData.filter(
    (r) => dueClass(r.dueDate) === "overdue"
  ).length;

  const doneTotal = data.filter(
    (r) => r.status === "Done"
  ).length;

  const statusData = Object.entries(
    activeData.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({
    name,
    value,
  }));

  const pendingCat = activeData.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});

  const catData = Object.entries(pendingCat).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "Arial",
        background: "#f7f9f2",
        minHeight: "100vh",
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1a2f54",
              }}
            >
              GH2 Solar — War Room Tracker
            </div>
          </div>

          <button
            onClick={() =>
              downloadPDF(data, {
                cat: fCat,
              })
            }
            style={{
              background: "#A6C83D",
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Download MOM PDF
          </button>
        </div>

        {/* KPI */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            ["Total Tasks", total],
            ["Open", openC],
            ["Overdue", overdueC],
            ["Completed", doneTotal],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#fff",
                padding: 18,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#666",
                }}
              >
                {label}
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 14,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#3E5BA6",
                marginBottom: 10,
              }}
            >
              Tasks by status
            </div>

            <ResponsiveContainer
              width="100%"
              height={200}
            >
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={70}
                >
                  {statusData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        STATUS_COLOR[entry.name] ||
                        "#888"
                      }
                    />
                  ))}
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              background: "#fff",
              padding: 14,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#3E5BA6",
                marginBottom: 10,
              }}
            >
              Pending by category
            </div>

            <ResponsiveContainer
              width="100%"
              height={250}
            >
              <BarChart
                data={catData}
                layout="vertical"
              >
                <XAxis type="number" />

                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                />

                <Tooltip />

                <Bar dataKey="value">
                  {catData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill="#3E5BA6"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters */}

        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <input
            placeholder="Search task..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ddd",
              width: 240,
            }}
          />

          <select
            value={fCat}
            onChange={(e) =>
              setFCat(e.target.value)
            }
            style={{
              padding: "8px 12px",
              borderRadius: 6,
            }}
          >
            <option value="">
              All categories
            </option>

            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Table */}

        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            overflow: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#eef3ff",
                }}
              >
                {[
                  "Category",
                  "Task",
                  "Owner",
                  "Due Date",
                  "Status",
                  "Remarks",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: 12,
                      textAlign: "left",
                      fontSize: 12,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((row, i) => {
                const dc = dueClass(row.dueDate);

                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom:
                        "1px solid #eee",
                    }}
                  >
                    <td
                      style={{
                        padding: 12,
                        borderLeft: `3px solid ${
                          PRI_BORDER[
                            row.priority
                          ] || "transparent"
                        }`,
                      }}
                    >
                      {row.category}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        fontWeight: 600,
                      }}
                    >
                      {row.task}
                    </td>

                    <td
                      style={{
                        padding: 12,
                      }}
                    >
                      {row.owner}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        color:
                          dc === "overdue"
                            ? "#C8102E"
                            : "#555",
                        fontWeight:
                          dc ? 600 : 400,
                      }}
                    >
                      {row.dueDate}
                    </td>

                    <td
                      style={{
                        padding: 12,
                      }}
                    >
                      {badge(row.status)}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        fontSize: 12,
                      }}
                    >
                      {(row.remarks || "")
                        .split("\n")
                        .slice(-1)[0]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
