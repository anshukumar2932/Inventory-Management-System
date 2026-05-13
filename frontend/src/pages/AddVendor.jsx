import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000/api/v1/assets"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

const STATUS_OPTIONS = ["PENDING", "ACTIVE", "INACTIVE", "BLACKLISTED"]

export default function AddVendor() {
    const navigate = useNavigate()
    const [form, setForm] = useState({
        vendor_name: "",
        contact_person: "",
        email: "",
        phone: "",
        alternate_phone: "",
        address: "",
        gst_number: "",
        pan_number: "",
        status: "PENDING",
        rating: "",
        services: "",
        supported_categories: "",
        served_companies: "",
        remarks: "",
    })
    const [error, setError] = useState("")

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        if (!form.vendor_name.trim()) {
            setError("Vendor name is required")
            return
        }
        const body = { ...form }
        if (!body.rating) delete body.rating
        const res = await fetch(`${API}/vendors/add/`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(body),
        })
        if (res.status === 401) {
            localStorage.clear()
            navigate("/")
            return
        }
        if (res.ok) {
            navigate("/vendors")
        } else {
            const data = await res.json()
            setError(data.error || data.email?.[0] || "Failed to create vendor")
        }
    }

    const inputStyle = {
        background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)",
        color: "#e2e8f0", fontSize: "0.875rem",
    }

    return (
        <>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Add Vendor</h1>
            </div>

            <div className="card p-4" style={{ maxWidth: 800 }}>
                {error && (
                    <div className="alert alert-danger py-2" style={{ fontSize: "0.85rem" }}>{error}</div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Vendor Name *</label>
                            <input className="form-control" name="vendor_name" value={form.vendor_name} onChange={handleChange} required style={inputStyle} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Status</label>
                            <select className="form-control" name="status" value={form.status} onChange={handleChange} style={inputStyle}>
                                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Contact Person</label>
                            <input className="form-control" name="contact_person" value={form.contact_person} onChange={handleChange} style={inputStyle} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Email</label>
                            <input className="form-control" name="email" type="email" value={form.email} onChange={handleChange} style={inputStyle} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Phone</label>
                            <input className="form-control" name="phone" value={form.phone} onChange={handleChange} style={inputStyle} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Alternate Phone</label>
                            <input className="form-control" name="alternate_phone" value={form.alternate_phone} onChange={handleChange} style={inputStyle} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">GST Number</label>
                            <input className="form-control" name="gst_number" value={form.gst_number} onChange={handleChange} style={inputStyle} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">PAN Number</label>
                            <input className="form-control" name="pan_number" value={form.pan_number} onChange={handleChange} style={inputStyle} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Rating (0.0 - 5.0)</label>
                            <input className="form-control" name="rating" type="number" step="0.1" min="0" max="5" value={form.rating} onChange={handleChange} style={inputStyle} />
                        </div>
                        <div className="col-12 mb-3">
                            <label className="form-label">Address</label>
                            <textarea className="form-control" name="address" value={form.address} onChange={handleChange} rows="2" style={inputStyle} />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Services <small style={{color:"#64748b"}}>(comma separated)</small></label>
                            <input className="form-control" name="services" value={form.services} onChange={handleChange} placeholder="e.g. IT Support, Cloud" style={inputStyle} />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Supported Categories <small style={{color:"#64748b"}}>(comma separated)</small></label>
                            <input className="form-control" name="supported_categories" value={form.supported_categories} onChange={handleChange} placeholder="e.g. Electronics, Furniture" style={inputStyle} />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Served Companies <small style={{color:"#64748b"}}>(comma separated)</small></label>
                            <input className="form-control" name="served_companies" value={form.served_companies} onChange={handleChange} placeholder="e.g. Acme Corp, Globex" style={inputStyle} />
                        </div>
                        <div className="col-12 mb-3">
                            <label className="form-label">Remarks</label>
                            <textarea className="form-control" name="remarks" value={form.remarks} onChange={handleChange} rows="2" style={inputStyle} />
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary">Save</button>
                        <button type="button" className="btn btn-secondary" onClick={() => navigate("/vendors")}>Cancel</button>
                    </div>
                </form>
            </div>
        </>
    )
}
