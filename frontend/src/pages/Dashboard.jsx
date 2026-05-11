import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

export default function Dashboard() {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)

    useEffect(() => {
        fetch("http://localhost:8000/api/v1/auth/me/", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access")}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Unauthorized")
                return res.json()
            })
            .then((data) => setUser(data))
            .catch(() => navigate("/"))
    }, [navigate])

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
            {user && (
                <div className="card p-4">
                    <h5 style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: "16px" }}>
                        User Details
                    </h5>
                    <table className="table">
                        <tbody>
                            <tr>
                                <td style={{ color: "#94a3b8", width: "140px", fontWeight: 500 }}>ID</td>
                                <td style={{ color: "#e2e8f0" }}>{user.id}</td>
                            </tr>
                            <tr>
                                <td style={{ color: "#94a3b8", width: "140px", fontWeight: 500 }}>Username</td>
                                <td style={{ color: "#e2e8f0" }}>{user.username}</td>
                            </tr>
                            <tr>
                                <td style={{ color: "#94a3b8", width: "140px", fontWeight: 500 }}>Email</td>
                                <td style={{ color: "#e2e8f0" }}>{user.email}</td>
                            </tr>
                            <tr>
                                <td style={{ color: "#94a3b8", width: "140px", fontWeight: 500 }}>Role</td>
                                <td><span style={{
                                    color: "#06b6d4",
                                    background: "rgba(6, 182, 212, 0.1)",
                                    padding: "2px 10px",
                                    borderRadius: "4px",
                                    border: "1px solid rgba(6, 182, 212, 0.3)",
                                    fontSize: "0.8rem",
                                }}>{user.role_name}</span></td>
                            </tr>
                            <tr>
                                <td style={{ color: "#94a3b8", width: "140px", fontWeight: 500 }}>Department</td>
                                <td style={{ color: "#e2e8f0" }}>{user.department_name}</td>
                            </tr>
                            <tr>
                                <td style={{ color: "#94a3b8", width: "140px", fontWeight: 500 }}>Status</td>
                                <td>
                                    <span className={`badge ${user.status === "ACTIVE" ? "bg-success" : "bg-danger"}`}>
                                        {user.status}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </>
    )
}
