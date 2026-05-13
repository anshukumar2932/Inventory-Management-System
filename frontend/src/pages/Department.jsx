import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

const DEPT_API = "http://localhost:8000/api/v1/auth/departments/"
const USER_API = "http://localhost:8000/api/v1/auth/users/"
const ME_API = "http://localhost:8000/api/v1/auth/me/"

const getRole = () => {
    try { return JSON.parse(localStorage.getItem("user")).role_name }
    catch { return null }
}
const getUser = () => {
    try { return JSON.parse(localStorage.getItem("user")) }
    catch { return null }
}
const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("access")}`,
    "Content-Type": "application/json",
})

const ROLE_OPTIONS = [
    { value: "SUPER_ADMIN", label: "Super Admin" },
    { value: "DEPARTMENT_ADMIN", label: "Department Admin" },
    { value: "MANAGER", label: "Inventory Manager" },
    { value: "USER", label: "User" },
]

export default function Department() {
    const navigate = useNavigate()
    const role = getRole()
    const user = getUser()
    const isSuper = role === "SUPER_ADMIN"
    const isDeptAdmin = role === "DEPARTMENT_ADMIN"
    const isManager = role === "MANAGER"
    const isUser = role === "USER"

    const [departments, setDepartments] = useState([])
    const [selectedDept, setSelectedDept] = useState(null)
    const [deptUsers, setDeptUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [showAddDept, setShowAddDept] = useState(false)
    const [showAddUser, setShowAddUser] = useState(false)
    const [newDeptName, setNewDeptName] = useState("")
    const [userForm, setUserForm] = useState({
        username: "", email: "", password: "", role: "USER",
    })
    const [editUser, setEditUser] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    useEffect(() => {
        if (isUser) { navigate("/dashboard"); return }
        fetchDepartments()
    }, [])

    const msg = (text, type = "success") => {
        if (type === "success") setSuccess(text); else setError(text)
        setTimeout(() => { setSuccess(""); setError("") }, 3000)
    }

    const fetchDepartments = async () => {
        const res = await fetch(DEPT_API, { headers: headers() })
        if (res.status === 401) { localStorage.clear(); navigate("/"); return }
        const d = await res.json()
        setDepartments(d.results || d)
    }

    const fetchDeptUsers = async (deptId) => {
        setLoadingUsers(true)
        const res = await fetch(`${USER_API}?department=${deptId}`, { headers: headers() })
        const d = await res.json()
        setDeptUsers(d.results || d)
        setLoadingUsers(false)
    }

    const toggleDept = (dept) => {
        if (selectedDept?.id === dept.id) {
            setSelectedDept(null)
            setDeptUsers([])
        } else {
            setSelectedDept(dept)
            fetchDeptUsers(dept.id)
        }
    }

    const addDepartment = async () => {
        if (!newDeptName.trim()) return
        setError("")
        const res = await fetch(DEPT_API, {
            method: "POST", headers: headers(),
            body: JSON.stringify({ department_name: newDeptName.trim() }),
        })
        if (res.ok) {
            msg("Department created")
            setNewDeptName("")
            setShowAddDept(false)
            fetchDepartments()
        } else {
            const data = await res.json()
            msg(Object.values(data).flat().join(", "), "error")
        }
    }

    const openEditUser = (u) => {
        setEditUser(u)
        setEditForm({ username: u.username, email: u.email || "", role: u.role, status: u.status || "ACTIVE" })
    }

    const saveUser = async () => {
        if (!editUser) return
        const res = await fetch(`${USER_API}${editUser.id}/`, {
            method: "PATCH", headers: headers(),
            body: JSON.stringify(editForm),
        })
        if (res.ok) {
            msg("User updated")
            setEditUser(null)
            if (selectedDept) fetchDeptUsers(selectedDept.id)
        } else {
            const data = await res.json()
            msg(Object.values(data).flat().join(", "), "error")
        }
    }

    const deleteUser = async (u) => {
        if (!confirm(`Delete user "${u.username}"?`)) return
        const res = await fetch(`${USER_API}${u.id}/`, {
            method: "DELETE", headers: headers(),
        })
        if (res.ok) {
            msg("User deleted")
            if (selectedDept) fetchDeptUsers(selectedDept.id)
        }
    }

    const toggleBlockUser = async (u) => {
        const newStatus = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
        const res = await fetch(`${USER_API}${u.id}/`, {
            method: "PATCH", headers: headers(),
            body: JSON.stringify({ status: newStatus }),
        })
        if (res.ok) {
            msg(newStatus === "ACTIVE" ? "User unlocked" : "User blocked")
            if (selectedDept) fetchDeptUsers(selectedDept.id)
        }
    }

    const addUser = async () => {
        if (!userForm.username.trim() || !userForm.password.trim()) {
            msg("Username and password required", "error"); return
        }
        setError("")
        const body = {
            ...userForm,
            department: isDeptAdmin ? user.department : parseInt(userForm.department),
        }
        if (isDeptAdmin) body.department = user.department
        const res = await fetch(USER_API, {
            method: "POST", headers: headers(),
            body: JSON.stringify(body),
        })
        if (res.ok) {
            msg("User created")
            setUserForm({ username: "", email: "", password: "", role: "USER" })
            setShowAddUser(false)
            if (selectedDept) fetchDeptUsers(selectedDept.id)
        } else {
            const data = await res.json()
            msg(Object.values(data).flat().join(", "), "error")
        }
    }

    if (isUser) return null

    return (
        <>
            {success && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 9999,
                    background: "rgba(34,197,94,0.15)", color: "#22c55e",
                    border: "1px solid rgba(34,197,94,0.3)",
                    padding: "12px 24px", borderRadius: 8, fontSize: "0.9rem",
                }}>{success}</div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 style={{
                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontWeight: 700, fontSize: "1.75rem", margin: 0,
                }}>Organization</h1>
                <div className="d-flex gap-2">
                    {isSuper && (
                        <button className="btn btn-primary" onClick={() => setShowAddDept(!showAddDept)}>
                            + Department
                        </button>
                    )}
                    {(isSuper || isDeptAdmin) && (
                        <button className="btn btn-success" onClick={() => setShowAddUser(!showAddUser)}>
                            + User
                        </button>
                    )}
                </div>
            </div>

            {showAddDept && isSuper && (
                <div className="card p-3 mb-4" style={{ maxWidth: 500 }}>
                    <h5 style={{ color: "#e2e8f0", marginBottom: "12px" }}>New Department</h5>
                    <input className="form-control mb-2" placeholder="Department name"
                        value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} />
                    <div className="d-flex gap-2">
                        <button className="btn btn-primary" onClick={addDepartment}>Create</button>
                        <button className="btn btn-outline-secondary" onClick={() => setShowAddDept(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {showAddUser && (isSuper || isDeptAdmin) && (
                <div className="card p-3 mb-4" style={{ maxWidth: 500 }}>
                    <h5 style={{ color: "#e2e8f0", marginBottom: "12px" }}>New User</h5>
                    <input className="form-control mb-2" placeholder="Username"
                        value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
                    <input className="form-control mb-2" type="email" placeholder="Email"
                        value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                    <input className="form-control mb-2" type="password" placeholder="Password"
                        value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />

                    {!isDeptAdmin && (
                        <select className="form-control mb-2"
                            value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}>
                            <option value="">Select Department</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.department_name}</option>
                            ))}
                        </select>
                    )}
                    {isDeptAdmin && (
                        <div className="mb-2" style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "8px 0" }}>
                            Department: <strong style={{ color: "#e2e8f0" }}>{user?.department_name || "—"}</strong>
                        </div>
                    )}

                    <select className="form-control mb-2"
                        value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                        <option value="">Select Role</option>
                        {ROLE_OPTIONS.filter((r) => isSuper || r.value !== "SUPER_ADMIN").map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>

                    <div className="d-flex gap-2">
                        <button className="btn btn-success" onClick={addUser}>Create</button>
                        <button className="btn btn-outline-secondary" onClick={() => setShowAddUser(false)}>Cancel</button>
                    </div>
                    {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", marginTop: "8px" }}>{error}</div>}
                </div>
            )}

            <div className="row g-3">
                {departments
                    .filter((d) => isSuper || d.id === user?.department)
                    .map((dept) => (
                    <div key={dept.id} className="col-md-6">
                        <div className="card p-0" style={{ overflow: "hidden" }}>
                            <div className="p-3 d-flex justify-content-between align-items-center"
                                style={{ cursor: "pointer", borderBottom: "1px solid rgba(148,163,184,0.1)" }}
                                onClick={() => toggleDept(dept)}>
                                <div>
                                    <h5 style={{ color: "#e2e8f0", margin: 0, fontSize: "1rem" }}>
                                        {dept.department_name}
                                    </h5>
                                    {dept.code && <small style={{ color: "#64748b" }}>{dept.code}</small>}
                                </div>
                                <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                                    {selectedDept?.id === dept.id ? "▲" : "▼"}
                                </span>
                            </div>

                            {selectedDept?.id === dept.id && (
                                <div style={{ padding: "12px 16px" }}>
                                    {loadingUsers ? (
                                        <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Loading...</p>
                                    ) : deptUsers.length === 0 ? (
                                        <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No users in this department</p>
                                    ) : (
                                        <table className="table" style={{ margin: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", padding: "4px 8px", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>Username</th>
                                                    <th style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", padding: "4px 8px", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>Role</th>
                                                    <th style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", padding: "4px 8px", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>Email</th>
                                                    <th style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", padding: "4px 8px", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>Status</th>
                                                    <th style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", padding: "4px 8px", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deptUsers.map((u) => (
                                                    <tr key={u.id}>
                                                        <td style={{ color: "#e2e8f0", fontSize: "0.85rem", padding: "6px 8px" }}>{u.username}</td>
                                                        <td style={{ fontSize: "0.85rem", padding: "6px 8px" }}>
                                                            <span style={{
                                                                background: "rgba(6,182,212,0.15)", color: "#06b6d4",
                                                                padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600,
                                                            }}>{u.role_name}</span>
                                                        </td>
                                                        <td style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "6px 8px" }}>{u.email}</td>
                                                        <td style={{ fontSize: "0.85rem", padding: "6px 8px" }}>
                                                            <span style={{
                                                                background: u.status === "ACTIVE" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                                                                color: u.status === "ACTIVE" ? "#22c55e" : "#ef4444",
                                                                padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600,
                                                            }}>{u.status || "ACTIVE"}</span>
                                                        </td>
                                                        <td style={{ padding: "6px 8px" }}>
                                                            <div className="d-flex gap-1">
                                                                {(isSuper || isDeptAdmin) && (
                                                                    <>
                                                                        <button className="btn btn-sm" style={{
                                                                            border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                                                                            borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                        }} onClick={() => openEditUser(u)}>Edit</button>
                                                                        <button className="btn btn-sm" style={{
                                                                            border: `1px solid ${u.status === "ACTIVE" ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                                                                            color: u.status === "ACTIVE" ? "#ef4444" : "#22c55e",
                                                                            borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                        }} onClick={() => toggleBlockUser(u)}>
                                                                            {u.status === "ACTIVE" ? "Block" : "Unblock"}
                                                                        </button>
                                                                        {isSuper && (
                                                                            <button className="btn btn-sm" style={{
                                                                                border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                                                borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                            }} onClick={() => deleteUser(u)}>Del</button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {editUser && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)", zIndex: 9999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                }} onClick={() => setEditUser(null)}>
                    <div className="card p-4" style={{ maxWidth: 450, width: "90%" }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 style={{ color: "#e2e8f0", margin: 0 }}>Edit User: {editUser.username}</h5>
                            <button onClick={() => setEditUser(null)}
                                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
                        </div>
                        <label className="form-label">Username</label>
                        <input className="form-control mb-2" value={editForm.username}
                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                        <label className="form-label">Email</label>
                        <input className="form-control mb-2" type="email" value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                        <label className="form-label">Role</label>
                        <select className="form-control mb-2" value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                            {ROLE_OPTIONS.filter((r) => isSuper || r.value !== "SUPER_ADMIN").map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                        <label className="form-label">Password <small style={{color:"#64748b"}}>(leave blank to keep current)</small></label>
                        <input className="form-control mb-3" type="password" placeholder="New password"
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                        <div className="d-flex gap-2">
                            <button className="btn btn-primary" onClick={saveUser}>Save</button>
                            <button className="btn btn-outline-secondary" onClick={() => setEditUser(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
