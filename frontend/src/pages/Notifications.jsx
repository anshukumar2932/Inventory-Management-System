import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { API_BASE, apiGet, apiPost } from "../api"
import { getNotificationTarget } from "../lib/notificationRoutes"

const NOTIF_API = `${API_BASE}/api/v1/notifications`

const TYPE_STYLES = {
    ASSET_CREATED: { icon: "\u{1F4E6}", color: "#f59e0b", label: "New Asset" },
    ASSET_APPROVED: { icon: "\u2705", color: "#22c55e", label: "Approved" },
    ASSET_REJECTED: { icon: "\u274C", color: "#ef4444", label: "Rejected" },
    PROCUREMENT_CREATED: { icon: "\u{1F4CB}", color: "#3b82f6", label: "New Procurement" },
    PROCUREMENT_APPROVED: { icon: "\u2705", color: "#22c55e", label: "Approved" },
    PROCUREMENT_REJECTED: { icon: "\u274C", color: "#ef4444", label: "Rejected" },
    REPORT_GENERATED: { icon: "\u{1F4CA}", color: "#8b5cf6", label: "Report" },
}

function timeAgo(dateStr) {
    const now = new Date(); const date = new Date(dateStr)
    const secs = Math.floor((now - date) / 1000)
    if (secs < 60) return "just now"
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

export default function Notifications() {
    const navigate = useNavigate()
    const [notifs, setNotifs] = useState([])
    const [count, setCount] = useState(0)
    const [selected, setSelected] = useState(new Set())
    const [filter, setFilter] = useState("all")
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(false)

    const buildUrl = useCallback((p, f) => {
        let url = `${NOTIF_API}/?page=${p}&ordering=-created_at`
        if (f === "unread") url += "&is_read=false"
        else if (f !== "all") url += `&notification_type=${f}`
        return url
    }, [])

    const fetchNotifs = useCallback(async (p, f, append = false) => {
        setLoading(true)

        try {

            const r = await apiGet(
                buildUrl(p, f)
            )

            if (!r.ok) {
                throw new Error(
                    `HTTP ${r.status}`
                )
            }

            const d = await r.json()

            // SAFE ARRAY EXTRACTION
            const notifArray = Array.isArray(d)
                ? d
                : Array.isArray(d.results)
                    ? d.results
                    : []

            setNotifs((prev) =>
                append
                    ? [...prev, ...notifArray]
                    : notifArray
            )

            setHasMore(!!d.next)

            setCount(
                typeof d.count === "number"
                    ? d.count
                    : notifArray.length
            )

        } catch (err) {

            console.error(
                "Failed to fetch notifications:",
                err
            )

            setNotifs([])

        } finally {

            setLoading(false)

        }

    }, [buildUrl])

    useEffect(() => { setPage(1); fetchNotifs(1, filter) }, [filter, fetchNotifs])

    const loadMore = () => {
        const next = page + 1
        setPage(next)
        fetchNotifs(next, filter, true)
    }

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selected.size === notifs.length) setSelected(new Set())
        else setSelected(new Set(notifs.map((n) => n.id)))
    }

    const bulkMarkRead = async () => {
        if (selected.size === 0) return
        await apiPost(`${NOTIF_API}/bulk_mark_read/`, { ids: [...selected] })
        setSelected(new Set())
        fetchNotifs(1, filter)
    }

    const bulkDelete = async () => {
        if (selected.size === 0) return
        await apiPost(`${NOTIF_API}/bulk_delete/`, { ids: [...selected] })
        setSelected(new Set())
        fetchNotifs(1, filter)
    }

    const markRead = async (id) => {
        await apiPost(`${NOTIF_API}/${id}/mark_read/`)
        setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
    }

    const openNotification = async (notification) => {
        if (!notification.is_read) {
            await markRead(notification.id)
        }
        navigate(getNotificationTarget(notification))
    }

    const filterTabs = [
        { key: "all", label: "All" },
        { key: "unread", label: "Unread" },
        { key: "ASSET_CREATED", label: "New Assets" },
        { key: "ASSET_APPROVED", label: "Approvals" },
        { key: "PROCUREMENT_CREATED", label: "Procurements" },
        { key: "REPORT_GENERATED", label: "Reports" },
    ]

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 style={{ color: "#e2e8f0", margin: 0 }}>Notifications {count > 0 && <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 400 }}>({count})</span>}</h4>
                {selected.size > 0 && (
                    <div className="d-flex gap-2">
                        <button onClick={bulkMarkRead}
                            style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "6px", padding: "4px 12px", fontSize: "0.8rem", cursor: "pointer" }}>
                            Mark Read ({selected.size})
                        </button>
                        <button onClick={bulkDelete}
                            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", padding: "4px 12px", fontSize: "0.8rem", cursor: "pointer" }}>
                            Delete ({selected.size})
                        </button>
                    </div>
                )}
            </div>

            <div className="d-flex gap-2 mb-3 flex-wrap">
                {filterTabs.map((tab) => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        style={{
                            background: filter === tab.key ? "rgba(6,182,212,0.2)" : "transparent",
                            color: filter === tab.key ? "#06b6d4" : "#94a3b8",
                            border: filter === tab.key ? "1px solid rgba(6,182,212,0.4)" : "1px solid rgba(148,163,184,0.2)",
                            borderRadius: "6px", padding: "4px 12px", fontSize: "0.8rem", cursor: "pointer",
                            transition: "all 0.2s",
                        }}>{tab.label}</button>
                ))}
            </div>

            <div style={{
                background: "rgba(15,23,42,0.6)", borderRadius: "12px",
                border: "1px solid rgba(148,163,184,0.1)",
            }}>
                {notifs.length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "#64748b", fontSize: "0.9rem" }}>
                        No notifications found
                    </div>
                )}

                {notifs.map((n) => {
                    const s = TYPE_STYLES[n.notification_type] || { icon: "\u{1F514}", color: "#64748b", label: "" }
                    return (
                        <div key={n.id}
                            onClick={() => openNotification(n)}
                            style={{
                                display: "flex", alignItems: "flex-start", gap: "12px",
                                padding: "14px 16px",
                                borderBottom: "1px solid rgba(148,163,184,0.06)",
                                background: n.is_read ? "transparent" : "rgba(6,182,212,0.03)",
                                cursor: "pointer",
                                transition: "background 0.2s",
                            }}>
                            <input type="checkbox" checked={selected.has(n.id)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelect(n.id)}
                                style={{ marginTop: "3px", accentColor: "#06b6d4", cursor: "pointer" }} />
                            <span style={{ fontSize: "1.2rem", lineHeight: 1.3, flexShrink: 0 }}>{s.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <span style={{
                                        color: "#e2e8f0", fontSize: "0.9rem",
                                        fontWeight: n.is_read ? 400 : 600,
                                    }}>{n.title}</span>
                                    <span style={{
                                        background: s.color, color: "#fff", borderRadius: "4px",
                                        padding: "0 6px", fontSize: "0.65rem", fontWeight: 600,
                                    }}>{s.label}</span>
                                </div>
                                <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "3px" }}>
                                    {n.message}
                                </div>
                                <div style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "4px" }}>
                                    {timeAgo(n.created_at)}
                                    {n.email_sent && <span style={{ marginLeft: "8px", color: "#22c55e" }}>Emailed</span>}
                                </div>
                            </div>
                            <div className="d-flex gap-1 flex-shrink-0">
                                {!n.is_read && (
                                    <button onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
                                        style={{
                                            background: "transparent", border: "1px solid rgba(148,163,184,0.2)",
                                            color: "#94a3b8", borderRadius: "4px", padding: "2px 8px",
                                            fontSize: "0.7rem", cursor: "pointer",
                                        }}>Read</button>
                                )}
                            </div>
                        </div>
                    )
                })}

                {hasMore && (
                    <div style={{ textAlign: "center", padding: "16px" }}>
                        <button onClick={loadMore} disabled={loading}
                            style={{
                                background: "transparent", border: "1px solid rgba(148,163,184,0.2)",
                                color: "#06b6d4", borderRadius: "6px", padding: "8px 24px",
                                fontSize: "0.85rem", cursor: "pointer",
                            }}>
                            {loading ? "Loading..." : "Load More"}
                        </button>
                    </div>
                )}
            </div>

            {notifs.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                    <label style={{ color: "#64748b", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={selected.size === notifs.length && notifs.length > 0}
                            onChange={toggleSelectAll}
                            style={{ accentColor: "#06b6d4", cursor: "pointer" }} />
                        Select all {notifs.length > 0 && `(${notifs.length})`}
                    </label>
                </div>
            )}
        </div>
    )
}
