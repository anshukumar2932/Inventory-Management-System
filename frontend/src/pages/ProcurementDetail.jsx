import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"

const API = "http://localhost:8000/api/v1"
const ASSETS_API = "http://localhost:8000/api/v1/assets"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

const getRole = () => {
    try { return JSON.parse(localStorage.getItem("user")).role_name }
    catch { return null }
}

export default function ProcurementDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const role = getRole()
    const admin = role === "ADMIN"
    const [procurement, setProcurement] = useState(null)
    const [assets, setAssets] = useState([])
    const [remarks, setRemarks] = useState("")
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        fetch(`${API}/procurements/${id}/`, { headers: headers() })
            .then((r) => { if (r.status === 401) { localStorage.clear(); navigate("/") }; return r.json() })
            .then((d) => {
                setProcurement(d)
                return fetch(`${ASSETS_API}/assets/?procurement_request=${d.id}`, { headers: headers() })
            })
            .then((r) => r.json())
            .then((d) => setAssets(d.results || d))
            .finally(() => setLoading(false))
    }, [id])

    const handleApprove = async () => {
        setActionLoading(true)
        await fetch(`${API}/procurements/${id}/approve/`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ remarks }),
        })
        setActionLoading(false)
        navigate("/procurements")
    }

    const handleReject = async () => {
        if (!remarks.trim()) { alert("Please add remarks for rejection"); return }
        setActionLoading(true)
        await fetch(`${API}/procurements/${id}/reject/`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ remarks }),
        })
        setActionLoading(false)
        navigate("/procurements")
    }

    if (loading) return <div style={{ color: "#94a3b8", padding: "40px", textAlign: "center" }}>Loading...</div>
    if (!procurement) return <div style={{ color: "#94a3b8", padding: "40px", textAlign: "center" }}>Not found</div>

    return (
        <>
            <div className="d-flex align-items-center gap-2 mb-3">
                <Link to="/procurements" style={{ color: "#06b6d4", textDecoration: "none", fontSize: "0.9rem" }}>&larr; Back</Link>
            </div>

            <h1 style={{
                background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                fontWeight: 700, fontSize: "1.75rem", marginBottom: "24px",
            }}>{procurement.request_number}</h1>

            <div className="row g-3 mb-4">
                <div className="col-md-8">
                    <div className="card p-3">
                        <table className="table">
                            <tbody>
                                <tr><td style={{ color: "#94a3b8", width: 160 }}>Department</td>
                                    <td style={{ color: "#e2e8f0" }}>{procurement.department_name}</td></tr>
                                <tr><td style={{ color: "#94a3b8" }}>Requested By</td>
                                    <td style={{ color: "#e2e8f0" }}>{procurement.requested_by_name}</td></tr>
                                <tr><td style={{ color: "#94a3b8" }}>Status</td>
                                    <td><span style={{
                                        padding: "2px 10px", borderRadius: "4px", fontSize: "0.75rem",
                                        background: procurement.approval_status === "APPROVED" ? "rgba(34,197,94,0.2)" :
                                            procurement.approval_status === "REJECTED" ? "rgba(239,68,68,0.2)" :
                                            "rgba(250,204,21,0.2)",
                                        color: procurement.approval_status === "APPROVED" ? "#22c55e" :
                                            procurement.approval_status === "REJECTED" ? "#ef4444" : "#eab308",
                                        border: `1px solid ${
                                            procurement.approval_status === "APPROVED" ? "rgba(34,197,94,0.3)" :
                                            procurement.approval_status === "REJECTED" ? "rgba(239,68,68,0.3)" :
                                            "rgba(250,204,21,0.3)"
                                        }`,
                                    }}>{procurement.approval_status}</span></td></tr>
                                <tr><td style={{ color: "#94a3b8" }}>Assets Count</td>
                                    <td style={{ color: "#e2e8f0" }}>{procurement.asset_count}</td></tr>
                                <tr><td style={{ color: "#94a3b8" }}>Created</td>
                                    <td style={{ color: "#e2e8f0" }}>{new Date(procurement.created_at).toLocaleString()}</td></tr>
                                {procurement.remarks && (
                                    <tr><td style={{ color: "#94a3b8" }}>Remarks</td>
                                        <td style={{ color: "#e2e8f0" }}>{procurement.remarks}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="card p-3 mt-3">
                        <h5 style={{ color: "#e2e8f0", marginBottom: "12px", fontSize: "0.95rem" }}>Assets</h5>
                        {assets.length === 0 ? (
                            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>No assets associated</div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Code</th>
                                            <th style={thStyle}>Name</th>
                                            <th style={thStyle}>Approval</th>
                                            <th style={thStyle}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assets.map((a) => (
                                            <tr key={a.id}>
                                                <td style={tdStyle}>{a.asset_code}</td>
                                                <td style={tdStyle}>{a.asset_name}</td>
                                                <td style={tdStyle}>{a.approval_status}</td>
                                                <td style={tdStyle}>{a.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {admin && procurement.approval_status === "PENDING" && (
                    <div className="col-md-4">
                        <div className="card p-3">
                            <h5 style={{ color: "#e2e8f0", marginBottom: "16px", fontSize: "0.95rem" }}>Actions</h5>
                            <div className="mb-3">
                                <label className="form-label">Remarks</label>
                                <textarea className="form-control" rows={4}
                                    value={remarks} onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Approval or rejection remarks..."
                                />
                            </div>
                            <div className="d-flex gap-2">
                                <button className="btn btn-success" onClick={handleApprove} disabled={actionLoading}
                                    style={{ flex: 1 }}>
                                    {actionLoading ? "Processing..." : "Approve"}
                                </button>
                                <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading}
                                    style={{ flex: 1 }}>
                                    {actionLoading ? "Processing..." : "Reject"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

const thStyle = {
    color: "#64748b", fontWeight: 600, fontSize: "0.8rem",
    textTransform: "uppercase", letterSpacing: "0.5px",
    padding: "8px 12px", borderBottom: "1px solid rgba(148,163,184,0.1)",
}
const tdStyle = {
    color: "#e2e8f0", fontSize: "0.875rem",
    padding: "8px 12px", verticalAlign: "middle",
}
