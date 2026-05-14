import { Component } from "react"

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo })
        if (typeof this.props.onError === "function") {
            this.props.onError(error, errorInfo)
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return typeof this.props.fallback === "function"
                    ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
                    : this.props.fallback
            }

            return (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    minHeight: this.props.inline ? "200px" : "100vh",
                    padding: "40px 20px",
                    background: this.props.inline ? "rgba(15,23,42,0.8)" : "#0f172a",
                }}>
                    <div style={{
                        maxWidth: "480px", width: "100%",
                        background: "#1e293b", borderRadius: "12px",
                        border: "1px solid rgba(239,68,68,0.3)",
                        padding: "32px",
                        textAlign: "center",
                    }}>
                        <div style={{
                            width: "56px", height: "56px", borderRadius: "50%",
                            background: "rgba(239,68,68,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 16px",
                            fontSize: "28px",
                        }}>!</div>
                        <h3 style={{ color: "#ef4444", margin: "0 0 8px", fontSize: "1.1rem" }}>
                            {this.props.title || "Something went wrong"}
                        </h3>
                        <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 20px", lineHeight: 1.5 }}>
                            {this.props.message || "An unexpected error occurred. Please try again."}
                        </p>
                        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                            <button onClick={this.handleReset}
                                style={{
                                    background: "#06b6d4", color: "#fff", border: "none",
                                    borderRadius: "8px", padding: "10px 24px",
                                    fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                                }}>
                                Try Again
                            </button>
                            <button onClick={() => window.location.reload()}
                                style={{
                                    background: "transparent", color: "#94a3b8",
                                    border: "1px solid rgba(148,163,184,0.3)",
                                    borderRadius: "8px", padding: "10px 24px",
                                    fontSize: "0.85rem", cursor: "pointer",
                                }}>
                                Reload Page
                            </button>
                        </div>
                        {this.state.error && (
                            <details style={{ marginTop: "20px", textAlign: "left" }}>
                                <summary style={{ color: "#64748b", fontSize: "0.75rem", cursor: "pointer" }}>
                                    Error Details
                                </summary>
                                <pre style={{
                                    color: "#ef4444", fontSize: "0.7rem", marginTop: "8px",
                                    padding: "12px", background: "rgba(0,0,0,0.3)",
                                    borderRadius: "6px", overflowX: "auto",
                                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                                    maxHeight: "200px", overflowY: "auto",
                                }}>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export function withErrorBoundary(Component, options = {}) {
    return function Wrapped(props) {
        return (
            <ErrorBoundary {...options}>
                <Component {...props} />
            </ErrorBoundary>
        )
    }
}
