import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { API_BASE, apiGet, apiPost, apiPatch, apiDelete } from "../lib/api"
import { getRole, getUser } from "../lib/auth"

const DEPT_API = `${API_BASE}/api/v1/auth/departments/`
const USER_API = `${API_BASE}/api/v1/auth/users/`
const ME_API = `${API_BASE}/api/v1/auth/me/`
const SVC_API = `${API_BASE}/api/v1/assets/service-types/`
const CAT_API = `${API_BASE}/api/v1/assets/categories/`

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
    const [deptServicesList, setDeptServicesList] = useState([])
    const [editingSvcId, setEditingSvcId] = useState(null)
    const [editingSvcName, setEditingSvcName] = useState("")
    const [newSvcName, setNewSvcName] = useState("")
    const [allCategories, setAllCategories] = useState([])
    const [editingCatId, setEditingCatId] = useState(null)
    const [editingCatName, setEditingCatName] = useState("")
    const [newCatName, setNewCatName] = useState("")
    const [showAddDept, setShowAddDept] = useState(false)
    const [showAddUser, setShowAddUser] = useState(false)
    const [newDeptName, setNewDeptName] = useState("")
    const [deptServices, setDeptServices] = useState([""])
    const [userForm, setUserForm] = useState({
        username: "", email: "", password: "", role: "USER", showPassword: false,
    })
    const [editUser, setEditUser] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    useEffect(() => {
        if (isUser) { navigate("/dashboard"); return }
        fetchDepartments()
        fetchCategories()
    }, [])

    const fetchCategories = async () => {
        const res = await apiGet(CAT_API)
        if (!res.ok) return
        const d = await res.json()
        setAllCategories(d.results || d)
    }

    const msg = (text, type = "success") => {
        if (type === "success") setSuccess(text); else setError(text)
        setTimeout(() => { setSuccess(""); setError("") }, 3000)
    }

    const fetchDepartments = async () => {
        const res = await apiGet(DEPT_API)
        if (!res.ok) return
        const d = await res.json()
        setDepartments(d.results || d)
    }

    const fetchDeptUsers = async (deptId) => {
        setLoadingUsers(true)
        const res = await apiGet(`${USER_API}?department=${deptId}`)
        const d = await res.json()
        setDeptUsers(d.results || d)
        setLoadingUsers(false)
    }

    const fetchDeptServices = async (deptId) => {
        const res = await apiGet(`${SVC_API}?department=${deptId}`)
        if (!res.ok) return
        const d = await res.json()
        setDeptServicesList(d.results || d)
    }

    const addService = async (deptId) => {
        if (!newSvcName.trim()) return
        const res = await apiPost(SVC_API, { name: newSvcName.trim(), department: deptId, description: "", is_global: false })
        if (res.ok) {
            msg("Service added")
            setNewSvcName("")
            fetchDeptServices(deptId)
            fetchDepartments()
        } else {
            const data = await res.json()
            msg(Object.values(data).flat().join(", "), "error")
        }
    }

    const startEditSvc = (svc) => {
        setEditingSvcId(svc.id)
        setEditingSvcName(svc.name)
    }

    const saveSvc = async (deptId) => {
        if (!editingSvcName.trim()) return
        const res = await apiPatch(`${SVC_API}${editingSvcId}/`, { name: editingSvcName.trim() })
        if (res.ok) {
            msg("Service updated")
            setEditingSvcId(null)
            setEditingSvcName("")
            fetchDeptServices(deptId)
            fetchDepartments()
        } else {
            const data = await res.json()
            msg(Object.values(data).flat().join(", "), "error")
        }
    }

    const deleteSvc = async (svc, deptId) => {
        if (!confirm(`Delete service "${svc.name}"?`)) return
        const res = await apiDelete(`${SVC_API}${svc.id}/`)
        if (res.ok) {
            msg("Service deleted")
            fetchDeptServices(deptId)
            fetchDepartments()
        }
    }

    const addCategory = async () => {
        if (!newCatName.trim()) return
        const res = await apiPost(CAT_API, { name: newCatName.trim() })
        if (res.ok) {
            msg("Category added")
            setNewCatName("")
            fetchCategories()
        } else {
            const data = await res.json()
            msg(Object.values(data).flat().join(", "), "error")
        }
    }

    const startEditCat = (cat) => {
        setEditingCatId(cat.id)
        setEditingCatName(cat.name)
    }

    const saveCat = async () => {
        if (!editingCatName.trim()) return
        const res = await apiPatch(`${CAT_API}${editingCatId}/`, { name: editingCatName.trim() })
        if (res.ok) {
            msg("Category updated")
            setEditingCatId(null)
            setEditingCatName("")
            fetchCategories()
        } else {
            const data = await res.json()
            msg(Object.values(data).flat().join(", "), "error")
        }
    }

    const deleteCat = async (cat) => {
        if (!confirm(`Delete category "${cat.name}"?`)) return
        const res = await apiDelete(`${CAT_API}${cat.id}/`)
        if (res.ok) {
            msg("Category deleted")
            fetchCategories()
        }
    }

    const toggleDept = (dept) => {
        if (selectedDept?.id === dept.id) {
            setSelectedDept(null)
            setDeptUsers([])
            setDeptServicesList([])
        } else {
            setSelectedDept(dept)
            fetchDeptUsers(dept.id)
            fetchDeptServices(dept.id)
        }
    }

    const addDepartment = async () => {
        if (!newDeptName.trim()) return
        const services = deptServices.map(s => s.trim()).filter(Boolean)
        if (services.length === 0) { msg("At least one service is required", "error"); return }
        setError("")
        const res = await apiPost(DEPT_API, { department_name: newDeptName.trim(), services })
        if (res.ok) {
            msg("Department created")
            setNewDeptName("")
            setDeptServices([""])
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
        const res = await apiPatch(`${USER_API}${editUser.id}/`, editForm)
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
        const res = await apiDelete(`${USER_API}${u.id}/`)
        if (res.ok) {
            msg("User deleted")
            if (selectedDept) fetchDeptUsers(selectedDept.id)
        }
    }

    const toggleBlockUser = async (u) => {
        const newStatus = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
        const res = await apiPatch(`${USER_API}${u.id}/`, { status: newStatus })
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
        const res = await apiPost(USER_API, body)
        if (res.ok) {
            msg("User created")
            setUserForm({ username: "", email: "", password: "", role: "USER", showPassword: false })
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
                    <label style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: "6px", display: "block" }}>
                        Services <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    {deptServices.map((svc, idx) => (
                        <div key={idx} className="d-flex gap-2 mb-2">
                            <input className="form-control" placeholder="e.g. IT Support, AMC, Warranty"
                                value={svc} onChange={(e) => {
                                    const copy = [...deptServices]
                                    copy[idx] = e.target.value
                                    setDeptServices(copy)
                                }} />
                            {deptServices.length > 1 && (
                                <button className="btn btn-sm" style={{
                                    border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                    borderRadius: "6px", padding: "4px 12px", background: "transparent",
                                }} onClick={() => setDeptServices(deptServices.filter((_, i) => i !== idx))}>✕</button>
                            )}
                        </div>
                    ))}
                    <button className="btn btn-sm mb-3" style={{
                        border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                        borderRadius: "6px", padding: "4px 12px", background: "transparent",
                    }} onClick={() => setDeptServices([...deptServices, ""])}>+ Add more</button>
                    <div className="d-flex gap-2">
                        <button className="btn btn-primary" onClick={addDepartment}
                            disabled={!newDeptName.trim() || deptServices.every(s => !s.trim())}>Create</button>
                        <button className="btn btn-outline-secondary" onClick={() => {
                            setShowAddDept(false)
                            setDeptServices([""])
                        }}>Cancel</button>
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
                    <div className="position-relative mb-2">
                        <input className="form-control pe-5" type={userForm.showPassword ? "text" : "password"} placeholder="Password"
                            value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                        <button type="button" className="password-toggle"
                            onClick={() => setUserForm({ ...userForm, showPassword: !userForm.showPassword })}
                            aria-label={userForm.showPassword ? "Hide password" : "Show password"} tabIndex={-1}>
                            {userForm.showPassword ? (
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
                                    {dept.service_names && dept.service_names.length > 0 && (
                                        <div style={{ marginTop: "4px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                            {dept.service_names.map((sn, i) => (
                                                <span key={i} style={{
                                                    background: "rgba(6,182,212,0.12)", color: "#06b6d4",
                                                    padding: "1px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 500,
                                                }}>{sn}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                                    {selectedDept?.id === dept.id ? "▲" : "▼"}
                                </span>
                            </div>

                            {selectedDept?.id === dept.id && (
                                <div style={{ padding: "12px 16px" }}>
                                    <h6 style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.75rem", marginBottom: "8px" }}>
                                        Users ({deptUsers.length})
                                    </h6>
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

                                    <hr style={{ borderColor: "rgba(148,163,184,0.1)", margin: "12px 0" }} />

                                    <h6 style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.75rem", marginBottom: "8px" }}>
                                        Services ({deptServicesList.length})
                                    </h6>
                                    {deptServicesList.filter(s => s.department === dept.id).length === 0 ? (
                                        <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No services for this department</p>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                                            {deptServicesList.filter(s => s.department === dept.id).map((svc) => (
                                                <div key={svc.id} className="d-flex align-items-center gap-2"
                                                    style={{ padding: "6px 8px", border: "1px solid rgba(148,163,184,0.1)", borderRadius: "6px" }}>
                                                    {editingSvcId === svc.id ? (
                                                        <input className="form-control form-control-sm"
                                                            value={editingSvcName}
                                                            onChange={(e) => setEditingSvcName(e.target.value)}
                                                            onKeyDown={(e) => e.key === "Enter" && saveSvc(dept.id)}
                                                            style={{ flex: 1 }} autoFocus />
                                                    ) : (
                                                        <span style={{ color: "#e2e8f0", fontSize: "0.85rem", flex: 1 }}>{svc.name}</span>
                                                    )}
                                                    {isSuper && (
                                                        <div className="d-flex gap-1">
                                                            {editingSvcId === svc.id ? (
                                                                <>
                                                                    <button className="btn btn-sm" style={{
                                                                        border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e",
                                                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                    }} onClick={() => saveSvc(dept.id)}>Save</button>
                                                                    <button className="btn btn-sm" style={{
                                                                        border: "1px solid rgba(148,163,184,0.3)", color: "#94a3b8",
                                                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                    }} onClick={() => { setEditingSvcId(null); setEditingSvcName("") }}>Cancel</button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button className="btn btn-sm" style={{
                                                                        border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                                                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                    }} onClick={() => startEditSvc(svc)}>Edit</button>
                                                                    <button className="btn btn-sm" style={{
                                                                        border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                    }} onClick={() => deleteSvc(svc, dept.id)}>Del</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {isSuper && (
                                        <div className="d-flex gap-2">
                                            <input className="form-control form-control-sm" placeholder="New service name"
                                                value={newSvcName} onChange={(e) => setNewSvcName(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && addService(dept.id)} />
                                            <button className="btn btn-sm" style={{
                                                border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e",
                                                borderRadius: "6px", padding: "4px 12px", background: "transparent",
                                            }} onClick={() => addService(dept.id)}
                                            disabled={!newSvcName.trim()}>+ Add</button>
                                        </div>
                                    )}

                                    <hr style={{ borderColor: "rgba(148,163,184,0.1)", margin: "12px 0" }} />

                                    <h6 style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.75rem", marginBottom: "8px" }}>
                                        Categories ({allCategories.length})
                                    </h6>
                                    {allCategories.length === 0 ? (
                                        <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No categories defined</p>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                                            {allCategories.map((cat) => (
                                                <div key={cat.id} className="d-flex align-items-center gap-2"
                                                    style={{ padding: "6px 8px", border: "1px solid rgba(148,163,184,0.1)", borderRadius: "6px" }}>
                                                    {editingCatId === cat.id ? (
                                                        <input className="form-control form-control-sm"
                                                            value={editingCatName}
                                                            onChange={(e) => setEditingCatName(e.target.value)}
                                                            onKeyDown={(e) => e.key === "Enter" && saveCat()}
                                                            style={{ flex: 1 }} autoFocus />
                                                    ) : (
                                                        <span style={{ color: "#e2e8f0", fontSize: "0.85rem", flex: 1 }}>{cat.name}</span>
                                                    )}
                                                    {isSuper && (
                                                        <div className="d-flex gap-1">
                                                            {editingCatId === cat.id ? (
                                                                <>
                                                                    <button className="btn btn-sm" style={{
                                                                        border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e",
                                                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                    }} onClick={() => saveCat()}>Save</button>
                                                                    <button className="btn btn-sm" style={{
                                                                        border: "1px solid rgba(148,163,184,0.3)", color: "#94a3b8",
                                                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                    }} onClick={() => { setEditingCatId(null); setEditingCatName("") }}>Cancel</button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button className="btn btn-sm" style={{
                                                                        border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4",
                                                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                    }} onClick={() => startEditCat(cat)}>Edit</button>
                                                                    <button className="btn btn-sm" style={{
                                                                        border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                                                                        borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", background: "transparent",
                                                                    }} onClick={() => deleteCat(cat)}>Del</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {isSuper && (
                                        <div className="d-flex gap-2">
                                            <input className="form-control form-control-sm" placeholder="New category name"
                                                value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && addCategory()} />
                                            <button className="btn btn-sm" style={{
                                                border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e",
                                                borderRadius: "6px", padding: "4px 12px", background: "transparent",
                                            }} onClick={() => addCategory()}
                                            disabled={!newCatName.trim()}>+ Add</button>
                                        </div>
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
                        <div className="position-relative mb-3">
                            <input className="form-control pe-5" type={editForm.showPassword ? "text" : "password"} placeholder="New password"
                                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                            <button type="button" className="password-toggle"
                                onClick={() => setEditForm({ ...editForm, showPassword: !editForm.showPassword })}
                                aria-label={editForm.showPassword ? "Hide password" : "Show password"} tabIndex={-1}>
                                {editForm.showPassword ? (
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
