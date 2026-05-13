import { useEffect, useRef, useState } from "react"

const SCAN_API = "http://localhost:8000/api/v1/assets/assets/scan/"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

export default function BarcodeScanner({ onScan, onClose }) {
    const [scanning, setScanning] = useState(false)
    const [error, setError] = useState("")
    const scannerRef = useRef(null)
    const containerRef = useRef(null)

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                try { scannerRef.current.stop().catch(() => {}) } catch {}
            }
        }
    }, [])

    const startScanning = async () => {
        setError("")
        setScanning(true)
        try {
            const { Html5Qrcode } = await import("html5-qrcode")
            const scanner = new Html5Qrcode("barcode-reader")
            scannerRef.current = scanner
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                async (decodedText) => {
                    try {
                        await scanner.stop()
                        setScanning(false)
                        const res = await fetch(SCAN_API, {
                            method: "POST",
                            headers: headers(),
                            body: JSON.stringify({ barcode: decodedText }),
                        })
                        if (res.ok) {
                            const data = await res.json()
                            onScan?.(data.asset)
                        } else {
                            setError("Asset not found for this barcode")
                            setTimeout(() => setError(""), 2000)
                            setScanning(false)
                        }
                    } catch (e) {
                        setError("Scan failed")
                        setScanning(false)
                    }
                },
                () => {}
            )
        } catch (e) {
            setError("Camera access denied or not supported")
            setScanning(false)
        }
    }

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", zIndex: 10000,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center",
        }}>
            <div style={{
                background: "#1e293b", borderRadius: "12px",
                border: "1px solid rgba(148,163,184,0.2)",
                padding: "24px", maxWidth: "500px", width: "90%",
            }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 style={{ color: "#e2e8f0", margin: 0 }}>Barcode Scanner</h5>
                    <button onClick={onClose}
                        style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
                </div>

                {!scanning ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "16px" }}>
                            Point your camera at a barcode to scan
                        </p>
                        <button className="btn btn-primary" onClick={startScanning}>
                            Start Scanning
                        </button>
                    </div>
                ) : (
                    <div>
                        <div id="barcode-reader" ref={containerRef}
                            style={{ width: "100%", minHeight: "250px", borderRadius: "8px", overflow: "hidden" }} />
                        <div style={{ textAlign: "center", marginTop: "12px" }}>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => {
                                if (scannerRef.current) {
                                    try { scannerRef.current.stop().catch(() => {}) } catch {}
                                }
                                setScanning(false)
                            }}>Cancel Scan</button>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center", marginTop: "8px" }}>{error}</div>
                )}
            </div>
        </div>
    )
}
