import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000/api/v1/assets/service-types"
const DEPT_API = "http://localhost:8000/api/v1/auth/departments"

const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

const getRole = () => {
    try { return JSON.parse(localStorage.getItem("user")).role_name }
    catch { return null }
}

export default function ServiceTypes() {
    const navigate = useNavigate()
    const role = getRole()
    const isSuper = role === "SUPER_ADMIN"
    const [services, setServices] = useState([])
    const [departments, setDepartments] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({ name: "", department: "", description: "", is_global: false })
    const [msg, setMsg] = useState("")
    const [errors, setErrors] = useState({})

    const flash = (text) => { setMsg(text); setTimeout(() => setMsg(""), 3000) }

    const handleUnauth = () => { localStorage.clear(); navigate("/") }

    const handleRes = (r) => {
        if (r.status === 401) { handleUnauth(); throw new Error("Unauthorized") }
        return r.json()
    }

    const fetchServices = () =>
        fetch(API, { headers: headers() })
            .then(handleRes)
            .then((d) => setServices(d.results || d))

    const fetchDepts = () =>
        fetch(DEPT_API, { headers: headers() })
            .then(handleRes)
            .then((d) => setDepartments(d.results || d))

    useEffect(() => { fetchServices(); fetchDepts() }, [])

    const openCreate = () => {
        setForm({ name: "", department: "", description: "", is_global: false })
        setErrors({})
        setEditingId(null)
        setShowForm(true)
    }

    const openEdit = (s) => {
        setForm({
            name: s.name,
            department: s.department || "",
            description: s.description || "",
            is_global: s.is_global,
        })
        setErrors({})
        setEditingId(s.id)
        setShowForm(true)
    }

    const handleChange = (e) => {
        const value = e.target.type === "checkbox" ? e.target.checked : e.target.value
        setForm({ ...form, [e.target.name]: value })
    }

    const nameExists = (name) =>
        services.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== editingId)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrors({})
        const trimmed = form.name.trim()
        if (!trimmed) {
            setErrors({ name: "Name is required" })
            return
        }
        if (nameExists(trimmed)) {
            setErrors({ name: `"${trimmed}" already exists` })
            return
        }
        const body = {
            ...form, name: trimmed,
            department: form.department ? parseInt(form.department) : null,
        }
        const url = editingId ? `${API}/${editingId}/` : API
        const method = editingId ? "PUT" : "POST"
        const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) })
        if (res.ok) {
            flash(editingId ? "Service updated" : "Service created")
            setShowForm(false)
            setEditingId(null)
            fetchServices()
        } else {
            try {
                const data = await res.json()
                setErrors(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v])))
            } catch {
                setErrors({ form: "Failed to save. Please try again." })
            }
        }
    }

    const handleDelete = async (id) => {
        if (!confirm("Delete this service type?")) return
        await fetch(`${API}/${id}/`, { method: "DELETE", headers: headers() })
        flash("Service deleted")
        fetchServices()
    }

    const deptName = (id) => {
        const d = departments.find((d) => d.id === id)
        return d ? d.department_name : "—"
    }

    return (
        <>
            {msg && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 9999,
                    background: msg.includes("error") || msg.includes("already") ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                    color: msg.includes("error") || msg.includes("already") ? "#ef4444" : "#22c55e",
                    border: `1px solid ${msg.includes("error") || msg.includes("already") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                    padding: "12px 24px", borderRadius: 8, fontSize: "0.9rem",
                }}>{msg}</div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Service Types</h1>
                {isSuper && (
                    <button className="btn btn-primary" onClick={openCreate}>+ New Service</button>
                )}
            </div>

            {showForm && isSuper && (
                <div className="card p-3 mb-4" style={{ maxWidth: 550 }}>
                    <h5 style={{ color: "#e2e8f0", marginBottom: "12px" }}>
                        {editingId ? "Edit Service" : "New Service"}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-2">
                            <label className="form-label">Name</label>
                            <input name="name" className="form-control" value={form.name}
                                onChange={(e) => { handleChange(e); if (errors.name) setErrors({ ...errors, name: "" }) }}
                                style={errors.name ? { borderColor: "#ef4444" } : {}} />
                            {errors.name && (
                                <small style={{ color: "#ef4444", fontSize: "0.8rem" }}>{errors.name}</small>
                            )}
                        </div>
                        <div className="mb-2">
                            <label className="form-label">Department</label>
                            <select name="department" className="form-control" value={form.department}
                                onChange={handleChange}>
                                <option value="">-- Global (no department) --</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.department_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mb-2">
                            <label className="form-label">Description</label>
                            <textarea name="description" className="form-control" rows="2"
                                value={form.description} onChange={handleChange} />
                        </div>
                        <div className="mb-3 form-check">
                            <input type="checkbox" name="is_global" className="form-check-input"
                                checked={form.is_global} onChange={handleChange} id="globalChk" />
                            <label className="form-check-label" htmlFor="globalChk" style={{ color: "#94a3b8" }}>
                                Global (available to all departments)
                            </label>
                        </div>
                        {errors.form && (
                            <div className="mb-2" style={{ color: "#ef4444", fontSize: "0.85rem" }}>{errors.form}</div>
                        )}
                        <div className="d-flex gap-2">
                            <button type="submit" className="btn btn-primary">
                                {editingId ? "Update" : "Create"}
                            </button>
                            <button type="button" className="btn btn-outline-secondary"
                                onClick={() => { setShowForm(false); setEditingId(null); setErrors({}) }}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card p-0" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ minWidth: "600px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Department</th>
                                <th style={thStyle}>Description</th>
                                <th style={thStyle}>Global</th>
                                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.length === 0 && (
                                <tr><td colSpan={5} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No service types found</td></tr>
                            )}
                            {services.map((s) => (
                                <tr key={s.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                                    <td style={tdStyle}>{deptName(s.department)}</td>
                                    <td style={tdStyle}>{s.description || "—"}</td>
                                    <td style={tdStyle}>
                                        {s.is_global ? (
                                            <span style={{ color: "#22c55e", fontSize: "0.8rem" }}>✓ Yes</span>
                                        ) : (
                                            <span style={{ color: "#64748b", fontSize: "0.8rem" }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: "center" }}>
                                        {isSuper && (
                                            <div className="d-flex gap-1 justify-content-center">
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                                                    borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                }} onClick={() => openEdit(s)}>Edit</button>
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                    borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                }} onClick={() => handleDelete(s.id)}>Del</button>
                                            </div>
                                        )}
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
