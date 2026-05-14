import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Login(){
    const [userid, setUserid] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const { login, user } = useAuth()

    if (user) {
        navigate("/dashboard")
        return null
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            await login(userid, password)
            navigate("/dashboard")
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
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
                    <div className="alert alert-danger py-2 d-flex align-items-center gap-2" style={{ fontSize: "0.875rem" }}>
                        <span>{error}</span>
                        <button type="button" className="btn-close btn-close-white ms-auto" style={{ fontSize: "0.6rem" }}
                            onClick={() => setError("")} aria-label="Dismiss"></button>
                    </div>
                )}
                <form onSubmit={handleSubmit} autoComplete="off">
                    <div className="mb-3">
                        <label className="form-label" htmlFor="login-username">Username</label>
                        <input id="login-username" type="text" className="form-control" value={userid}
                            onChange={(e) => setUserid(e.target.value)} required autoFocus
                            placeholder="Enter your username" autoComplete="username" />
                    </div>
                    <div className="mb-4">
                        <label className="form-label" htmlFor="login-password">Password</label>
                        <div className="position-relative">
                            <input id="login-password"
                                type={showPassword ? "text" : "password"}
                                className="form-control pe-5" value={password}
                                onChange={(e) => setPassword(e.target.value)} required
                                placeholder="Enter your password" autoComplete="current-password" />
                            <button type="button" className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                tabIndex={-1}>
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                        <line x1="1" y1="1" x2="23" y2="23"/>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                        disabled={loading}>
                        {loading && (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        )}
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    )
}
