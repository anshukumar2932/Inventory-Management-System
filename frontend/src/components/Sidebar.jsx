import { useState, useEffect, useRef, useCallback } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { API_BASE, apiGet, apiPost } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import { getNotificationTarget } from "../lib/notificationRoutes"

const POLL_INTERVAL = 15000

const NOTIF_TYPE_STYLES = {
    ASSET_CREATED: { icon: "\u{1F4E6}", color: "#f59e0b", label: "New Asset" },
    ASSET_APPROVED: { icon: "\u2705", color: "#22c55e", label: "Approved" },
    ASSET_REJECTED: { icon: "\u274C", color: "#ef4444", label: "Rejected" },
    PROCUREMENT_CREATED: { icon: "\u{1F4CB}", color: "#3b82f6", label: "New Procurement" },
    PROCUREMENT_APPROVED: { icon: "\u2705", color: "#22c55e", label: "Approved" },
    PROCUREMENT_REJECTED: { icon: "\u274C", color: "#ef4444", label: "Rejected" },
    REPORT_GENERATED: { icon: "\u{1F4CA}", color: "#8b5cf6", label: "Report" },
}

const allNavItems = [
    { label: "Dashboard", path: "/dashboard", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER", "USER"] },
    { label: "Assets", path: "/assets", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER", "USER"] },
    { label: "Procurements", path: "/procurements", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER", "USER"] },
    { label: "Bulk Upload", path: "/bulk_upload", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER"] },
    { label: "Department", path: "/department", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER"] },
    { label: "Location", path: "/location", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER"] },
    { label: "Vendors", path: "/vendors", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER", "USER"] },
    { label: "Repairs", path: "/repairs", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER", "USER"] },
    { label: "Reports", path: "/reports", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER", "USER"] },
    { label: "Notifications", path: "/notifications", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER", "USER"] },
    { label: "Audits", path: "/audits", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER"] },
    { label: "Service Types", path: "/service-types", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER"] },
]

function timeAgo(dateStr) {
    const now = new Date()
    const date = new Date(dateStr)
    const secs = Math.floor((now - date) / 1000)
    if (secs < 60) return "just now"
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

export default function Sidebar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const navItems = allNavItems.filter((item) => item.roles.includes(user?.role_name))
    const [notifCount, setNotifCount] = useState(0)
    const [notifs, setNotifs] = useState([])
    const [showNotifs, setShowNotifs] = useState(false)
    const pollRef = useRef(null)

    const fetchCount = useCallback(() => {
        apiGet(`${API_BASE}/api/v1/notifications/count/`)
            .then((r) => r.ok ? r.json() : null)
            .then((d) => {
                if (!d) return
                setNotifCount(d.count)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (!user) return
        fetchCount()
        pollRef.current = setInterval(fetchCount, POLL_INTERVAL)
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [user, fetchCount])

    useEffect(() => {
        if (!user || !showNotifs) return
        apiGet(`${API_BASE}/api/v1/notifications/`)
            .then((r) => r.ok ? r.json() : null)
            .then((d) => {
                if (!d) return
                setNotifs(d.results || d)
            })
            .catch(() => {})
    }, [user, showNotifs, notifCount])

    const toggleNotifs = () => setShowNotifs((s) => !s)

    const markAllRead = () => {
        apiPost(`${API_BASE}/api/v1/notifications/mark_all_read/`).then(() => {
            setNotifCount(0)
            setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
        })
    }

    const markRead = (id) => {
        apiPost(`${API_BASE}/api/v1/notifications/${id}/mark_read/`).then(() => {
            setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
            setNotifCount((c) => Math.max(0, c - 1))
        })
    }

    const openNotification = (notification) => {
        if (!notification.is_read) {
            markRead(notification.id)
        }
        setShowNotifs(false)
        navigate(getNotificationTarget(notification))
    }

    const handleLogout = async () => {
        await logout()
    }

    return (
        <div className="d-flex flex-column vh-100 p-4"
            style={{
                width: "240px",
                position: "fixed",
                left: 0,
                top: 0,
                background: "rgba(10, 14, 26, 0.95)",
                borderRight: "1px solid rgba(148, 163, 184, 0.1)",
                backdropFilter: "blur(20px)",
                zIndex: 100,
            }}>
            <div className="text-center mb-4 pb-3" style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.1)" }}>
                <h5 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontWeight: 700,
                    margin: 0,
                    fontSize: "1.1rem",
                    letterSpacing: "0.5px",
                }}>
                    Inventory System
                </h5>
            </div>
            <nav className="d-flex flex-column gap-1 flex-grow-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-link py-2 px-3 rounded`}
                        style={({ isActive }) => ({
                            color: isActive ? "#06b6d4" : "#94a3b8",
                            background: isActive ? "rgba(6, 182, 212, 0.1)" : "transparent",
                            border: isActive ? "1px solid rgba(6, 182, 212, 0.3)" : "1px solid transparent",
                            fontWeight: isActive ? 600 : 400,
                            fontSize: "0.9rem",
                            transition: "all 0.3s ease",
                            textDecoration: "none",
                        })}
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div style={{ position: "relative" }}>
                <div
                    onClick={toggleNotifs}
                    style={{
                        padding: "8px 12px", cursor: "pointer", borderRadius: "8px",
                        display: "flex", alignItems: "center", gap: "8px",
                        color: "#94a3b8", fontSize: "0.85rem",
                        transition: "all 0.2s",
                        borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                        marginBottom: "8px",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(148,163,184,0.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                    <span>&#x1F514;</span>
                    <span>Notifications</span>
                    {notifCount > 0 && (
                        <span style={{
                            background: "#ef4444", color: "#fff", borderRadius: "50%",
                            padding: "1px 6px", fontSize: "0.7rem", marginLeft: "auto",
                        }}>{notifCount}</span>
                    )}
                </div>

                {showNotifs && (
                    <div style={{
                        position: "absolute", bottom: "100%", left: 0, right: 0,
                        background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)",
                        borderRadius: "8px", marginBottom: "4px", maxHeight: "360px", overflowY: "auto",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                    }}>
                        <div style={{
                            padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
                            borderBottom: "1px solid rgba(148,163,184,0.1)", position: "sticky", top: 0,
                            background: "#1e293b", zIndex: 1,
                        }}>
                            <span style={{ color: "#e2e8f0", fontSize: "0.8rem", fontWeight: 600 }}>Notifications</span>
                            <div className="d-flex gap-2" style={{ alignItems: "center" }}>
                                <span onClick={() => { setShowNotifs(false); navigate("/notifications") }}
                                    style={{ color: "#8b5cf6", fontSize: "0.75rem", cursor: "pointer" }}>
                                    View All
                                </span>
                                {notifCount > 0 && (
                                    <span onClick={markAllRead} style={{ color: "#06b6d4", fontSize: "0.75rem", cursor: "pointer" }}>
                                        Mark all read
                                    </span>
                                )}
                            </div>
                        </div>
                        {notifs.length === 0 && (
                            <div style={{ color: "#64748b", fontSize: "0.8rem", padding: "20px 16px", textAlign: "center" }}>
                                No notifications
                            </div>
                        )}
                        {notifs.map((n) => {
                            const style = NOTIF_TYPE_STYLES[n.notification_type] || { icon: "\u{1F514}", color: "#64748b", label: "" }
                            return (
                                <div key={n.id} onClick={() => openNotification(n)}
                                    style={{
                                        padding: "10px 12px", borderBottom: "1px solid rgba(148,163,184,0.05)",
                                        background: n.is_read ? "transparent" : "rgba(6,182,212,0.05)",
                                        cursor: "pointer",
                                        transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(6,182,212,0.12)" }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = n.is_read ? "transparent" : "rgba(6,182,212,0.05)" }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                                        <span style={{ fontSize: "1rem", lineHeight: 1.3 }}>{style.icon}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                <span style={{ color: "#e2e8f0", fontSize: "0.8rem", fontWeight: n.is_read ? 400 : 600 }}>
                                                    {n.title}
                                                </span>
                                                <span style={{
                                                    background: style.color, color: "#fff", borderRadius: "4px",
                                                    padding: "0 5px", fontSize: "0.6rem", fontWeight: 600,
                                                    lineHeight: "1.4",
                                                }}>{style.label}</span>
                                            </div>
                                            <div style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "2px", lineHeight: 1.3 }}>
                                                {n.message}
                                            </div>
                                            <div style={{ color: "#64748b", fontSize: "0.65rem", marginTop: "3px" }}>
                                                {timeAgo(n.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div style={{
                borderTop: "1px solid rgba(148, 163, 184, 0.1)",
                paddingTop: "12px",
            }}>
                <div style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 600 }}>
                    {user?.username || "User"}
                </div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "8px" }}>
                    {user?.role_name || ""}
                </div>
                <button
                    onClick={handleLogout}
                    style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "8px",
                        background: "transparent",
                        color: "#ef4444",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => e.target.style.background = "rgba(239, 68, 68, 0.1)"}
                    onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                    Logout
                </button>
            </div>
        </div>
    )
}
