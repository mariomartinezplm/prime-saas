import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/guards/ProtectedRoute";
import RoleRoute from "@/components/guards/RoleRoute";
import AppLayout from "@/components/layouts/AppLayout";

// Public pages
import Index from "./pages/Index";
import LoginDual from "./pages/LoginDual";
import RecoverPassword from "./pages/RecoverPassword";
import AcceptInvite from "./pages/AcceptInvite";
import ResetPassword from "./pages/ResetPassword";
import ThankYou from "./pages/ThankYou";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

// Patient pages
import PatientDashboard from "./pages/patient/Dashboard";
import BookAppointment from "./pages/patient/BookAppointment";
import MyAppointments from "./pages/patient/MyAppointments";
import MyProfile from "./pages/patient/MyProfile";
import PatientMeasurements from "./pages/patient/Measurements";
import PatientExercises from "./pages/patient/Exercises";
import PainRecords from "./pages/patient/PainRecords";
import Subscription from "./pages/patient/Subscription";

// Admin/Staff pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminCalendar from "./pages/admin/Calendar";
import PatientList from "./pages/admin/PatientList";
import PatientDetail from "./pages/admin/PatientDetail";
import RegisterPatient from "./pages/admin/RegisterPatient";
import AdminPlans from "./pages/admin/Plans";
import AdminAvailability from "./pages/admin/Availability";

// Shared pages
import SettingsPage from "./pages/shared/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginDual />} />
            <Route path="/recuperar-contrasena" element={<RecoverPassword />} />
            <Route path="/invitacion/:token" element={<AcceptInvite />} />
            <Route path="/restablecer/:token" element={<ResetPassword />} />
            <Route path="/gracias" element={<ThankYou />} />
            <Route path="/privacidad" element={<Privacy />} />
            <Route path="/terminos" element={<Terms />} />

            {/* Patient Portal redirection */}
            <Route path="/patient-portal" element={<Navigate to="/app/dashboard" replace />} />

            {/* Protected app routes */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Patient routes — protegidas también por rol (Paso 14 de
                  BLUEPRINT.md): antes, un profesional o admin podía navegar
                  a estas rutas del paciente sin ningún guard de rol. */}
              <Route
                path="dashboard"
                element={<RoleRoute roles={['patient']}><PatientDashboard /></RoleRoute>}
              />
              <Route
                path="reservar"
                element={<RoleRoute roles={['patient']}><BookAppointment /></RoleRoute>}
              />
              <Route
                path="mis-citas"
                element={<RoleRoute roles={['patient']}><MyAppointments /></RoleRoute>}
              />
              <Route
                path="mi-perfil"
                element={<RoleRoute roles={['patient']}><MyProfile /></RoleRoute>}
              />
              <Route
                path="mediciones"
                element={<RoleRoute roles={['patient']}><PatientMeasurements /></RoleRoute>}
              />
              <Route
                path="ejercicios"
                element={<RoleRoute roles={['patient']}><PatientExercises /></RoleRoute>}
              />
              <Route
                path="dolor"
                element={<RoleRoute roles={['patient']}><PainRecords /></RoleRoute>}
              />
              {/* "planes" (Subscription) no está en la lista del blueprint
                  para este paso — se deja sin guard de rol, igual que antes */}
              <Route path="planes" element={<Subscription />} />

              {/* Admin/Staff routes */}
              <Route
                path="admin"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <AdminDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/calendario"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <AdminCalendar />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/pacientes"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <PatientList />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/pacientes/:id"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <PatientDetail />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/registro"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <RegisterPatient />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/citas"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <AdminCalendar />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/planes"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <AdminPlans />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/disponibilidad"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <AdminAvailability />
                  </RoleRoute>
                }
              />

              {/* Shared routes */}
              <Route path="configuracion" element={<SettingsPage />} />

              {/* Default redirect */}
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
