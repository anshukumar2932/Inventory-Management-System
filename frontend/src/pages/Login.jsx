import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Login(){
    const [userid, setUserid] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")

        const res = await fetch("http://localhost:8000/api/v1/auth/login/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: userid, password }),
        })

        if (!res.ok) {
            setError("Invalid credentials")
            return
        }

        const data = await res.json()
        localStorage.setItem("access", data.access)
        localStorage.setItem("refresh", data.refresh)
        localStorage.setItem("user", JSON.stringify(data.user))
        navigate("/dashboard")
    }

    return(
        <div className="d-flex justify-content-center align-items-center"
             style={{
                 minHeight: "100vh",
                 background: "radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.05) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 50%), var(--bg-primary)",
             }}>
            <div className="p-4" style={{
                width: "22rem",
                background: "rgba(17, 24, 39, 0.8)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(148, 163, 184, 0.1)",
                borderRadius: "16px",
                boxShadow: "0 0 40px rgba(6, 182, 212, 0.1)",
            }}>
                <h3 className="text-center mb-1" style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontWeight: 700,
                    fontSize: "1.5rem",
                }}>
                    Welcome Back
                </h3>
                <p className="text-center mb-4" style={{ color: "#64748b", fontSize: "0.875rem" }}>
                    Sign in to your account
                </p>
                {error && (
                    <div className="alert alert-danger py-2" style={{ fontSize: "0.875rem" }}>
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Username</label>
                        <input type="text" className="form-control" value={userid}
                            onChange={(e) => setUserid(e.target.value)} required
                            placeholder="Enter your username" />
                    </div>
                    <div className="mb-4">
                        <label className="form-label">Password</label>
                        <input type="password" className="form-control" value={password}
                            onChange={(e) => setPassword(e.target.value)} required
                            placeholder="Enter your password" />
                    </div>
                    <button type="submit" className="btn btn-primary w-100">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    )
}
