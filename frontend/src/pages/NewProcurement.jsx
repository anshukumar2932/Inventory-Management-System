import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000/api/v1"
const ASSETS_API = "http://localhost:8000/api/v1/assets"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

export default function NewProcurement() {
    const navigate = useNavigate()
    const [departments, setDepartments] = useState([])
    const [department, setDepartment] = useState("")
    const [assetNames, setAssetNames] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        fetch(`${API}/auth/departments/`, { headers: headers() })
            .then((r) => r.json())
            .then((d) => setDepartments(d.results || d))
            .catch(() => navigate("/"))
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!department || !assetNames.trim()) {
            setError("Department and at least one asset name are required")
            return
        }
        setSubmitting(true)
        setError("")

        const names = assetNames.split("\n").map((s) => s.trim()).filter(Boolean)

        const res = await fetch(`${API}/procurements/`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ department: parseInt(department) }),
        })

        if (!res.ok) {
            const d = await res.json()
            setError(JSON.stringify(d))
            setSubmitting(false)
            return
        }

        const procurement = await res.json()

        for (const name of names) {
            await fetch(`${ASSETS_API}/assets/`, {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    asset_code: `AST-${procurement.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
                    asset_name: name,
                    category: 1,
                    brand: "",
                    model_name: "",
                    location: 1,
                    department: parseInt(department),
                    serial_number: `SN-${Date.now()}`,
                    manufacturer: "",
                    procurement_request: procurement.id,
                    approval_status: "PENDING",
                    status: "BLOCKED",
                }),
            })
        }

        setSubmitting(false)
        navigate("/procurements")
    }

    return (
        <>
            <h1 style={{
                background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                fontWeight: 700, fontSize: "1.75rem", marginBottom: "24px",
            }}>New Procurement Request</h1>

            <div className="card p-4" style={{ maxWidth: 600 }}>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Department</label>
                        <select className="form-control" value={department}
                            onChange={(e) => setDepartment(e.target.value)} required>
                            <option value="">-- Select Department --</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.department_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Asset Names (one per line)</label>
                        <textarea className="form-control" rows={8}
                            placeholder={`Laptop Dell XPS\nMonitor Samsung 24"\nKeyboard Logitech\nMouse MX Master`}
                            value={assetNames} onChange={(e) => setAssetNames(e.target.value)} required
                            style={{ fontFamily: "monospace" }}
                        />
                    </div>

                    {error && (
                        <div className="mb-3" style={{ color: "#ef4444", fontSize: "0.85rem" }}>{error}</div>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                        {submitting ? "Creating..." : "Create Procurement Request"}
                    </button>
                </form>
            </div>
        </>
    )
}
