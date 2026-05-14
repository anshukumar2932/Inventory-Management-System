// Main asset management page
// Lists assets in a table with search, filter, and full CRUD
import React, { useState, useEffect, useRef, useCallback } from "react"
import BarcodeScanner from "../components/BarcodeScanner"
import Pagination from "../components/Pagination"
import { API_BASE, apiGet, apiPost, apiPatch, apiPut, apiDelete, apiUpload } from "../lib/api"
import { getRole } from "../lib/auth"

// Assets API base — note the double "assets" comes from the router prefix
const API = `${API_BASE}/api/v1/assets`

const SVC_API = `${API_BASE}/api/v1/assets/asset-services`

const emptyForm = {
    asset_code: "", barcode: "", asset_name: "", brand: "", model_name: "",
    serial_number: "", model_detail: "", manufacturer: "",
    invoice_number: "", status: "PROCUREMENT",
    category: "", location: "", department: "", vendor: "",
    remarks: "",
}

export default function Assets() {
    const [assets, setAssets] = useState([])
    // Lookup lists for rendering names instead of IDs in the table
    const [categories, setCategories] = useState([])
    const [locations, setLocations] = useState([])
    const [departments, setDepartments] = useState([])
    const [vendors, setVendors] = useState([])
    const [serviceTypes, setServiceTypes] = useState([])
    const [availabilities, setAvailabilities] = useState([])
    const [formServices, setFormServices] = useState([])
    const servicesToDelete = useRef([])
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [search, setSearch] = useState("")
    // Filter dropdowns — each maps to a query param the backend understands
    const [filterStatus, setFilterStatus] = useState("")
    const [filterCategory, setFilterCategory] = useState("")
    const [filterLocation, setFilterLocation] = useState("")
    const [filterDepartment, setFilterDepartment] = useState("")
    const [groupBy, setGroupBy] = useState("")
    const [popup, setPopup] = useState("")
    const [showScanner, setShowScanner] = useState(false)
    const [detailAsset, setDetailAsset] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [editingId, setEditingId] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState("")
    const [docUploading, setDocUploading] = useState(false)
    const [pendingDoc, setPendingDoc] = useState(null)
    const docInputRef = useRef(null)
    const role = getRole()
    const super_admin = role ==='SUPER_ADMIN'
    const dept_admin = role === "DEPARTMENT_ADMIN"
    const im= role==="MANAGER"

    // Build the URL with all active search/filter params
    // The backend's SearchFilter + DjangoFilterBackend handle these automatically
    const buildUrl = () => {
        const params = new URLSearchParams()
        params.set("page", page)
        params.set("approval_status", "APPROVED")
        if (search.trim()) params.set("search", search.trim())
        if (filterStatus) params.set("status", filterStatus)
        if (filterCategory) params.set("category", filterCategory)
        if (filterLocation) params.set("location", filterLocation)
        if (filterDepartment) params.set("department", filterDepartment)
        return `${API}/assets/?${params.toString()}`
    }

    const fetchAssets = () =>
        apiGet(buildUrl())
            .then((r) => r.json())
            .then((d) => {
                setAssets(d.results)
                setTotalCount(d.count)
                setTotalPages(Math.ceil(d.count / 20) || 1)
            })

    const fetchLookups = () => {
        apiGet(`${API}/categories/`).then(r => r.json()).then(c => setCategories(c.results || c)).catch(() => {})
        apiGet(`${API}/locations/`).then(r => r.json()).then(l => setLocations(l.results || l)).catch(() => {})
        apiGet(`${API_BASE}/api/v1/auth/departments/`).then(r => r.json()).then(d => setDepartments(d.results || d)).catch(() => {})
        apiGet(`${API_BASE}/api/v1/vendors/`).then(r => r.json()).then(v => setVendors(v.results || v)).catch(() => {})
        apiGet(`${API}/service-types/`).then(r => r.json()).then(st => setServiceTypes(st.results || st)).catch(() => {})
        apiGet(`${API}/availabilities/`).then(r => r.json()).then(av => setAvailabilities(av.results || av)).catch(() => {})
    }

    useEffect(() => {
        fetchAssets()
        fetchLookups()
    }, [])

    // Debounced refetch when search or filters change
    useEffect(() => {
        setPage(1)
    }, [search, filterStatus, filterCategory, filterLocation, filterDepartment])

    useEffect(() => {
        fetchAssets()
    }, [page, search, filterStatus, filterCategory, filterLocation, filterDepartment])

    let localKeyCounter = 0
    const nextLocalKey = () => `svc_${++localKeyCounter}_${Date.now()}`

    const emptyService = () => ({
        _key: nextLocalKey(), id: null, service_type: "", provider: "",
        availability: "", start_date: "", end_date: "",
        status: "ACTIVE", remarks: "",
    })

    const addFormService = () => setFormServices([...formServices, emptyService()])

    const updateFormService = (key, field, value) =>
        setFormServices(formServices.map(s => s._key === key ? { ...s, [field]: value } : s))

    const loadAssetServices = async (assetId) => {
        const res = await apiGet(`${SVC_API}/?asset=${assetId}`)
        if (!res.ok) return
        const d = await res.json()
        const list = (d.results || d).map(s => ({
            _key: `svc_${s.id}`, id: s.id,
            service_type: s.service_type, provider: s.provider || "",
            availability: s.availability || "",
            start_date: s.start_date, end_date: s.end_date,
            status: s.status, remarks: s.remarks || "",
        }))
        setFormServices(list)
    }

    const handleQuickCreate = async () => {
        if (!search.trim()) return
        const res = await apiPost(`${API}/assets/add/`, { asset_name: search.trim() })
        if (res.ok) {
            setPopup("New asset created")
            setSearch("")
            fetchAssets()
            setTimeout(() => setPopup(""), 2500)
        }
    }

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value })

    const saveServices = async (assetId) => {
        const results = []
        for (const svc of formServices) {
            const body = {
                asset: assetId, service_type: parseInt(svc.service_type),
                provider: svc.provider ? parseInt(svc.provider) : null,
                availability: svc.availability ? parseInt(svc.availability) : null,
                start_date: svc.start_date, end_date: svc.end_date,
                status: svc.status, remarks: svc.remarks || "",
            }
            const url = svc.id ? `${SVC_API}/${svc.id}/` : `${SVC_API}/`
            const res = svc.id ? await apiPatch(url, body) : await apiPost(url, body)
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                results.push(`Service #${formServices.indexOf(svc) + 1}: ${Object.values(data).flat().join(", ")}`)
            }
        }
        return results
    }

    const removeFormService = (key) => {
        const svc = formServices.find(s => s._key === key)
        if (svc?.id) servicesToDelete.current.push(svc.id)
        setFormServices(formServices.filter(s => s._key !== key))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setFormError("")

        if (!form.asset_name.trim()) {
            setFormError("Asset name is required")
            setSaving(false)
            return
        }

        const body = { ...form }
        body.remarks = body.remarks || ""
        body.category = parseInt(body.category)
        body.location = parseInt(body.location)
        body.department = parseInt(body.department)
        body.vendor = body.vendor ? parseInt(body.vendor) : null

        const url = editingId
            ? `${API}/assets/${editingId}/`
            : `${API}/assets/`

        const res = editingId ? await apiPut(url, body) : await apiPost(url, body)
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            setFormError(Object.values(data).flat().join(", ") || "Failed to save asset")
            setSaving(false)
            return
        }

        const asset = await res.json()
        const assetId = asset.id || editingId

        for (const id of servicesToDelete.current) {
            await apiDelete(`${SVC_API}/${id}/`)
        }
        servicesToDelete.current = []

        // Save services — collect any errors
        if (formServices.length > 0) {
            const svcErrors = await saveServices(assetId)
            if (svcErrors.length > 0) {
                setFormError("Asset saved but some services failed: " + svcErrors.join("; "))
                setSaving(false)
                return
            }
        }

        if (!editingId && pendingDoc) {
            await uploadDoc(assetId)
            setPendingDoc(null)
        }
        setShowForm(false)
        setEditingId(null)
        setForm(emptyForm)
        setFormServices([])
        setSaving(false)
        fetchAssets()
        setPopup("Asset saved")
        setTimeout(() => setPopup(""), 2500)
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
        loadAssetServices(asset.id)
    }

    const handleDelete = async (id) => {
        if (!confirm("Delete this asset?")) return
        await apiDelete(`${API}/assets/${id}/`)
        fetchAssets()
    }

    const handleView = async (id) => {
        setDetailLoading(true)
        setDetailAsset(null)

        try {
            const res = await apiGet(`${API}/assets/${id}/`)
            if (!res.ok) return
            const data = await res.json()
            setDetailAsset(data)
        } catch (err) {
            console.error("Failed to load asset detail:", err)
        } finally {
            setDetailLoading(false)
        }
    }

    const uploadDoc = async (assetId) => {
        const file = docInputRef.current?.files?.[0] || pendingDoc
        if (!file) return
        setDocUploading(true)
        const fd = new FormData()
        fd.append("file", file)
        const res = await apiUpload(`${API}/documents/`, fd)
        if (res.ok) {
            const doc = await res.json()
            await apiPatch(`${API}/assets/${assetId}/`, { documents: [doc.id] })
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
        setFormServices([])
        setShowForm(true)
    }

    const statusBadge = (s) => {
        const styles = {
            PROCUREMENT: { bg: "rgba(59,130,246,0.2)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" },
            ACTIVE: { bg: "rgba(34,197,94,0.2)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" },
            REPAIR: { bg: "rgba(250,204,21,0.2)", color: "#eab308", border: "1px solid rgba(250,204,21,0.3)" },
            MISSING: { bg: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" },
            RETIRED: { bg: "rgba(148,163,184,0.2)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.3)" },
            BLOCKED: { bg: "rgba(249,115,22,0.2)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" },
        }
        const st = styles[s] || styles.BLOCKED
        return <span style={{ ...st, padding: "2px 10px", borderRadius: "4px", fontSize: "0.75rem" }}>{s}</span>
    }

    const renderActiveServices = (asset) => {
        if (!Array.isArray(asset.active_services) || asset.active_services.length === 0) {
            return <span style={{ color: "#64748b" }}>-</span>
        }

        return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {asset.active_services.map((serviceName) => (
                    <span key={`${asset.id}-${serviceName}`} style={{
                        background: "rgba(34,197,94,0.12)",
                        color: "#86efac",
                        border: "1px solid rgba(34,197,94,0.22)",
                        borderRadius: "999px",
                        padding: "2px 8px",
                        fontSize: "0.72rem",
                        lineHeight: 1.4,
                        whiteSpace: "nowrap",
                    }}>
                        {serviceName}
                    </span>
                ))}
            </div>
        )
    }

    // Look up the display name from a list of objects by ID
    // Handles different key names (name, vendor_name, department_name) across models
    const lookupName = (list, id) => {
        if (!id) return "-"
        const item = list.find((i) => i.id == id)
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
                            <option value="PROCUREMENT">Under Procurement</option>
                            <option value="ACTIVE">Active</option>
                            <option value="REPAIR">Under Repair</option>
                            <option value="MISSING">Missing</option>
                            <option value="RETIRED">Retired</option>
                            <option value="BLOCKED">Blocked</option>
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
                    {formError && (
                        <div style={{
                            background: "rgba(239,68,68,0.1)", color: "#ef4444",
                            padding: "8px 12px", borderRadius: 6, marginBottom: 12,
                            fontSize: "0.85rem",
                        }}>{formError}</div>
                    )}
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
                                    <option value="PROCUREMENT">Under Procurement</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="REPAIR">Under Repair</option>
                                    <option value="MISSING">Missing</option>
                                    <option value="RETIRED">Retired</option>
                                    <option value="BLOCKED">Blocked</option>
                                </select>
                            </div>
                            <div className="mb-2" style={{ flex: "1 1 100%" }}>
                                <label className="form-label">Remarks</label>
                                <textarea name="remarks" className="form-control" rows="2"
                                    value={form.remarks} onChange={handleChange} />
                            </div>
                        </div>

                        <hr style={{ borderColor: "rgba(148,163,184,0.15)", margin: "16px 0" }} />
                        <h6 style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.75rem", marginBottom: "10px" }}>
                            Services ({formServices.length})
                        </h6>
                        {formServices.map((svc, idx) => (
                            <div key={svc._key} style={{
                                padding: "10px", marginBottom: "8px",
                                border: "1px solid rgba(148,163,184,0.12)", borderRadius: "8px",
                            }}>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600 }}>Service #{idx + 1}</span>
                                    <button type="button" className="btn btn-sm" style={{
                                        border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                    }} onClick={() => removeFormService(svc._key)}>Remove</button>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                                    <div style={{ flex: "1 1 200px" }}>
                                        <label className="form-label" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Service Type</label>
                                        <select className="form-control form-control-sm" value={svc.service_type}
                                            onChange={(e) => updateFormService(svc._key, "service_type", e.target.value)} required>
                                            <option value="">-- Select --</option>
                                            {serviceTypes.map((st) => (
                                                <option key={st.id} value={st.id}>{st.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ flex: "1 1 200px" }}>
                                        <label className="form-label" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Provider</label>
                                        <select className="form-control form-control-sm" value={svc.provider}
                                            onChange={(e) => updateFormService(svc._key, "provider", e.target.value)}>
                                            <option value="">-- None --</option>
                                            {vendors.map((v) => (
                                                <option key={v.id} value={v.id}>{v.vendor_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ flex: "1 1 200px" }}>
                                        <label className="form-label" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Availability</label>
                                        <select className="form-control form-control-sm" value={svc.availability}
                                            onChange={(e) => updateFormService(svc._key, "availability", e.target.value)}>
                                            <option value="">-- Select --</option>
                                            {availabilities.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ flex: "0 1 150px" }}>
                                        <label className="form-label" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Start Date</label>
                                        <input type="date" className="form-control form-control-sm" value={svc.start_date}
                                            onChange={(e) => updateFormService(svc._key, "start_date", e.target.value)} required />
                                    </div>
                                    <div style={{ flex: "0 1 150px" }}>
                                        <label className="form-label" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>End Date</label>
                                        <input type="date" className="form-control form-control-sm" value={svc.end_date}
                                            onChange={(e) => updateFormService(svc._key, "end_date", e.target.value)} required />
                                    </div>
                                    <div style={{ flex: "0 1 130px" }}>
                                        <label className="form-label" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Status</label>
                                        <select className="form-control form-control-sm" value={svc.status}
                                            onChange={(e) => updateFormService(svc._key, "status", e.target.value)}>
                                            <option value="ACTIVE">Active</option>
                                            <option value="EXPIRED">Expired</option>
                                            <option value="PENDING">Pending</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: "1 1 200px" }}>
                                        <label className="form-label" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Remarks</label>
                                        <input className="form-control form-control-sm" value={svc.remarks}
                                            onChange={(e) => updateFormService(svc._key, "remarks", e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button type="button" className="btn btn-sm mb-3" style={{
                            border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                            borderRadius: "6px", padding: "4px 14px", background: "transparent",
                        }} onClick={addFormService}>+ Add Service</button>

                        <div className="mt-3 d-flex gap-2">
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? "Saving..." : editingId ? "Update" : "Create"}
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
                            }} onClick={() => { setShowForm(false); setEditingId(null); setFormServices([]); servicesToDelete.current = []; setFormError(""); }} disabled={saving}>
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
                                <th style={thStyle}>Active Services</th>
                                <th style={thStyle}>Remarks</th>
                                <th style={thStyle}>Docs</th>
                                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assets.length === 0 && (
                                <tr><td colSpan={11} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No assets found</td></tr>
                            )}
                            {groupedAssets ? groupedAssets.map(([group, items]) => (
                                <React.Fragment key={group}>
                                    <tr style={{ background: "rgba(6,182,212,0.06)" }}>
                                        <td colSpan={11} style={{
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
                                            <td style={tdStyle}>{renderActiveServices(a)}</td>
                                            <td style={tdStyle}>{a.remarks || "—"}</td>
                                            <td style={tdStyle}>
                                                {a.documents?.length > 0 ? (
                                                    <span style={{ color: "#06b6d4", fontSize: "0.8rem", cursor: "pointer" }}
                                                        onClick={async () => {
                                                            const r = await apiGet(`${API}/documents/${a.documents[0]}/download/`);
                                                            if (r.ok) { const b = await r.blob(); const u = URL.createObjectURL(b); const x = document.createElement("a"); x.href = u; x.download = "doc"; x.click(); URL.revokeObjectURL(u); }
                                                        }}>
                                                        📄 {a.documents.length}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: "center" }}>
                                                <button className="btn btn-sm" style={{
                                                    border: "1px solid rgba(148,163,184,0.3)", color: "#e2e8f0",
                                                    borderRadius: "6px", padding: "4px 12px", marginRight: "6px",
                                                    fontSize: "0.8rem", background: "transparent",
                                                }} onClick={() => handleView(a.id)}>View</button>
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
                                    <td style={tdStyle}>{renderActiveServices(a)}</td>
                                    <td style={tdStyle}>{a.remarks || "—"}</td>
                                    <td style={tdStyle}>
                                        {a.documents?.length > 0 ? (
                                            <span style={{ color: "#06b6d4", fontSize: "0.8rem", cursor: "pointer" }}
                                                onClick={async () => {
                                                    const r = await apiGet(`${API}/documents/${a.documents[0]}/download/`);
                                                    if (r.ok) { const b = await r.blob(); const u = URL.createObjectURL(b); const x = document.createElement("a"); x.href = u; x.download = "doc"; x.click(); URL.revokeObjectURL(u); }
                                                }}>
                                                📄 {a.documents.length}
                                            </span>
                                        ) : "—"}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: "center" }}>
                                        <button className="btn btn-sm" style={{
                                            border: "1px solid rgba(148,163,184,0.3)", color: "#e2e8f0",
                                            borderRadius: "6px", padding: "4px 12px", marginRight: "6px",
                                            fontSize: "0.8rem", background: "transparent",
                                        }} onClick={() => handleView(a.id)}>View</button>
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

            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onPageChange={setPage} />

            {showScanner && (
                <BarcodeScanner
                    onScan={(asset) => {
                        setShowScanner(false)
                        setSearch(asset.asset_code)
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}

            {(detailLoading || detailAsset) && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(2,6,23,0.72)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 9999, padding: "24px",
                }} onClick={() => { if (!detailLoading) setDetailAsset(null) }}>
                    <div style={{
                        width: "min(760px, 100%)", maxHeight: "85vh", overflowY: "auto",
                        background: "#0f172a", border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: "14px", padding: "20px 22px",
                    }} onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <div style={{ color: "#64748b", fontSize: "0.8rem", textTransform: "uppercase" }}>Asset Detail</div>
                                <h4 style={{ color: "#e2e8f0", margin: "4px 0 0 0" }}>
                                    {detailAsset?.asset_name || "Loading..."}
                                </h4>
                            </div>
                            <button className="btn btn-sm" style={{
                                border: "1px solid rgba(148,163,184,0.25)", color: "#94a3b8",
                                borderRadius: "6px", padding: "4px 10px", background: "transparent",
                            }} onClick={() => setDetailAsset(null)} disabled={detailLoading}>Close</button>
                        </div>

                        {detailLoading && (
                            <div style={{ color: "#94a3b8", padding: "24px 0" }}>Loading asset details...</div>
                        )}

                        {detailAsset && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px 18px" }}>
                                <DetailField label="Asset Code" value={detailAsset.asset_code} />
                                <DetailField label="Barcode" value={detailAsset.barcode} />
                                <DetailField label="Status" value={detailAsset.status} />
                                <DetailField label="Approval" value={detailAsset.approval_status} />
                                <DetailField label="Category" value={detailAsset.category_name} />
                                <DetailField label="Department" value={detailAsset.department_name} />
                                <DetailField label="Location" value={detailAsset.location_name} />
                                <DetailField label="Brand" value={detailAsset.brand} />
                                <DetailField label="Model" value={detailAsset.model_name} />
                                <DetailField label="Model Detail" value={detailAsset.model_detail} />
                                <DetailField label="Manufacturer" value={detailAsset.manufacturer} />
                                <DetailField label="Serial Number" value={detailAsset.serial_number} />
                                <DetailField label="Invoice Number" value={detailAsset.invoice_number} />
                                <DetailField label="Created" value={detailAsset.created_at ? new Date(detailAsset.created_at).toLocaleString() : "—"} />
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <DetailField label="Remarks" value={detailAsset.remarks} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}

function DetailField({ label, value }) {
    return (
        <div>
            <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "4px" }}>
                {label}
            </div>
            <div style={{ color: "#e2e8f0", fontSize: "0.92rem", lineHeight: 1.4 }}>
                {value || "—"}
            </div>
        </div>
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
