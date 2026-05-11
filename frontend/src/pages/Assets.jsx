import { useState, useEffect } from "react"

const API = "http://localhost:8000/api"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

const emptyForm = {
    asset_code: "", barcode: "", asset_name: "", brand: "", model_name: "",
    purchase_cost: "", serial_number: "", model_number: "", manufacturer: "",
    invoice_number: "", status: "ACTIVE", service_type: "NONE",
    service_start: "", service_end: "",
    category: "", location: "", department: "", vendor: "",
}

export default function Assets() {
    const [assets, setAssets] = useState([])
    const [categories, setCategories] = useState([])
    const [locations, setLocations] = useState([])
    const [departments, setDepartments] = useState([])
    const [vendors, setVendors] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [editingId, setEditingId] = useState(null)
    const [showForm, setShowForm] = useState(false)

    const fetchAssets = () =>
        fetch(`${API}/assets/`, { headers: headers() })
            .then((r) => r.json())
            .then(setAssets)

    const fetchLookups = () =>
        Promise.all([
            fetch(`${API}/categories/`, { headers: headers() }).then((r) => r.json()),
            fetch(`${API}/locations/`, { headers: headers() }).then((r) => r.json()),
            fetch(`${API}/departments/`, { headers: headers() }).then((r) => r.json()),
            fetch(`${API}/vendors/`, { headers: headers() }).then((r) => r.json()),
        ]).then(([c, l, d, v]) => {
            setCategories(c)
            setLocations(l)
            setDepartments(d)
            setVendors(v)
        })

    useEffect(() => {
        fetchAssets()
        fetchLookups()
    }, [])

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value })

    const handleSubmit = async (e) => {
        e.preventDefault()
        const body = { ...form }
        body.purchase_cost = parseFloat(body.purchase_cost) || 0
        body.service_start = body.service_start || null
        body.service_end = body.service_end || null
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
            purchase_cost: asset.purchase_cost,
            serial_number: asset.serial_number,
            model_number: asset.model_number || "",
            manufacturer: asset.manufacturer,
            invoice_number: asset.invoice_number || "",
            status: asset.status,
            service_type: asset.service_type,
            service_start: asset.service_start || "",
            service_end: asset.service_end || "",
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

    const lookupName = (list, id) => {
        const item = list.find((i) => i.id === id)
        return item ? (item.name || item.vendor_name || item.department_name) : "-"
    }

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
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Assets</h1>
                <button className="btn btn-primary" onClick={openCreate}>+ New Asset</button>
            </div>

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
                                <label className="form-label">Model No.</label>
                                <input name="model_number" className="form-control" value={form.model_number} onChange={handleChange} />
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
                                <label className="form-label">Purchase Cost</label>
                                <input name="purchase_cost" type="number" step="0.01" className="form-control"
                                    value={form.purchase_cost} onChange={handleChange} required />
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
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Service Type</label>
                                <select name="service_type" className="form-control" value={form.service_type} onChange={handleChange}>
                                    <option value="NONE">None</option>
                                    <option value="WARRANTY">Warranty</option>
                                    <option value="AMC">AMC</option>
                                </select>
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Service Start</label>
                                <input name="service_start" type="date" className="form-control"
                                    value={form.service_start} onChange={handleChange} />
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 200px" }}>
                                <label className="form-label">Service End</label>
                                <input name="service_end" type="date" className="form-control"
                                    value={form.service_end} onChange={handleChange} />
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
                    <table className="table" style={{ minWidth: "1000px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Category</th>
                                <th style={thStyle}>Brand</th>
                                <th style={thStyle}>Location</th>
                                <th style={thStyle}>Department</th>
                                <th style={thStyle}>Cost</th>
                                <th style={thStyle}>Status</th>
                                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assets.length === 0 && (
                                <tr><td colSpan={9} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No assets found</td></tr>
                            )}
                            {assets.map((a) => (
                                <tr key={a.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)", transition: "background 0.2s" }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(6,182,212,0.03)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                    <td style={tdStyle}>{a.asset_code}</td>
                                    <td style={tdStyle}>{a.asset_name}</td>
                                    <td style={tdStyle}>{lookupName(categories, a.category)}</td>
                                    <td style={tdStyle}>{a.brand}</td>
                                    <td style={tdStyle}>{lookupName(locations, a.location)}</td>
                                    <td style={tdStyle}>{lookupName(departments, a.department)}</td>
                                    <td style={tdStyle}>${parseFloat(a.purchase_cost).toFixed(2)}</td>
                                    <td style={tdStyle}>{statusBadge(a.status)}</td>
                                    <td style={{ ...tdStyle, textAlign: "center" }}>
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
