import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000/api/v1/reports"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

export default function Reports() {
    const navigate = useNavigate()
    const [reports, setReports] = useState([])
    const [kpi, setKpi] = useState(null)
    const [generating, setGenerating] = useState(false)

    const handleUnauth = () => {
        localStorage.clear()
        navigate("/")
    }

    const fetchReports = () => {
        fetch(`${API}/`, { headers: headers() })
            .then((r) => {
                if (r.status === 401) { handleUnauth(); throw new Error("Unauthorized") }
                return r.json()
            })
            .then((d) => setReports(d.results || []))
            .catch(() => {})
    }

    const fetchKpi = () => {
        fetch(`${API}/kpi/`, { headers: headers() })
            .then((r) => r.json())
            .then((d) => setKpi(d))
            .catch(() => {})
    }

    useEffect(() => { fetchReports(); fetchKpi() }, [])

    const handleGenerate = async () => {
        setGenerating(true)
        const res = await fetch(`${API}/generate/`, {
            method: "POST",
            headers: headers(),
        })
        setGenerating(false)
        if (res.ok) {
            fetchReports()
            fetchKpi()
        }
    }

    const handleDownload = async (id, type) => {
        const res = await fetch(`${API}/${id}/download_${type}/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
        })
        if (!res.ok) return
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `report_${id}.${type === "pdf" ? "pdf" : type === "excel" ? "xlsx" : "png"}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const KpiCard = ({ label, value, color }) => (
        <div style={{
            background: "#1e293b", borderRadius: "10px", padding: "16px",
            border: "1px solid rgba(148,163,184,0.1)", textAlign: "center",
        }}>
            <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{label}</div>
            <div style={{ color: color || "#06b6d4", fontSize: "1.5rem", fontWeight: 700 }}>{value ?? "-"}</div>
        </div>
    )

    return (
        <>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Reports</h1>
                <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                    {generating ? "Generating..." : "+ Generate Report"}
                </button>
            </div>

            {kpi && (
                <div className="card p-3 mb-4">
                    <h6 style={{ color: "#94a3b8", marginBottom: "16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.75rem" }}>
                        Executive KPIs
                    </h6>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                        <KpiCard label="Total Assets" value={kpi.total_assets} color="#06b6d4" />
                        <KpiCard label="Active" value={kpi.active_assets} color="#22c55e" />
                        <KpiCard label="Under Repair" value={kpi.under_repair} color="#eab308" />
                        <KpiCard label="Missing" value={kpi.missing_assets} color="#ef4444" />
                        <KpiCard label="Pending Procurement" value={kpi.pending_procurements} color="#f97316" />
                        <KpiCard label="Total Repairs" value={kpi.total_repairs} color="#8b5cf6" />
                        <KpiCard label="Repair Cost" value={kpi.total_repair_cost ? `Rs. ${kpi.total_repair_cost.toLocaleString()}` : "-"} color="#06b6d4" />
                        <KpiCard label="Pending Approvals" value={kpi.pending_approvals} color="#eab308" />
                    </div>
                </div>
            )}

            <div className="card p-0" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ minWidth: "700px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                <th style={thStyle}>Title</th>
                                <th style={thStyle}>Type</th>
                                <th style={thStyle}>Generated</th>
                                <th style={thStyle}>Scheduled</th>
                                <th style={{ ...thStyle, textAlign: "center" }}>Download</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.length === 0 && (
                                <tr><td colSpan={5} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No reports generated yet</td></tr>
                            )}
                            {reports.map((r) => (
                                <tr key={r.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.title}</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            background: "rgba(6,182,212,0.15)", color: "#06b6d4",
                                            padding: "2px 10px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600,
                                        }}>{r.report_type}</span>
                                    </td>
                                    <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString()}</td>
                                    <td style={tdStyle}>{r.is_scheduled ? "✓" : "—"}</td>
                                    <td style={{ ...tdStyle, textAlign: "center" }}>
                                        <div className="d-flex gap-2 justify-content-center">
                                            {r.pdf_data && (
                                                <button className="btn btn-sm" style={{
                                                        border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                    borderRadius: "6px", padding: "4px 12px", fontSize: "0.8rem",
                                                }} onClick={() => handleDownload(r.id, "pdf")}>PDF</button>
                                            )}
                                            {r.excel_data && (
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e",
                                                    borderRadius: "6px", padding: "4px 12px", fontSize: "0.8rem",
                                                }} onClick={() => handleDownload(r.id, "excel")}>Excel</button>
                                            )}
                                            {!r.chart_cleared && r.chart_data && (
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(148,163,184,0.3)", color: "#94a3b8",
                                                    borderRadius: "6px", padding: "4px 12px", fontSize: "0.8rem",
                                                }} onClick={() => handleDownload(r.id, "chart")}>Chart</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}

const thStyle = {
    color: "#64748b", fontWeight: 600, fontSize: "0.8rem",
    textTransform: "uppercase", letterSpacing: "0.5px",
    padding: "12px 16px", borderBottom: "1px solid rgba(148,163,184,0.1)",
}
const tdStyle = {
    color: "#e2e8f0", fontSize: "0.875rem",
    padding: "12px 16px", verticalAlign: "middle",
}
