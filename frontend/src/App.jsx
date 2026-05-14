import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ToastProvider } from "./components/ToastContainer"
import ErrorBoundary from "./components/ErrorBoundary"
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
import Notifications from "./pages/Notifications"

export default function App() {
    return (
        <ErrorBoundary title="Application Crashed" message="A critical error occurred. Please reload the application.">
            <BrowserRouter>
                <AuthProvider>
                    <ToastProvider>
                        <Routes>
                            <Route path="/" element={
                                <ErrorBoundary inline title="Login Failed" message="Could not load the login page.">
                                    <Login />
                                </ErrorBoundary>
                            } />
                            <Route element={<Layout />}>
                                <Route path="/dashboard" element={
                                    <ErrorBoundary inline title="Dashboard Error" message="Could not load dashboard.">
                                        <Dashboard />
                                    </ErrorBoundary>
                                } />
                                <Route path="/assets" element={
                                    <ErrorBoundary inline title="Assets Error" message="Could not load assets.">
                                        <Assets />
                                    </ErrorBoundary>
                                } />
                                <Route path="/bulk_upload" element={
                                    <ErrorBoundary inline title="Upload Error" message="Could not load bulk upload.">
                                        <BulkUpload />
                                    </ErrorBoundary>
                                } />
                                <Route path="/repairs" element={
                                    <ErrorBoundary inline title="Repairs Error" message="Could not load repairs.">
                                        <Repairs />
                                    </ErrorBoundary>
                                } />
                                <Route path="/audits" element={
                                    <ErrorBoundary inline title="Audits Error" message="Could not load audits.">
                                        <AuditScanner />
                                    </ErrorBoundary>
                                } />
                                <Route path="/vendors" element={
                                    <ErrorBoundary inline title="Vendors Error" message="Could not load vendors.">
                                        <Vendors />
                                    </ErrorBoundary>
                                } />
                                <Route path="/vendors/new" element={
                                    <ErrorBoundary inline title="Add Vendor Error" message="Could not load vendor form.">
                                        <AddVendor />
                                    </ErrorBoundary>
                                } />
                                <Route path="/reports" element={
                                    <ErrorBoundary inline title="Reports Error" message="Could not load reports.">
                                        <Reports />
                                    </ErrorBoundary>
                                } />
                                <Route path="/location" element={
                                    <ErrorBoundary inline title="Locations Error" message="Could not load locations.">
                                        <Location />
                                    </ErrorBoundary>
                                } />
                                <Route path="/category" element={
                                    <ErrorBoundary inline title="Categories Error" message="Could not load categories.">
                                        <Category />
                                    </ErrorBoundary>
                                } />
                                <Route path="/department" element={
                                    <ErrorBoundary inline title="Departments Error" message="Could not load departments.">
                                        <Department />
                                    </ErrorBoundary>
                                } />
                                <Route path="/procurements" element={
                                    <ErrorBoundary inline title="Procurements Error" message="Could not load procurements.">
                                        <Procurements />
                                    </ErrorBoundary>
                                } />
                                <Route path="/procurements/new" element={
                                    <ErrorBoundary inline title="New Procurement Error" message="Could not load procurement form.">
                                        <NewProcurement />
                                    </ErrorBoundary>
                                } />
                                <Route path="/procurements/:id" element={
                                    <ErrorBoundary inline title="Procurement Detail Error" message="Could not load procurement details.">
                                        <ProcurementDetail />
                                    </ErrorBoundary>
                                } />
                                <Route path="/service-types" element={
                                    <ErrorBoundary inline title="Service Types Error" message="Could not load service types.">
                                        <ServiceTypes />
                                    </ErrorBoundary>
                                } />
                                <Route path="/notifications" element={
                                    <ErrorBoundary inline title="Notifications Error" message="Could not load notifications.">
                                        <Notifications />
                                    </ErrorBoundary>
                                } />
                            </Route>
                        </Routes>
                    </ToastProvider>
                </AuthProvider>
            </BrowserRouter>
        </ErrorBoundary>
    )
}
