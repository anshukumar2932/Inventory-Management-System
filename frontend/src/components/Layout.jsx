import { useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import Sidebar from "./Sidebar"

export default function Layout() {
    const navigate = useNavigate()

    useEffect(() => {
        fetch("http://localhost:8000/api/v1/auth/me/", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access")}`,
            },
        }).then((res) => {
            if (!res.ok) {
                localStorage.clear()
                navigate("/")
            }
        })
    }, [navigate])

    return (
        <div className="d-flex" style={{ minHeight: "100vh" }}>
            <Sidebar />
            <div className="flex-grow-1 p-4" style={{ marginLeft: "240px" }}>
                <Outlet />
            </div>
        </div>
    )
}
