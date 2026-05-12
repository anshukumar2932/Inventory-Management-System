import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"

const API = "http://localhost:8000/api/v1"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

const getRole = () => {
    try { return JSON.parse(localStorage.getItem("user")).role_name }
    catch { return null }
}

const statusBadge = (s) => {
    const styles = {
        PENDING: { bg: "rgba(250,204,21,0.2)", color: "#eab308", border: "1px solid rgba(250,204,21,0.3)" },
        APPROVED: { bg: "rgba(34,197,94,0.2)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" },
        REJECTED: { bg: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" },
    }
    const st = styles[s] || styles.PENDING
    return <span style={{ ...st, padding: "2px 10px", borderRadius: "4px", fontSize: "0.75rem" }}>{s}</span>
}

export default function Procurements() {
    const navigate = useNavigate()
    const role = getRole()
    const admin = role === "ADMIN"
    const [requests, setRequests] = useState([])
    const [tab, setTab] = useState(admin ? "PENDING" : "MY")
    const [loading, setLoading] = useState(true)

    const fetchData = () => {
        setLoading(true)
        let url = `${API}/procurements/`
        if (tab === "PENDING") url = `${API}/procurements/pending/`
        else if (tab === "HISTORY") url = `${API}/procurements/history/`

        fetch(url, { headers: headers() })
            .then((r) => { if (r.status === 401) { localStorage.clear(); navigate("/") }; return r.json() })
            .then((d) => setRequests(d.results || d))
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchData() }, [tab])

    return (
        <>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Procurements</h1>
                {!admin && (
                    <Link to="/procurements/new" className="btn btn-primary">+ New Request</Link>
                )}
            </div>

            <div className="mb-3 d-flex gap-2">
                {!admin && (
                    <button className={`btn btn-sm ${tab === "MY" ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setTab("MY")}>My Requests</button>
                )}
                {admin && (
                    <button className={`btn btn-sm ${tab === "PENDING" ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setTab("PENDING")}>Pending</button>
                )}
                {admin && (
                    <button className={`btn btn-sm ${tab === "HISTORY" ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setTab("HISTORY")}>History</button>
                )}
                {!admin && (
                    <button className={`btn btn-sm ${tab === "ALL" ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setTab("ALL")}>All</button>
                )}
            </div>

            <div className="card p-0" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ minWidth: "700px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                <th style={thStyle}>Request #</th>
                                <th style={thStyle}>Department</th>
                                <th style={thStyle}>Requested By</th>
                                <th style={thStyle}>Assets</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Date</th>
                                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={7} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>Loading...</td></tr>
                            )}
                            {!loading && requests.length === 0 && (
                                <tr><td colSpan={7} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No requests found</td></tr>
                            )}
                            {requests.map((r) => (
                                <tr key={r.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                                    <td style={tdStyle}>{r.request_number}</td>
                                    <td style={tdStyle}>{r.department_name}</td>
                                    <td style={tdStyle}>{r.requested_by_name}</td>
                                    <td style={tdStyle}>{r.asset_count}</td>
                                    <td style={tdStyle}>{statusBadge(r.approval_status)}</td>
                                    <td style={tdStyle}>{new Date(r.created_at).toLocaleDateString()}</td>
                                    <td style={{ ...tdStyle, textAlign: "center" }}>
                                        <Link to={`/procurements/${r.id}`} className="btn btn-sm" style={{
                                            border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                                            borderRadius: "6px", padding: "4px 12px",
                                            fontSize: "0.8rem", background: "transparent", textDecoration: "none",
                                        }}>View</Link>
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
