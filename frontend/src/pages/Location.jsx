// Locations management page
// CRUD for physical locations (building, floor, room) with search
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000/api/v1/assets"
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
    name: "", building: "", floor: "", room: "",sub_location: "",
}

export default function Location() {
    const navigate = useNavigate()
    const [locations, setLocations] = useState([])
    const [search, setSearch] = useState("")
    const [popup, setPopup] = useState("")
    const [form, setForm] = useState(emptyForm)
    const [editingId, setEditingId] = useState(null)
    const [showForm, setShowForm] = useState(false)
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

    // Fetch with optional search — backend filters locations by name
    const fetchLocations = () => {
        const params = new URLSearchParams()
        if (search.trim()) params.set("search", search.trim())
        const qs = params.toString()
        const url = `${API}/locations/${qs ? `?${qs}` : ""}`
        fetch(url, { headers: headers() })
            .then(handleResponse)
            .then((d) => setLocations(d.results))
            .catch(() => {})
    }

    useEffect(() => { fetchLocations() }, [])

    useEffect(() => {
        const timer = setTimeout(() => fetchLocations(), 300)
        return () => clearTimeout(timer)
    }, [search])

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value })

    const handleSubmit = async (e) => {
        e.preventDefault()
        const url = editingId
            ? `${API}/locations/${editingId}/`
            : `${API}/locations/add/`
        const method = editingId ? "PUT" : "POST"

        const res = await fetch(url, {
            method,
            headers: headers(),
            body: JSON.stringify(form),
        })
        if (res.ok) {
            setPopup(editingId ? "Location updated" : "Location created")
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
            fetchLocations()
            setTimeout(() => setPopup(""), 2500)
        }
    }

    const handleEdit = (loc) => {
        setForm({
            name: loc.name,
            building: loc.building,
            floor: loc.floor,
            room: loc.room,    
            sub_location: loc.sub_location || "",
        })
        setEditingId(loc.id)
        setShowForm(true)
    }

    const handleDelete = async (id) => {
        if (!confirm("Delete this location?")) return
        await fetch(`${API}/locations/${id}/`, {
            method: "DELETE",
            headers: headers(),
        })
        fetchLocations()
    }

    const openCreate = () => {
        setForm(emptyForm)
        setEditingId(null)
        setShowForm(true)
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
                }}>Locations</h1>
                {(super_admin || dept_admin || im) && <button className="btn btn-primary" onClick={openCreate}>+ New Location</button>}
            </div>

            {(super_admin || dept_admin) && (
                <div className="card p-3 mb-4">
                    <input
                        className="form-control"
                        placeholder="Search locations..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ maxWidth: 400 }}
                    />
                </div>
            )}

            {showForm && (
                <div className="card p-3 mb-4">
                    <h5 style={{ color: "#e2e8f0", marginBottom: "16px" }}>
                        {editingId ? "Edit Location" : "New Location"}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Name</label>
                                <input name="name" className="form-control" value={form.name}
                                    onChange={handleChange} required />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Building</label>
                                <input name="building" className="form-control" value={form.building}
                                    onChange={handleChange} />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Floor</label>
                                <input name="floor" className="form-control" value={form.floor}
                                    onChange={handleChange} />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Room</label>
                                <input name="room" className="form-control" value={form.room}
                                    onChange={handleChange} />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Sub Location</label>
                                <input
                                    name="sub_location"
                                    className="form-control"
                                    value={form.sub_location}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="mt-3 d-flex gap-2">
                            <button type="submit" className="btn btn-primary">
                                {editingId ? "Update" : "Create"}
                            </button>
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
                    <table className="table" style={{ minWidth: "700px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Building</th>
                                <th style={thStyle}>Floor</th>
                                <th style={thStyle}>Room</th>
                                <th style={thStyle}>Sub Location</th>
                                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {locations.length === 0 && (
                                <tr><td colSpan={5} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No locations found</td></tr>
                            )}
                            {locations.map((l) => (
                                <tr key={l.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)", transition: "background 0.2s" }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(6,182,212,0.03)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                    <td style={tdStyle}>{l.name}</td>
                                    <td style={tdStyle}>{l.building}</td>
                                    <td style={tdStyle}>{l.floor}</td>
                                    <td style={tdStyle}>{l.room}</td>
                                    <td style={tdStyle}>{l.sub_location}</td>
                                    <td style={{ ...tdStyle, textAlign: "center" }}>
                                        {(super_admin || dept_admin) && (
                                            <>
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                                                    borderRadius: "6px", padding: "4px 12px", marginRight: "6px",
                                                    fontSize: "0.8rem", background: "transparent",
                                                }} onClick={() => handleEdit(l)}>Edit</button>
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                    borderRadius: "6px", padding: "4px 12px",
                                                    fontSize: "0.8rem", background: "transparent",
                                                }} onClick={() => handleDelete(l.id)}>Delete</button>
                                            </>
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
