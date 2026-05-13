// Main asset management page
// Lists assets in a table with search, filter, and full CRUD
import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import BarcodeScanner from "../components/BarcodeScanner"

// Assets API base — note the double "assets" comes from the router prefix
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
    asset_code: "", barcode: "", asset_name: "", brand: "", model_name: "",
    serial_number: "", model_detail: "", manufacturer: "",
    invoice_number: "", status: "ACTIVE",
    category: "", location: "", department: "", vendor: "",
    remarks: "",
}

export default function Assets() {
    const navigate = useNavigate()
    const [assets, setAssets] = useState([])
    // Lookup lists for rendering names instead of IDs in the table
    const [categories, setCategories] = useState([])
    const [locations, setLocations] = useState([])
    const [departments, setDepartments] = useState([])
    const [vendors, setVendors] = useState([])
    const [search, setSearch] = useState("")
    // Filter dropdowns — each maps to a query param the backend understands
    const [filterStatus, setFilterStatus] = useState("")
    const [filterCategory, setFilterCategory] = useState("")
    const [filterLocation, setFilterLocation] = useState("")
    const [filterDepartment, setFilterDepartment] = useState("")
    const [groupBy, setGroupBy] = useState("")
    const [popup, setPopup] = useState("")
    const [showScanner, setShowScanner] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [editingId, setEditingId] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [docUploading, setDocUploading] = useState(false)
    const [pendingDoc, setPendingDoc] = useState(null)
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

    // Build the URL with all active search/filter params
    // The backend's SearchFilter + DjangoFilterBackend handle these automatically
    const buildUrl = () => {
        const params = new URLSearchParams()
        if (search.trim()) params.set("search", search.trim())
        if (filterStatus) params.set("status", filterStatus)
        if (filterCategory) params.set("category", filterCategory)
        if (filterLocation) params.set("location", filterLocation)
        if (filterDepartment) params.set("department", filterDepartment)
        const qs = params.toString()
        return `${API}/assets/${qs ? `?${qs}` : ""}`
    }

    const fetchAssets = () =>
        fetch(buildUrl(), { headers: headers() })
            .then(handleResponse)
            .then((d) => setAssets(d.results))

    // Fetch the lookup data (categories, locations, etc.) once on mount
    const fetchLookups = () =>
        Promise.all([
            fetch(`${API}/categories/`, { headers: headers() }).then(handleResponse),
            fetch(`${API}/locations/`, { headers: headers() }).then(handleResponse),
            fetch(`http://localhost:8000/api/v1/auth/departments/`, { headers: headers() }).then(handleResponse),
            fetch(`${API}/vendors/`, { headers: headers() }).then(handleResponse),
        ]).then(([c, l, d, v]) => {
            setCategories(c.results || c)
            setLocations(l.results || l)
            setDepartments(d.results || d)
            setVendors(v.results || v)
        })

    useEffect(() => {
        fetchAssets()
        fetchLookups()
    }, [])

    // Debounced refetch when search or filters change
    useEffect(() => {
        const timer = setTimeout(() => fetchAssets(), 300)
        return () => clearTimeout(timer)
    }, [search, filterStatus, filterCategory, filterLocation, filterDepartment])

    const handleQuickCreate = async () => {
        if (!search.trim()) return
        const res = await fetch(`${API}/assets/add/`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ asset_name: search.trim() }),
        })
        if (res.ok) {
            setPopup("New asset created")
            setSearch("")
            fetchAssets()
            setTimeout(() => setPopup(""), 2500)
        }
    }

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value })

    const handleSubmit = async (e) => {
        e.preventDefault()
        const body = { ...form }
        body.remarks = body.remarks || ""
        body.category = parseInt(body.category)
        body.location = parseInt(body.location)
        body.department = parseInt(body.department)
        body.vendor = body.vendor ? parseInt(body.vendor) : null

        const url = editingId
            ? `${API}/assets/${editingId}/`
            : `${API}/assets/`
        const method = editingId ? "PUT" : "POST"

        const res = await fetch(url, {
            method,
            headers: headers(),
            body: JSON.stringify(body),
        })
        if (res.ok) {
            const asset = await res.json()
            if (!editingId && pendingDoc) {
                await uploadDoc(asset.id)
                setPendingDoc(null)
            }
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
            fetchAssets()
        }
    }

    const handleEdit = (asset) => {
        setForm({
            asset_code: asset.asset_code,
            barcode: asset.barcode,
            asset_name: asset.asset_name,
            brand: asset.brand,
            model_name: asset.model_name,
            serial_number: asset.serial_number,
            model_detail: asset.model_detail || "",
            manufacturer: asset.manufacturer,
            invoice_number: asset.invoice_number || "",
            status: asset.status,
            remarks: asset.remarks || "",
            category: asset.category,
            location: asset.location,
            department: asset.department,
            vendor: asset.vendor || "",
        })
        setEditingId(asset.id)
        setShowForm(true)
    }

    const handleDelete = async (id) => {
        if (!confirm("Delete this asset?")) return
        await fetch(`${API}/assets/${id}/`, {
            method: "DELETE",
            headers: headers(),
        })
        fetchAssets()
    }

    const uploadDoc = async (assetId) => {
        const file = docInputRef.current?.files?.[0] || pendingDoc
        if (!file) return
        setDocUploading(true)
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`${API}/documents/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
            body: fd,
        })
        if (res.ok) {
            const doc = await res.json()
            await fetch(`${API}/assets/${assetId}/`, {
                method: "PATCH",
                headers: headers(),
                body: JSON.stringify({ documents: [doc.id] }),
            })
            setPopup("Document uploaded")
            setTimeout(() => setPopup(""), 2500)
            fetchAssets()
        }
        setDocUploading(false)
        if (docInputRef.current) docInputRef.current.value = ""
    }

    const handleDocSelect = () => {
        const file = docInputRef.current?.files?.[0]
        if (editingId) {
            uploadDoc(editingId)
        } else {
            setPendingDoc(file)
        }
    }

    const openCreate = () => {
        setForm(emptyForm)
        setEditingId(null)
        setShowForm(true)
    }

    const statusBadge = (s) => {
        const styles = {
            ACTIVE: { bg: "rgba(34,197,94,0.2)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" },
            REPAIR: { bg: "rgba(250,204,21,0.2)", color: "#eab308", border: "1px solid rgba(250,204,21,0.3)" },
            MISSING: { bg: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" },
            RETIRED: { bg: "rgba(148,163,184,0.2)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.3)" },
        }
        const st = styles[s] || styles.ACTIVE
        return <span style={{ ...st, padding: "2px 10px", borderRadius: "4px", fontSize: "0.75rem" }}>{s}</span>
    }

    // Look up the display name from a list of objects by ID
    // Handles different key names (name, vendor_name, department_name) across models
    const lookupName = (list, id) => {
        const item = list.find((i) => i.id === id)
        return item ? (item.name || item.vendor_name || item.department_name) : "-"
    }

    const groupLabel = (item) => {
        if (!groupBy) return null
        const id = item[groupBy]
        let list = []
        if (groupBy === "category") list = categories
        else if (groupBy === "department") list = departments
        else if (groupBy === "location") list = locations
        else if (groupBy === "status") return item.status || "Unknown"
        const found = list.find((i) => i.id === id)
        return found ? (found.name || found.department_name) : "Unknown"
    }

    const groupedAssets = groupBy
        ? Object.entries(
            assets.reduce((acc, a) => {
                const key = groupLabel(a) || "Unknown"
                if (!acc[key]) acc[key] = []
                acc[key].push(a)
                return acc
            }, {})
          ).sort((a, b) => a[0].localeCompare(b[0]))
        : null

    const SelectField = ({ label, name, options, valueKey, labelKey }) => (
        <div className="mb-2" style={{ flex: "1 1 200px" }}>
            <label className="form-label">{label}</label>
            <select name={name} className="form-control" value={form[name]} onChange={handleChange}>
                <option value="">-- Select --</option>
                {options.map((o) => (
                    <option key={o.id} value={o.id}>{o[labelKey || valueKey]}</option>
                ))}
            </select>
        </div>
    )

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
                }}>Assets</h1>
                {(super_admin || dept_admin || im) && <button className="btn btn-primary" onClick={openCreate}>+ New Asset</button>}
            </div>

            {(super_admin || dept_admin || im) && (
                <div className="card p-3 mb-4">
                    <div className="d-flex gap-2 mb-3">
                        <input
                            className="form-control"
                            placeholder="Search assets..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ maxWidth: 400 }}
                        />
                        <button className="btn btn-primary" onClick={handleQuickCreate}>Quick Create</button>
                        <button className="btn btn-outline-info" onClick={() => setShowScanner(true)}>
                            Scan
                        </button>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <select className="form-control" style={{ maxWidth: 180 }} value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="REPAIR">Under Repair</option>
                            <option value="MISSING">Missing</option>
                            <option value="RETIRED">Retired</option>
                        </select>
                        <select className="form-control" style={{ maxWidth: 180 }} value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}>
                            <option value="">All Categories</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <select className="form-control" style={{ maxWidth: 180 }} value={filterLocation}
                            onChange={(e) => setFilterLocation(e.target.value)}>
                            <option value="">All Locations</option>
                            {locations.map((l) => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                        <select className="form-control" style={{ maxWidth: 180 }} value={filterDepartment}
                            onChange={(e) => setFilterDepartment(e.target.value)}>
                            <option value="">All Departments</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.department_name}</option>
                            ))}
                        </select>
                        <select className="form-control" style={{ maxWidth: 160 }} value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value)}>
                            <option value="">No Grouping</option>
                            <option value="category">Group by Category</option>
                            <option value="department">Group by Department</option>
                            <option value="location">Group by Location</option>
                            <option value="status">Group by Status</option>
                        </select>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="card p-3 mb-4">
                    <h5 style={{ color: "#e2e8f0", marginBottom: "16px" }}>
                        {editingId ? "Edit Asset" : "New Asset"}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Asset Code</label>
                                <input name="asset_code" className="form-control" value={form.asset_code}
                                    onChange={handleChange} required />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Barcode</label>
                                <input name="barcode" className="form-control" value={form.barcode}
                                    onChange={handleChange} />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 250px" }}>
                                <label className="form-label">Asset Name</label>
                                <input name="asset_name" className="form-control" value={form.asset_name}
                                    onChange={handleChange} required />
                            </div>
                            <SelectField label="Category" name="category" options={categories} valueKey="name" />
                            <SelectField label="Location" name="location" options={locations} valueKey="name" />
                            <SelectField label="Department" name="department" options={departments} valueKey="department_name" />
                            <SelectField label="Vendor" name="vendor" options={vendors} valueKey="vendor_name" />
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Brand</label>
                                <input name="brand" className="form-control" value={form.brand} onChange={handleChange} required />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Model</label>
                                <input name="model_name" className="form-control" value={form.model_name} onChange={handleChange} required />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Serial No.</label>
                                <input name="serial_number" className="form-control" value={form.serial_number} onChange={handleChange} required />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Model Detail</label>
                                <input name="model_detail" className="form-control" value={form.model_detail} onChange={handleChange} />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Manufacturer</label>
                                <input name="manufacturer" className="form-control" value={form.manufacturer} onChange={handleChange} required />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Invoice No.</label>
                                <input name="invoice_number" className="form-control" value={form.invoice_number} onChange={handleChange} />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Status</label>
                                <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                                    <option value="ACTIVE">Active</option>
                                    <option value="REPAIR">Under Repair</option>
                                    <option value="MISSING">Missing</option>
                                    <option value="RETIRED">Retired</option>
                                </select>
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 100%" }}>
                                <label className="form-label">Remarks</label>
                                <textarea name="remarks" className="form-control" rows="2"
                                    value={form.remarks} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="mt-3 d-flex gap-2">
                            <button type="submit" className="btn btn-primary">
                                {editingId ? "Update" : "Create"}
                            </button>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input ref={docInputRef} type="file" style={{ display: "none" }}
                                    onChange={handleDocSelect} />
                                <button type="button" className="btn btn-outline-info" disabled={docUploading}
                                    onClick={() => docInputRef.current?.click()}>
                                    {docUploading ? "Uploading..." : pendingDoc ? "Doc Selected" : "+ Upload Doc"}
                                </button>
                            </div>
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
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Category</th>
                                <th style={thStyle}>Brand</th>
                                <th style={thStyle}>Location</th>
                                <th style={thStyle}>Department</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Remarks</th>
                                <th style={thStyle}>Docs</th>
                                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assets.length === 0 && (
                                <tr><td colSpan={10} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No assets found</td></tr>
                            )}
                            {groupedAssets ? groupedAssets.map(([group, items]) => (
                                <React.Fragment key={group}>
                                    <tr style={{ background: "rgba(6,182,212,0.06)" }}>
                                        <td colSpan={10} style={{
                                            padding: "8px 16px", fontWeight: 700,
                                            color: "#06b6d4", fontSize: "0.85rem",
                                            textTransform: "uppercase", letterSpacing: "0.5px",
                                            borderBottom: "1px solid rgba(6,182,212,0.2)",
                                        }}>
                                            {group} <span style={{ color: "#64748b", fontWeight: 400, fontSize: "0.75rem" }}>({items.length})</span>
                                        </td>
                                    </tr>
                                    {items.map((a) => (
                                        <tr key={a.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)", transition: "background 0.2s" }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(6,182,212,0.03)"}
                                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                            <td style={tdStyle}>{a.asset_code}</td>
                                            <td style={tdStyle}>{a.asset_name}</td>
                                            <td style={tdStyle}>{lookupName(categories, a.category)}</td>
                                            <td style={tdStyle}>{a.brand}</td>
                                            <td style={tdStyle}>{lookupName(locations, a.location)}</td>
                                            <td style={tdStyle}>{lookupName(departments, a.department)}</td>
                                            <td style={tdStyle}>{statusBadge(a.status)}</td>
                                            <td style={tdStyle}>{a.remarks || "—"}</td>
                                            <td style={tdStyle}>
                                                {a.documents?.length > 0 ? (
                                                    <span style={{ color: "#06b6d4", fontSize: "0.8rem", cursor: "pointer" }}
                                                        onClick={async () => {
                                                            const r = await fetch(`${API}/documents/${a.documents[0]}/download/`, {
                                                                headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
                                                            });
                                                            if (r.ok) { const b = await r.blob(); const u = URL.createObjectURL(b); const x = document.createElement("a"); x.href = u; x.download = "doc"; x.click(); URL.revokeObjectURL(u); }
                                                        }}>
                                                        📄 {a.documents.length}
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
                                                        }} onClick={() => handleEdit(a)}>Edit</button>
                                                        <button className="btn btn-sm" style={{
                                                            border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                            borderRadius: "6px", padding: "4px 12px",
                                                            fontSize: "0.8rem", background: "transparent",
                                                        }} onClick={() => handleDelete(a.id)}>Delete</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            )) : assets.map((a) => (
                                <tr key={a.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)", transition: "background 0.2s" }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(6,182,212,0.03)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                    <td style={tdStyle}>{a.asset_code}</td>
                                    <td style={tdStyle}>{a.asset_name}</td>
                                    <td style={tdStyle}>{lookupName(categories, a.category)}</td>
                                    <td style={tdStyle}>{a.brand}</td>
                                    <td style={tdStyle}>{lookupName(locations, a.location)}</td>
                                    <td style={tdStyle}>{lookupName(departments, a.department)}</td>
                                    <td style={tdStyle}>{statusBadge(a.status)}</td>
                                    <td style={tdStyle}>{a.remarks || "—"}</td>
                                    <td style={tdStyle}>
                                        {a.documents?.length > 0 ? (
                                            <span style={{ color: "#06b6d4", fontSize: "0.8rem", cursor: "pointer" }}
                                                onClick={async () => {
                                                    const r = await fetch(`${API}/documents/${a.documents[0]}/download/`, {
                                                        headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
                                                    });
                                                    if (r.ok) { const b = await r.blob(); const u = URL.createObjectURL(b); const x = document.createElement("a"); x.href = u; x.download = "doc"; x.click(); URL.revokeObjectURL(u); }
                                                }}>
                                                📄 {a.documents.length}
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
                                                }} onClick={() => handleEdit(a)}>Edit</button>
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                    borderRadius: "6px", padding: "4px 12px",
                                                    fontSize: "0.8rem", background: "transparent",
                                                }} onClick={() => handleDelete(a.id)}>Delete</button>
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
