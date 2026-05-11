import { BrowserRouter, Routes, Route } from "react-router-dom"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Assets from "./pages/Assets"
import Repairs from "./pages/Repairs"
import Audits from "./pages/Audits"
import Vendors from "./pages/Vendors"
import Reports from "./pages/Reports"
import Layout from "./components/Layout"

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route element={<Layout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/assets" element={<Assets />} />
                    <Route path="/repairs" element={<Repairs />} />
                    <Route path="/audits" element={<Audits />} />
                    <Route path="/vendors" element={<Vendors />} />
                    <Route path="/reports" element={<Reports />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
