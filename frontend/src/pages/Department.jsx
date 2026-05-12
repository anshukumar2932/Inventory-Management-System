import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

const DEPT_API = "http://localhost:8000/api/v1/auth/departments/"
const USER_API = "http://localhost:8000/api/v1/auth/users/"

const getRole = () => {
    try {
        return JSON.parse(localStorage.getItem("user")).role_name
    } catch {
        return null
    }
}

const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("access")}`,
    "Content-Type": "application/json",
})

export default function Department() {
    const admin = getRole() === "ADMIN"
    const user = getRole() === "USER"
    const im = getRole() === "INVENTORY MANAGER"

    const navigate = useNavigate()

    const [departments, setDepartments] = useState([])
    const [users, setUsers] = useState([])

    const [departmentName, setDepartmentName] = useState("")

    const [userData, setUserData] = useState({
        username: "",
        email: "",
        password: "",
        department: "",
        role: "",
    })

    useEffect(() => {
        fetchDepartments()
        fetchUsers()
    }, [])

    const logout = () => {
        localStorage.clear()
        navigate("/")
    }

    const fetchDepartments = async () => {

        const res = await fetch(DEPT_API, {
            headers: headers(),
        })

        if (res.status === 401) return logout()

        const d = await res.json()

        setDepartments(d.results || d)
    }

    const fetchUsers = async () => {

        const res = await fetch(USER_API, {
            headers: headers(),
        })

        if (res.status === 401) return logout()

        const d = await res.json()

        setUsers(d.results || d)
    }

    const addDepartment = async () => {

        if (!departmentName.trim()) return

        const res = await fetch(DEPT_API, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
                department_name: departmentName
            })
        })

        const data = await res.json()

        if (!res.ok) {
            alert(JSON.stringify(data))
            return
        }

        setDepartmentName("")
        fetchDepartments()
    }

    const addUser = async () => {

        const res = await fetch(USER_API, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(userData)
        })

        const data = await res.json()

        if (!res.ok) {
            alert(JSON.stringify(data))
            return
        }

        setUserData({
            username: "",
            email: "",
            password: "",
            department: "",
            role: "",
        })

        fetchUsers()
    }

    return (
        <div className="container py-4">

            <h1 className="mb-4">Department Management</h1>
            {admin &&
                <div className="card p-3 mb-4">

                    <h4>Add Department</h4>

                    <input
                        type="text"
                        className="form-control mb-2"
                        placeholder="Department Name"
                        value={departmentName}
                        onChange={(e) => setDepartmentName(e.target.value)}
                    />

                    <button
                        className="btn btn-primary"
                        onClick={addDepartment}
                    >
                        Add Department
                    </button>
                </div>
            }
            {admin&&
                <div className="card p-3 mb-4">

                    <h4>Add User</h4>

                    <input
                        type="text"
                        className="form-control mb-2"
                        placeholder="Username"
                        value={userData.username}
                        onChange={(e) =>
                            setUserData({
                                ...userData,
                                username: e.target.value
                            })
                        }
                    />

                    <input
                        type="email"
                        className="form-control mb-2"
                        placeholder="Email"
                        value={userData.email}
                        onChange={(e) =>
                            setUserData({
                                ...userData,
                                email: e.target.value
                            })
                        }
                    />

                    <input
                        type="password"
                        className="form-control mb-2"
                        placeholder="Password"
                        value={userData.password}
                        onChange={(e) =>
                            setUserData({
                                ...userData,
                                password: e.target.value
                            })
                        }
                    />

                    <select
                        className="form-control mb-2"
                        value={userData.department}
                        onChange={(e) =>
                            setUserData({
                                ...userData,
                                department: e.target.value
                            })
                        }
                    >
                        <option value="">Select Department</option>

                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.department_name}
                            </option>
                        ))}
                    </select>

                    <select
                        className="form-control mb-2"
                        value={userData.role}
                        onChange={(e) =>
                            setUserData({
                                ...userData,
                                role: e.target.value
                            })
                        }
                    >
                        <option value="">Select Role</option>
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Inventory Manager</option>
                        <option value="USER">User</option>
                    </select>

                    <button
                        className="btn btn-success"
                        onClick={addUser}
                    >
                        Add User
                    </button>
                </div>
            }
            
            <div className="card p-3">

                <h4>Departments</h4>

                {departments.map((d) => (
                    <div key={d.id}>
                        {d.department_name}
                    </div>
                ))}
            </div>

            {admin &&<div className="card p-3 mt-4">

                    <h4>Users</h4>

                    {users.map((u) => (
                        <div key={u.id}>
                            {u.username} - {u.department_name}
                        </div>
                    ))}
                </div>
            }
        </div>
    )
}