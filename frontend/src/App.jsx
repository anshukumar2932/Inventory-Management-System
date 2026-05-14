import { BrowserRouter, Routes, Route } from "react-router-dom"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Assets from "./pages/Assets"
import BulkUpload from "./pages/BulkUpload"
import Repairs from "./pages/Repairs"
import AuditScanner from "./pages/AuditScanner"
import Vendors from "./pages/Vendors"
import AddVendor from "./pages/AddVendor"
import Reports from "./pages/Reports"
import Layout from "./components/Layout"
import Location from "./pages/Location"
import Category from "./pages/Category"
import Department from "./pages/Department"
import ServiceTypes from "./pages/ServiceTypes"
import Procurements from "./pages/Procurements"
import NewProcurement from "./pages/NewProcurement"
import ProcurementDetail from "./pages/ProcurementDetail"

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route element={<Layout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/assets" element={<Assets />} />
                    <Route path="/bulk_upload" element={<BulkUpload />} />
                    <Route path="/repairs" element={<Repairs />} />
                    <Route path="/audits" element={<AuditScanner />} />
                    <Route path="/vendors" element={<Vendors />} />
                    <Route path="/vendors/new" element={<AddVendor />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/location" element={<Location />} />
                    <Route path="/category" element={<Category />} />
                    <Route path="/department" element={<Department />}/>
                    <Route path="/procurements" element={<Procurements />} />
                    <Route path="/procurements/new" element={<NewProcurement />} />
                    <Route path="/procurements/:id" element={<ProcurementDetail />} />
                    <Route path="/service-types" element={<ServiceTypes />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
