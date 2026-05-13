// Repair tickets management page
// Full CRUD for tracking asset repairs: create tickets, update status/cost, close out
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import BarcodeScanner from "../components/BarcodeScanner"

const API = "http://localhost:8000/api/v1/repairs"
const ASSETS_API = "http://localhost:8000/api/v1/assets"
const getRole = () => {
    try {
        return JSON.parse(localStorage.getItem("user")).role_name
    } catch {
        return null
    }
}
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

const emptyForm = {
    asset: "", issue_description: "", repair_cost: "0.00", status: "OPEN",
}

export default function Repairs() {
    const navigate = useNavigate()
    const [tickets, setTickets] = useState([])
    // Full asset list for the create/edit form dropdown
    const [allAssets, setAllAssets] = useState([])
    const [search, setSearch] = useState("")
    const [filterStatus, setFilterStatus] = useState("")
    const [popup, setPopup] = useState("")
    const [showScanner, setShowScanner] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [editingId, setEditingId] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [docUploading, setDocUploading] = useState(false)
    const docInputRef = useRef(null)
    const role = getRole()
    const super_admin = role ==='SUPER_ADMIN'
    const dept_admin = role === "DEPARTMENT_ADMIN"
    const im= role==="MANAGER"


    const handleUnauth = () => {
        localStorage.clear()
        navigate("/")
    }

    const handleResponse = (r) => {
        if (r.status === 401) { handleUnauth(); throw new Error("Unauthorized") }
        return r.json()
    }

    const buildUrl = () => {
        const params = new URLSearchParams()
        if (search.trim()) params.set("search", search.trim())
        if (filterStatus) params.set("status", filterStatus)
        const qs = params.toString()
        return `${API}/repairs/${qs ? `?${qs}` : ""}`
    }

    const fetchTickets = () =>
        fetch(buildUrl(), { headers: headers() })
            .then(handleResponse)
            .then((d) => setTickets(d.results))

    // Fetch assets for the dropdown in the create/edit form
    const fetchAssets = () =>
        fetch(`${ASSETS_API}/assets/`, { headers: headers() })
            .then(handleResponse)
            .then((d) => setAllAssets(d.results || []))

    useEffect(() => {
        fetchTickets()
        fetchAssets()
    }, [])

    // Debounced refetch when search or filter changes
    useEffect(() => {
        const timer = setTimeout(() => fetchTickets(), 300)
        return () => clearTimeout(timer)
    }, [search, filterStatus])

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value })

    const handleSubmit = async (e) => {
        e.preventDefault()
        const body = {
            ...form,
            asset: parseInt(form.asset),
            repair_cost: parseFloat(form.repair_cost) || 0,
            completion_date: form.completion_date || null,
        }
        const url = editingId
            ? `${API}/repairs/${editingId}/`
            : `${API}/repairs/`
        const method = editingId ? "PUT" : "POST"

        const res = await fetch(url, {
            method,
            headers: headers(),
            body: JSON.stringify(body),
        })
        if (res.ok) {
            setPopup(editingId ? "Repair ticket updated" : "Repair ticket created")
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
            fetchTickets()
            setTimeout(() => setPopup(""), 2500)
        }
    }

    const handleEdit = (t) => {
        setForm({
            asset: t.asset,
            issue_description: t.issue_description,
            repair_cost: t.repair_cost.toString(),
            status: t.status,
            completion_date: t.completion_date ? t.completion_date.slice(0, 16) : "",
        })
        setEditingId(t.id)
        setShowForm(true)
    }

    const handleDelete = async (id) => {
        if (!confirm("Delete this repair ticket?")) return
        await fetch(`${API}/repairs/${id}/`, {
            method: "DELETE",
            headers: headers(),
        })
        fetchTickets()
    }

    const handleDocUpload = async (ticketId) => {
        const file = docInputRef.current?.files?.[0]
        if (!file) return
        setDocUploading(true)
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`${ASSETS_API}/documents/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
            body: fd,
        })
        if (res.ok) {
            const doc = await res.json()
            await fetch(`${API}/repairs/${ticketId}/`, {
                method: "PATCH",
                headers: headers(),
                body: JSON.stringify({ bill_documents: [doc.id] }),
            })
            setPopup("Bill uploaded")
            setTimeout(() => setPopup(""), 2500)
            fetchTickets()
        }
        setDocUploading(false)
        if (docInputRef.current) docInputRef.current.value = ""
    }

    const openCreate = () => {
        setForm(emptyForm)
        setEditingId(null)
        setShowForm(true)
    }

    const statusBadge = (s) => {
        const styles = {
            OPEN: { bg: "rgba(6,182,212,0.2)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)" },
            IN_PROGRESS: { bg: "rgba(250,204,21,0.2)", color: "#eab308", border: "1px solid rgba(250,204,21,0.3)" },
            COMPLETED: { bg: "rgba(34,197,94,0.2)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" },
            CLOSED: { bg: "rgba(148,163,184,0.2)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.3)" },
        }
        const st = styles[s] || styles.OPEN
        return <span style={{ ...st, padding: "2px 10px", borderRadius: "4px", fontSize: "0.75rem" }}>{s.replace("_", " ")}</span>
    }

    // Use asset_detail from the serializer if available, otherwise look up from our list
    const assetLabel = (t) => {
        if (t.asset_detail) return `${t.asset_detail.asset_code} — ${t.asset_detail.asset_name}`
        const a = allAssets.find((x) => x.id === t.asset)
        return a ? `${a.asset_code} — ${a.asset_name}` : "-"
    }

    return (
        <>
            {popup && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 9999,
                    background: "rgba(34,197,94,0.15)", color: "#22c55e",
                    border: "1px solid rgba(34,197,94,0.3)",
                    padding: "12px 24px", borderRadius: 8, fontSize: "0.9rem",
                }}>{popup}</div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Repairs</h1>
                {(super_admin || dept_admin || im) && <button className="btn btn-primary" onClick={openCreate}>+ New Ticket</button>}
            </div>

            {(super_admin || dept_admin || im) && (
                <div className="card p-3 mb-4">
                    <div className="d-flex gap-2 mb-3">
                        <input
                            className="form-control"
                            placeholder="Search by asset code, name, or issue..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ maxWidth: 400 }}
                        />
                        <button className="btn btn-outline-info" onClick={() => setShowScanner(true)}>
                            Scan
                        </button>
                        <select className="form-control" style={{ maxWidth: 180 }} value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="card p-3 mb-4">
                    <h5 style={{ color: "#e2e8f0", marginBottom: "16px" }}>
                        {editingId ? "Edit Repair Ticket" : "New Repair Ticket"}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                            <div className="mb-2" style={{ flex: "1 1 300px" }}>
                                <label className="form-label">Asset</label>
                                <select name="asset" className="form-control" value={form.asset}
                                    onChange={handleChange} required>
                                    <option value="">-- Select Asset --</option>
                                    {allAssets.map((a) => (
                                        <option key={a.id} value={a.id}>{a.asset_code} — {a.asset_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 100%" }}>
                                <label className="form-label">Issue Description</label>
                                <textarea name="issue_description" className="form-control" rows={3}
                                    value={form.issue_description} onChange={handleChange} required />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Repair Cost</label>
                                <input name="repair_cost" type="number" step="0.01" min="0"
                                    className="form-control" value={form.repair_cost}
                                    onChange={handleChange} />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Status</label>
                                <select name="status" className="form-control" value={form.status}
                                    onChange={handleChange}>
                                    <option value="OPEN">Open</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CLOSED">Closed</option>
                                </select>
                            </div>
                            {editingId && (
                                <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                    <label className="form-label">Completion Date</label>
                                    <input name="completion_date" type="datetime-local"
                                        className="form-control" value={form.completion_date}
                                        onChange={handleChange} />
                                </div>
                            )}
                        </div>
                        <div className="mt-3 d-flex gap-2">
                            <button type="submit" className="btn btn-primary">
                                {editingId ? "Update" : "Create"}
                            </button>
                            {editingId && (
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <input ref={docInputRef} type="file" style={{ display: "none" }}
                                        onChange={() => handleDocUpload(editingId)} />
                                    <button type="button" className="btn btn-outline-info" disabled={docUploading}
                                        onClick={() => docInputRef.current?.click()}>
                                        {docUploading ? "Uploading..." : "+ Upload Bill"}
                                    </button>
                                </div>
                            )}
                            <button type="button" className="btn" style={{
                                border: "1px solid rgba(148,163,184,0.3)", color: "#94a3b8",
                                borderRadius: "8px", padding: "8px 20px",
                            }} onClick={() => { setShowForm(false); setEditingId(null); }}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card p-0" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ minWidth: "1000px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                <th style={thStyle}>ID</th>
                                <th style={thStyle}>Asset</th>
                                <th style={thStyle}>Issue</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Cost</th>
                                <th style={thStyle}>Started</th>
                                <th style={thStyle}>Completed</th>
                                <th style={thStyle}>Bill</th>
                                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.length === 0 && (
                                <tr><td colSpan={9} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No repair tickets found</td></tr>
                            )}
                            {tickets.map((t) => (
                                <tr key={t.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)", transition: "background 0.2s" }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(6,182,212,0.03)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                    <td style={tdStyle}>{t.id}</td>
                                    <td style={tdStyle}>{assetLabel(t)}</td>
                                    <td style={{ ...tdStyle, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {t.issue_description}
                                    </td>
                                    <td style={tdStyle}>{statusBadge(t.status)}</td>
                                    <td style={tdStyle}>${parseFloat(t.repair_cost).toFixed(2)}</td>
                                    <td style={tdStyle}>{new Date(t.start_date).toLocaleDateString()}</td>
                                    <td style={tdStyle}>{t.completion_date ? new Date(t.completion_date).toLocaleDateString() : "-"}</td>
                                    <td style={tdStyle}>
                                        {t.bill_documents?.length > 0 ? (
                                            <span style={{ color: "#22c55e", fontSize: "0.8rem", cursor: "pointer" }}
                                                onClick={async () => {
                                                    const r = await fetch(`${ASSETS_API}/documents/${t.bill_documents[0]}/download/`, {
                                                        headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
                                                    });
                                                    if (r.ok) { const b = await r.blob(); const u = URL.createObjectURL(b); const x = document.createElement("a"); x.href = u; x.download = "bill"; x.click(); URL.revokeObjectURL(u); }
                                                }}>
                                                📎 Bill
                                            </span>
                                        ) : "—"}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: "center" }}>
                                        {(super_admin || dept_admin || im) && (
                                            <>
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                                                    borderRadius: "6px", padding: "4px 12px", marginRight: "6px",
                                                    fontSize: "0.8rem", background: "transparent",
                                                }} onClick={() => handleEdit(t)}>Edit</button>
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                    borderRadius: "6px", padding: "4px 12px",
                                                    fontSize: "0.8rem", background: "transparent",
                                                }} onClick={() => handleDelete(t.id)}>Delete</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showScanner && (
                <BarcodeScanner
                    onScan={(asset) => {
                        setShowScanner(false)
                        setSearch(asset.asset_code)
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
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
