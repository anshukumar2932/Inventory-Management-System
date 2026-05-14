import { useState, useEffect, useRef, useCallback } from "react"
import { API_BASE, apiGet, apiPost } from "../lib/api"
const API = `${API_BASE}/api/v1/audits`

const ASSETS_API = `${API_BASE}/api/v1/assets`

export default function AuditScanner() {
    const [session, setSession] = useState(null)
    const [sessions, setSessions] = useState([])
    const [lastScan, setLastScan] = useState(null)
    const [flash, setFlash] = useState(null)
    const [barcodeInput, setBarcodeInput] = useState("")
    const [scanning, setScanning] = useState(false)
    const [scannerMode, setScannerMode] = useState("gun")
    const [creating, setCreating] = useState(false)
    const [newDept, setNewDept] = useState("")
    const [departments, setDepartments] = useState([])
    const inputRef = useRef(null)
    const scannerRef = useRef(null)

    useEffect(() => {
        apiGet(`${API}/sessions/`)
            .then((r) => r.json())
            .then((d) => setSessions(d.results || d))
        apiGet(`${API_BASE}/api/v1/auth/departments/`)
            .then((r) => r.json())
            .then((d) => setDepartments(d.results || d))
    }, [])

    useEffect(() => { if (inputRef.current) inputRef.current.focus() }, [session])

    const playSound = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            gain.gain.value = 0.1
            if (type === "success") {
                osc.frequency.value = 880
                osc.start()
                osc.stop(ctx.currentTime + 0.1)
            } else {
                osc.frequency.value = 220
                osc.start()
                osc.stop(ctx.currentTime + 0.2)
            }
        } catch {}
    }

    const scanBarcode = useCallback(async (barcode) => {
        if (!session || !barcode.trim()) return
        setBarcodeInput("")
        try {
            const res = await apiPost(`${API}/sessions/${session.id}/scan/`, { barcode: barcode.trim() })
            const data = await res.json()
            if (res.ok) {
                setLastScan(data)
                setFlash(data.duplicate ? "warning" : "success")
                playSound("success")
                setSession((prev) => ({ ...prev, entries: [...(prev.entries || []), data] }))
            } else {
                setLastScan({ found: false, error: data.error || "Not found" })
                setFlash("error")
                playSound("error")
            }
        } catch {
            setLastScan({ found: false, error: "Network error" })
            setFlash("error")
            playSound("error")
        }
        setTimeout(() => setFlash(null), 800)
        if (inputRef.current) inputRef.current.focus()
    }, [session])

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            scanBarcode(barcodeInput)
        }
    }

    const createSession = async () => {
        if (!newDept) return
        setCreating(true)
        const res = await apiPost(`${API}/sessions/`, { department: parseInt(newDept), status: "OPEN" })
        if (res.ok) {
            const data = await res.json()
            setSession(data)
            setSessions((prev) => [data, ...prev])
        }
        setCreating(false)
    }

    const completeSession = async () => {
        if (!session) return
        await apiPost(`${API}/sessions/${session.id}/complete/`, {})
        setSession(null)
        const d = await apiGet(`${API}/sessions/`).then((r) => r.json())
        setSessions(d.results || d)
    }

    const startCamera = async () => {
        setScanning(true)
        try {
            const { Html5Qrcode } = await import("html5-qrcode")
            const scanner = new Html5Qrcode("cam-reader")
            scannerRef.current = scanner
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                (text) => { scanBarcode(text) },
                () => {},
            )
        } catch {
            setScanning(false)
        }
    }

    const stopCamera = () => {
        if (scannerRef.current) {
            try { scannerRef.current.stop().catch(() => {}) } catch {}
            scannerRef.current = null
        }
        setScanning(false)
    }

    const openSession = (s) => {
        if (s.status === "OPEN") {
            setSession(s)
        }
    }

    const flashColor = flash === "success" ? "rgba(34,197,94,0.3)" : flash === "warning" ? "rgba(250,204,21,0.3)" : flash === "error" ? "rgba(239,68,68,0.3)" : "transparent"

    return (
        <div style={{ minHeight: "100vh" }}>
            <div style={{
                position: "fixed", top: 0, left: 0, right: 0, height: "6px",
                background: flashColor, transition: "background 0.1s", zIndex: 9999,
            }} />

            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Audit Scanner</h1>
            </div>

            {!session ? (
                <>
                    <div className="card p-4 mb-4" style={{ maxWidth: 500 }}>
                        <h5 style={{ color: "#e2e8f0", marginBottom: "12px" }}>Start New Audit Session</h5>
                        <select className="form-control mb-2" value={newDept} onChange={(e) => setNewDept(e.target.value)}>
                            <option value="">Select Department</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.department_name}</option>
                            ))}
                        </select>
                        <button className="btn btn-primary" onClick={createSession} disabled={creating}>
                            {creating ? "Starting..." : "Start Audit"}
                        </button>
                    </div>

                    <div className="card p-0" style={{ overflow: "hidden" }}>
                        <div style={{ overflowX: "auto" }}>
                            <table className="table" style={{ minWidth: "500px" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                                        <th style={thStyle}>Department</th>
                                        <th style={thStyle}>Status</th>
                                        <th style={thStyle}>Verified</th>
                                        <th style={thStyle}>Started</th>
                                        <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.length === 0 && (
                                        <tr><td colSpan={5} style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No audit sessions</td></tr>
                                    )}
                                    {sessions.map((s) => (
                                        <tr key={s.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                                            <td style={tdStyle}>{s.department_name}</td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    background: s.status === "OPEN" ? "rgba(34,197,94,0.2)" : "rgba(148,163,184,0.2)",
                                                    color: s.status === "OPEN" ? "#22c55e" : "#94a3b8",
                                                    padding: "2px 10px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600,
                                                }}>{s.status}</span>
                                            </td>
                                            <td style={tdStyle}>{s.verified_count || 0} / {s.total_assets || 0}</td>
                                            <td style={tdStyle}>{new Date(s.created_at).toLocaleDateString()}</td>
                                            <td style={{ ...tdStyle, textAlign: "center" }}>
                                                {s.status === "OPEN" ? (
                                                    <button className="btn btn-sm btn-outline-primary"
                                                        onClick={() => openSession(s)}>Open</button>
                                                ) : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="card p-3 mb-4">
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>
                                <h5 style={{ color: "#e2e8f0", margin: 0 }}>
                                    Scanning: {session.department_name || `Session #${session.id}`}
                                </h5>
                                <small style={{ color: "#64748b" }}>
                                    {session.entries?.length || 0} verified · Started {new Date(session.created_at).toLocaleString()}
                                </small>
                            </div>
                            <div className="d-flex gap-2">
                                <button className={`btn btn-sm ${scannerMode === "gun" ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => { setScannerMode("gun"); stopCamera() }}>Keyboard Gun</button>
                                <button className={`btn btn-sm ${scannerMode === "cam" ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => { setScannerMode("cam"); if (!scanning) startCamera() }}>Camera</button>
                                <button className="btn btn-sm btn-outline-success" onClick={completeSession}>Complete</button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => { stopCamera(); setSession(null) }}>Close</button>
                            </div>
                        </div>
                    </div>

                    <div className="row g-3">
                        <div className="col-md-7">
                            <div className="card p-3" style={{ minHeight: "300px" }}>
                                {scannerMode === "cam" && (
                                    <div id="cam-reader" style={{ width: "100%", minHeight: "250px", borderRadius: "8px", overflow: "hidden" }} />
                                )}
                                {scannerMode === "gun" && (
                                    <div style={{ textAlign: "center", padding: "60px 0" }}>
                                        <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "16px" }}>
                                            Scan barcode with your USB scanner or type and press Enter
                                        </p>
                                        <input
                                            ref={inputRef}
                                            className="form-control"
                                            style={{ maxWidth: 300, margin: "0 auto", textAlign: "center", fontSize: "1.2rem" }}
                                            placeholder="Scan or type barcode..."
                                            value={barcodeInput}
                                            onChange={(e) => setBarcodeInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-md-5">
                            <div className="card p-3" style={{ maxHeight: "400px", overflowY: "auto" }}>
                                <h6 style={{ color: "#94a3b8", marginBottom: "12px", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Recent Scans
                                </h6>
                                {(!session.entries || session.entries.length === 0) && (
                                    <p style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center", padding: "20px 0" }}>
                                        No scans yet
                                    </p>
                                )}
                                {(session.entries || []).slice(-20).reverse().map((e, i) => (
                                    <div key={i} style={{
                                        padding: "8px 12px", marginBottom: "4px",
                                        background: "rgba(34,197,94,0.08)", borderRadius: "6px",
                                        borderLeft: "3px solid #22c55e",
                                    }}>
                                        <div style={{ color: "#22c55e", fontSize: "0.8rem", fontWeight: 600 }}>✓ {e.asset_code}</div>
                                        <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{e.asset_name}</div>
                                    </div>
                                ))}
                            </div>

                            {lastScan && (
                                <div className="card p-3 mt-3" style={{
                                    border: lastScan.found
                                        ? `1px solid ${lastScan.duplicate ? "rgba(250,204,21,0.3)" : "rgba(34,197,94,0.3)"}`
                                        : "1px solid rgba(239,68,68,0.3)",
                                }}>
                                    <div style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: "8px" }}>
                                        {lastScan.found ? (lastScan.duplicate ? "⚠️" : "✅") : "❌"}
                                    </div>
                                    {lastScan.found ? (
                                        <>
                                            <div style={{ color: "#22c55e", fontWeight: 600, textAlign: "center" }}>
                                                {lastScan.duplicate ? "Already Verified" : "Verified"}
                                            </div>
                                            <div style={{ color: "#e2e8f0", textAlign: "center", fontSize: "0.9rem" }}>
                                                {lastScan.asset?.asset_code} — {lastScan.asset?.asset_name}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ color: "#ef4444", textAlign: "center", fontWeight: 600 }}>
                                            {lastScan.error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
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
