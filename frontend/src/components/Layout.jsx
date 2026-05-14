import { useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import Sidebar from "./Sidebar"
import ErrorBoundary from "./ErrorBoundary"
import { useAuth } from "../context/AuthContext"

export default function Layout() {
    const navigate = useNavigate()
    const { user, loading } = useAuth()

    useEffect(() => {
        if (!loading && !user) {
            navigate("/")
        }
    }, [user, loading, navigate])

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
                <div className="text-center">
                    <div className="spinner-border" style={{ color: "#06b6d4" }} role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2" style={{ color: "#64748b", fontSize: "0.875rem" }}>Verifying session...</p>
                </div>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="d-flex" style={{ minHeight: "100vh" }}>
            <ErrorBoundary inline title="Navigation Error" message="The sidebar failed to load. Try reloading.">
                <Sidebar />
            </ErrorBoundary>
            <div className="flex-grow-1 p-4" style={{ marginLeft: "240px" }}>
                <Outlet />
            </div>
        </div>
    )
}
