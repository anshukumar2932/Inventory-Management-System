import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react"
import { useNavigate } from "react-router-dom"
import { apiGet } from "../api"
import { API_BASE } from "../api"
import { useAuth } from "../context/AuthContext"
import { getNotificationTarget } from "../lib/notificationRoutes"

const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

const POLL_INTERVAL_MS = 15000

const TYPE_STYLES = {
    ASSET_CREATED: { icon: "\u{1F4E6}", color: "#f59e0b" },
    ASSET_APPROVED: { icon: "\u2705}", color: "#22c55e" },
    ASSET_REJECTED: { icon: "\u274C}", color: "#ef4444" },
    PROCUREMENT_CREATED: { icon: "\u{1F4CB}", color: "#3b82f6" },
    PROCUREMENT_APPROVED: { icon: "\u2705}", color: "#22c55e" },
    PROCUREMENT_REJECTED: { icon: "\u274C}", color: "#ef4444" },
    REPORT_GENERATED: { icon: "\u{1F4CA}", color: "#8b5cf6" },
}

export function ToastProvider({ children }) {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    const [toasts, setToasts] = useState([])
    const lastIdRef = useRef(null)

    const addToast = useCallback((n) => {
        const id = Date.now() + Math.random()
        setToasts((prev) => [...prev, { ...n, toastId: id }])
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.toastId !== id))
        }, 5000)

        if (Notification.permission === "granted") {
            const s = TYPE_STYLES[n.notification_type] || { icon: "", color: "#64748b" }
            try {
                new Notification(n.title, {
                    body: n.message,
                    icon: "/favicon.ico",
                    tag: n.id,
                })
            } catch { }
        }

        if (Notification.permission !== "denied" && Notification.permission !== "granted") {
            Notification.requestPermission()
        }
    }, [])

    useEffect(() => {
        if (loading) return
        if (!user) {
            lastIdRef.current = null
            return
        }

        let cancelled = false
        const poll = async () => {
            try {
                const r = await apiGet(`${API_BASE}/api/v1/notifications/count/`)
                if (!r.ok) return
                const d = await r.json()
                if (lastIdRef.current !== null && d.last_id && d.last_id !== lastIdRef.current && !cancelled) {
                    const r2 = await apiGet(`${API_BASE}/api/v1/notifications/?ordering=-created_at&is_read=false&page_size=5`)
                    if (!r2.ok) return
                    const d2 = await r2.json()
                    const items = d2.results || d2
                    for (const n of items) {
                        if (n.id !== lastIdRef.current) addToast(n)
                    }
                }
                if (d.last_id) lastIdRef.current = d.last_id
            } catch { }
        }
        poll()
        const interval = setInterval(poll, POLL_INTERVAL_MS)
        return () => { cancelled = true; clearInterval(interval) }
    }, [addToast, loading, user])

    const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.toastId !== id))

    const openToastTarget = (toast) => {
        dismissToast(toast.toastId)
        navigate(getNotificationTarget(toast))
    }

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div style={{
                position: "fixed", top: "16px", right: "16px", zIndex: 9999,
                display: "flex", flexDirection: "column", gap: "8px", maxWidth: "360px",
            }}>
                {toasts.map((t) => {
                    const s = TYPE_STYLES[t.notification_type] || { icon: "\u{1F514}", color: "#64748b" }
                    return (
                        <div key={t.toastId}
                            style={{
                                background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)",
                                borderRadius: "10px", padding: "12px 14px",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                                display: "flex", alignItems: "flex-start", gap: "10px",
                                animation: "slideIn 0.3s ease",
                                cursor: "pointer",
                            }}
                            onClick={() => openToastTarget(t)}>
                            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{s.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 600 }}>{t.title}</div>
                                <div style={{ color: "#94a3b8", fontSize: "0.75rem", marginTop: "2px" }}>{t.message}</div>
                            </div>
                        </div>
                    )
                })}
            </div>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </ToastContext.Provider>
    )
}
