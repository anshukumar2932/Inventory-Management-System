import { useState, useEffect } from "react"
import { NavLink, useNavigate } from "react-router-dom"

const NOTIF_API = "http://localhost:8000/api/v1/notifications"
const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access")}`,
})

const getUser = () => {
    try { return JSON.parse(localStorage.getItem("user")) }
    catch { return null }
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
    { label: "Audits", path: "/audits", roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER"] },
]

export default function Sidebar() {
    const navigate = useNavigate()
    const user = getUser()
    const navItems = allNavItems.filter((item) => item.roles.includes(user?.role_name))
    const [notifCount, setNotifCount] = useState(0)
    const [notifs, setNotifs] = useState([])
    const [showNotifs, setShowNotifs] = useState(false)

    useEffect(() => {
        fetch(`${NOTIF_API}/count/`, { headers: headers() })
            .then((r) => r.json())
            .then((d) => setNotifCount(d.count))
            .catch(() => {})
    }, [])

    const toggleNotifs = () => {
        if (!showNotifs) {
            fetch(`${NOTIF_API}/`, { headers: headers() })
                .then((r) => r.json())
                .then((d) => setNotifs(d.results || d))
        }
        setShowNotifs(!showNotifs)
    }

    const markAllRead = () => {
        fetch(`${NOTIF_API}/mark_all_read/`, {
            method: "POST", headers: headers(),
        }).then(() => {
            setNotifCount(0)
            setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
        })
    }

    const handleLogout = () => {
        const refresh = localStorage.getItem("refresh")
        if (refresh) {
            fetch("http://localhost:8000/api/v1/auth/logout/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh }),
            }).catch(() => {})
        }
        localStorage.clear()
        navigate("/")
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
                    <span>🔔</span>
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
                        borderRadius: "8px", marginBottom: "4px", maxHeight: "300px", overflowY: "auto",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                    }}>
                        <div style={{
                            padding: "8px 12px", display: "flex", justifyContent: "space-between",
                            borderBottom: "1px solid rgba(148,163,184,0.1)",
                        }}>
                            <span style={{ color: "#e2e8f0", fontSize: "0.8rem", fontWeight: 600 }}>Notifications</span>
                            {notifCount > 0 && (
                                <span onClick={markAllRead} style={{ color: "#06b6d4", fontSize: "0.75rem", cursor: "pointer" }}>
                                    Mark all read
                                </span>
                            )}
                        </div>
                        {notifs.length === 0 && (
                            <div style={{ color: "#64748b", fontSize: "0.8rem", padding: "16px", textAlign: "center" }}>
                                No notifications
                            </div>
                        )}
                        {notifs.map((n) => (
                            <div key={n.id} style={{
                                padding: "8px 12px", borderBottom: "1px solid rgba(148,163,184,0.05)",
                                background: n.is_read ? "transparent" : "rgba(6,182,212,0.05)",
                            }}>
                                <div style={{ color: "#e2e8f0", fontSize: "0.8rem", fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                                <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{n.message}</div>
                            </div>
                        ))}
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
