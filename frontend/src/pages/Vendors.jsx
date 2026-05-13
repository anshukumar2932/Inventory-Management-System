import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000/api/v1/assets"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

export default function Vendors() {
    const navigate = useNavigate()
    const [vendors, setVendors] = useState([])
    const [search, setSearch] = useState("")
    const [detail, setDetail] = useState(null)

    const handleUnauth = () => {
        localStorage.clear()
        navigate("/")
    }

    const fetchVendors = () => {
        const params = new URLSearchParams()
        if (search.trim()) params.set("search", search.trim())
        const qs = params.toString()
        const url = `${API}/vendors/${qs ? `?${qs}` : ""}`
        fetch(url, { headers: headers() })
            .then((r) => {
                if (r.status === 401) { handleUnauth(); throw new Error("Unauthorized") }
                return r.json()
            })
            .then((d) => setVendors(d.results))
            .catch(() => {})
    }

    useEffect(() => { fetchVendors() }, [])

    useEffect(() => {
        const timer = setTimeout(() => fetchVendors(), 300)
        return () => clearTimeout(timer)
    }, [search])

    return (
        <>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Vendors</h1>
                <button className="btn btn-primary" onClick={() => navigate("/vendors/new")}>
                    + Add Vendor
                </button>
            </div>

            <div className="card p-3 mb-4">
                <div className="d-flex gap-2">
                    <input
                        className="form-control"
                        placeholder="Search vendors..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ maxWidth: 400 }}
                    />
                </div>
            </div>

            <div className="card p-0" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ minWidth: "1200px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Contact</th>
                                <th style={thStyle}>Email / Phone</th>
                                <th style={thStyle}>Address</th>
                                <th style={thStyle}>GST</th>
                                <th style={thStyle}>Services</th>
                                <th style={thStyle}>Supp. Categories</th>
                                <th style={thStyle}>Category</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vendors.length === 0 && (
                                <tr><td colSpan={8} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No vendors found</td></tr>
                            )}
                            {vendors.map((v) => (
                                <tr key={v.id}
                                    onClick={() => setDetail(v)}
                                    style={{ borderBottom: "1px solid rgba(148,163,184,0.05)", cursor: "pointer" }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(148,163,184,0.05)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                >
                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{v.vendor_name}</td>
                                    <td style={tdStyle}>{v.contact_person || "—"}</td>
                                    <td style={tdStyle}>
                                        <div>{v.email}</div>
                                        <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{v.phone || "—"}</div>
                                    </td>
                                    <td style={{ ...tdStyle, maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.address || "—"}</td>
                                    <td style={tdStyle}>{v.gst_number || "—"}</td>
                                    <td style={tdStyle}>
                                        {v.service_names?.length
                                            ? v.service_names.slice(0, 2).join(", ") + (v.service_names.length > 2 ? ` +${v.service_names.length - 2}` : "")
                                            : "—"}
                                    </td>
                                    <td style={tdStyle}>
                                        {v.category_names?.length
                                            ? v.category_names.slice(0, 2).join(", ") + (v.category_names.length > 2 ? ` +${v.category_names.length - 2}` : "")
                                            : "—"}
                                    </td>
                                    <td style={tdStyle}>{v.vendor_category_name || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {detail && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)", zIndex: 9999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                }} onClick={() => setDetail(null)}>
                    <div style={{
                        background: "#1e293b", borderRadius: "12px",
                        border: "1px solid rgba(148,163,184,0.2)",
                        maxWidth: "600px", width: "90%", maxHeight: "80vh", overflowY: "auto",
                        padding: "24px",
                    }} onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h4 style={{ color: "#e2e8f0", margin: 0 }}>{detail.vendor_name}</h4>
                            <button onClick={() => setDetail(null)}
                                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                            <div>
                                <Label>Category</Label>
                                <Value>{detail.vendor_category_name || "—"}</Value>
                            </div>
                            <div>
                                <Label>Contact Person</Label>
                                <Value>{detail.contact_person || "—"}</Value>
                            </div>
                            <div>
                                <Label>Email</Label>
                                <Value>{detail.email}</Value>
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <Value>{detail.phone || "—"}</Value>
                            </div>
                            <div>
                                <Label>Alternate Phone</Label>
                                <Value>{detail.alternate_phone || "—"}</Value>
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                                <Label>Address</Label>
                                <Value>{detail.address || "—"}</Value>
                            </div>
                            <div>
                                <Label>GST Number</Label>
                                <Value>{detail.gst_number || "—"}</Value>
                            </div>
                            <div>
                                <Label>PAN Number</Label>
                                <Value>{detail.pan_number || "—"}</Value>
                            </div>
                            <div>
                                <Label>Services</Label>
                                <Value>{detail.service_names?.length ? detail.service_names.join(", ") : "—"}</Value>
                            </div>
                            <div>
                                <Label>Supported Categories</Label>
                                <Value>{detail.category_names?.length ? detail.category_names.join(", ") : "—"}</Value>
                            </div>
                            <div>
                                <Label>Served Companies</Label>
                                <Value>{detail.company_names?.length ? detail.company_names.join(", ") : "—"}</Value>
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                                <Label>Remarks</Label>
                                <Value>{detail.remarks || "—"}</Value>
                            </div>
                        </div>

                        <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(148,163,184,0.1)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                <div>
                                    <Label>Created</Label>
                                    <Value>{new Date(detail.created_at).toLocaleDateString()}</Value>
                                </div>
                                <div>
                                    <Label>Updated</Label>
                                    <Value>{new Date(detail.updated_at).toLocaleDateString()}</Value>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

const Label = ({ children }) => (
    <div style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{children}</div>
)
const Value = ({ children }) => (
    <div style={{ color: "#e2e8f0", fontSize: "0.875rem" }}>{children}</div>
)
const thStyle = {
    color: "#64748b", fontWeight: 600, fontSize: "0.8rem",
    textTransform: "uppercase", letterSpacing: "0.5px",
    padding: "12px 16px", borderBottom: "1px solid rgba(148,163,184,0.1)",
}
const tdStyle = {
    color: "#e2e8f0", fontSize: "0.875rem",
    padding: "12px 16px", verticalAlign: "middle",
}
