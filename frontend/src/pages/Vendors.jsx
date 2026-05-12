// Vendors management page
// Lists all vendors with search-as-you-type and quick-create
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000/api/v1/assets"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})
const getRole = () => {
    try { return JSON.parse(localStorage.getItem("user")).role_name }
    catch { return null }
}

export default function Vendors() {
    const navigate = useNavigate()
    const [vendors, setVendors] = useState([])
    const [search, setSearch] = useState("")
    const [popup, setPopup] = useState("")

    const handleUnauth = () => {
        localStorage.clear()
        navigate("/")
    }

    const handleResponse = (r) => {
        if (r.status === 401) { handleUnauth(); throw new Error("Unauthorized") }
        return r.json()
    }

    // Fetch with optional ?search= param — handled by backend SearchFilter
    const fetchVendors = () => {
        const params = new URLSearchParams()
        if (search.trim()) params.set("search", search.trim())
        const qs = params.toString()
        const url = `${API}/vendors/${qs ? `?${qs}` : ""}`
        fetch(url, { headers: headers() })
            .then(handleResponse)
            .then((d) => setVendors(d.results))
            .catch(() => {})
    }

    useEffect(() => { fetchVendors() }, [])

    // Debounced search — waits 300ms after the user stops typing
    useEffect(() => {
        const timer = setTimeout(() => fetchVendors(), 300)
        return () => clearTimeout(timer)
    }, [search])

    // Quick-create a vendor from the search input text
    const handleCreate = async () => {
        if (!search.trim()) return
        const res = await fetch(`${API}/vendors/add/`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ vendor_name: search.trim() }),
        })
        if (res.ok) {
            setPopup("New vendor created")
            setSearch("")
            fetchVendors()
            setTimeout(() => setPopup(""), 2500)
        }
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
                }}>Vendors</h1>
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
                    <table className="table" style={{ minWidth: "600px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                <th style={thStyle}>Vendor Name</th>
                                <th style={thStyle}>Contact Person</th>
                                <th style={thStyle}>Email</th>
                                <th style={thStyle}>Phone</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vendors.length === 0 && (
                                <tr><td colSpan={4} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No vendors found</td></tr>
                            )}
                            {vendors.map((v) => (
                                <tr key={v.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                                    <td style={tdStyle}>{v.vendor_name}</td>
                                    <td style={tdStyle}>{v.contact_person}</td>
                                    <td style={tdStyle}>{v.email}</td>
                                    <td style={tdStyle}>{v.phone}</td>
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
