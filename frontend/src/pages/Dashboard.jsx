import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts"
import { API_BASE, apiGet } from "../lib/api"

const API = `${API_BASE}/api/v1`

const COLORS = ["#06b6d4", "#8b5cf6", "#22c55e", "#eab308", "#ef4444", "#f97316", "#14b8a6"]

export default function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState(null)

    useEffect(() => {
        apiGet(`${API}/dashboard/stats/`)
            .then((r) => { if (!r.ok) throw new Error(); return r.json() })
            .then((d) => setStats(d))
            .catch(() => {})
    }, [])

    if (!stats) return null

    const statCards = [
        { label: "Total Assets", value: stats.total_assets, color: "#06b6d4" },
        { label: "Active", value: stats.active_assets, color: "#22c55e" },
        { label: "Under Repair", value: stats.repair_assets, color: "#eab308" },
        { label: "Missing", value: stats.missing_assets, color: "#ef4444" },
        { label: "Retired", value: stats.retired_assets, color: "#64748b" },
        { label: "Blocked", value: stats.blocked_assets, color: "#f97316" },
    ]

    const procurementCard = {
        label: "Pending Procurements",
        value: stats.pending_procurements,
        link: "/procurements",
        color: "#8b5cf6",
    }

    const pieData = [
        { name: "Active", value: stats.active_assets, color: "#22c55e" },
        { name: "Repair", value: stats.repair_assets, color: "#eab308" },
        { name: "Missing", value: stats.missing_assets, color: "#ef4444" },
        { name: "Retired", value: stats.retired_assets, color: "#64748b" },
    ].filter((d) => d.value > 0)

    return (
        <>
            <h1 style={{
                background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
                fontSize: "1.75rem",
                marginBottom: "24px",
            }}>
                Dashboard
            </h1>

            <div className="row g-3 mb-4">
                {statCards.map((s) => (
                    <div key={s.label} className="col-md-2 col-6">
                        <div className="card p-3 text-center" style={{ border: `1px solid ${s.color}33` }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                        </div>
                    </div>
                ))}
                <div key="procurements" className="col-md-2 col-6">
                    <div className="card p-3 text-center" style={{ border: `1px solid ${procurementCard.color}33`, cursor: "pointer" }}
                        onClick={() => navigate(procurementCard.link)}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: procurementCard.color }}>{procurementCard.value}</div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{procurementCard.label}</div>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-4">
                <div className="col-md-6">
                    <div className="card p-3">
                        <h5 style={{ color: "#e2e8f0", marginBottom: "16px", fontSize: "0.95rem" }}>Assets by Category</h5>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={stats.assets_by_category}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8, color: "#e2e8f0" }}
                                />
                                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card p-3">
                        <h5 style={{ color: "#e2e8f0", marginBottom: "16px", fontSize: "0.95rem" }}>Assets by Department</h5>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={stats.assets_by_department}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8, color: "#e2e8f0" }}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-4">
                <div className="col-md-6">
                    <div className="card p-3">
                        <h5 style={{ color: "#e2e8f0", marginBottom: "16px", fontSize: "0.95rem" }}>Monthly Additions</h5>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={stats.monthly_additions}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8, color: "#e2e8f0" }}
                                />
                                <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card p-3" style={{ height: "100%" }}>
                        <h5 style={{ color: "#e2e8f0", marginBottom: "16px", fontSize: "0.95rem" }}>Asset Status</h5>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                                        {pieData.map((e, i) => (
                                            <Cell key={e.name} fill={e.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8, color: "#e2e8f0" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center", padding: "40px 0" }}>No data</div>
                        )}
                        <div className="d-flex flex-wrap gap-2 mt-2 justify-content-center">
                            {pieData.map((e) => (
                                <span key={e.name} style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: e.color, marginRight: 4 }} />
                                    {e.name}: {e.value}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card p-3" style={{ height: "100%" }}>
                        <h5 style={{ color: "#e2e8f0", marginBottom: "16px", fontSize: "0.95rem" }}>Repair Analytics</h5>
                        <div style={{ marginBottom: "12px" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase" }}>Open Tickets</div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#eab308" }}>{stats.repair_analytics?.open_tickets ?? 0}</div>
                        </div>
                        <div style={{ marginBottom: "12px" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase" }}>Closed Tickets</div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#22c55e" }}>{stats.repair_analytics?.closed_tickets ?? 0}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase" }}>Total Cost</div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#06b6d4" }}>Rs. {(stats.repair_analytics?.total_cost ?? 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card p-3">
                <h5 style={{ color: "#e2e8f0", marginBottom: "16px", fontSize: "0.95rem" }}>Audit Trends</h5>
                <div style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center", padding: "32px 0" }}>
                    No audit data available yet
                </div>
            </div>
        </>
    )
}
