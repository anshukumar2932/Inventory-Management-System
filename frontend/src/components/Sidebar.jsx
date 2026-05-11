import { NavLink } from "react-router-dom"

const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Assets", path: "/assets" },
    { label: "Repairs", path: "/repairs" },
    { label: "Audits", path: "/audits" },
    { label: "Vendors", path: "/vendors" },
    { label: "Reports", path: "/reports" },
]

export default function Sidebar() {
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
            <nav className="d-flex flex-column gap-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `nav-link py-2 px-3 rounded`
                        }
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
        </div>
    )
}
