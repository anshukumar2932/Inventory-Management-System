import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000/api/v1/assets"
const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

export default function BulkUpload() {
    const navigate = useNavigate()
    const fileRef = useRef(null)
    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [done, setDone] = useState(false)

    const handleFile = (e) => {
        const f = e.target.files[0]
        if (f) setFile(f)
    }

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)

        const fd = new FormData()
        fd.append("file", file)

        const res = await fetch(`${API}/assets/bulk_upload/`, {
            method: "POST",
            headers: headers(),
            body: fd,
        })

        setUploading(false)

        if (res.status === 401) {
            localStorage.clear()
            navigate("/")
            return
        }

        if (res.headers.get("content-type")?.includes("json")) {
            const data = await res.json()
            const msg = data.details
                ? data.details.map((e) => `Row ${e.row}: ${e.message}`).join("\n")
                : data.error || "Upload failed"
            alert(msg)
            return
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "barcodes.xlsx"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setDone(true)
        setFile(null)
        if (fileRef.current) fileRef.current.value = ""
    }

    return (
        <>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Bulk Upload Assets</h1>
            </div>

            {done && (
                <div className="alert" style={{
                    background: "rgba(34,197,94,0.15)", color: "#22c55e",
                    border: "1px solid rgba(34,197,94,0.3)",
                }}>
                    Upload complete! Barcodes Excel downloaded.
                </div>
            )}

            <div className="card p-4 mb-4" style={{ maxWidth: 600 }}>
                <div className="mb-3">
                    <label className="form-label">Select Excel file (.xlsx / .xls / .csv)</label>
                    <input
                        ref={fileRef}
                        type="file"
                        className="form-control"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFile}
                    />
                </div>

                {file && (
                    <div className="mb-3" style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                        Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                )}

                <button
                    className="btn btn-primary"
                    onClick={handleUpload}
                    disabled={!file || uploading}
                >
                    {uploading ? "Uploading..." : "Upload & Download Barcodes"}
                </button>

                <div className="mt-3">
                    <a
                        href="/bulk_upload_template.xlsx"
                        style={{ color: "#06b6d4", fontSize: "0.85rem" }}
                        download
                    >Download sample template</a>
                </div>
            </div>
        </>
    )
}
