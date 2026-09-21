import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/guards/ProtectedRoute";
import RoleRoute from "@/components/guards/RoleRoute";
import AppLayout from "@/components/layouts/AppLayout";
import { isLandingDomain, redirectToApp } from "@/lib/domain";
import { useEffect } from "react";

// Public pages
import Index from "./pages/Index";
import LoginDual from "./pages/LoginDual";
import RecoverPassword from "./pages/RecoverPassword";
import AcceptInvite from "./pages/AcceptInvite";
import ResetPassword from "./pages/ResetPassword";
import ThankYou from "./pages/ThankYou";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import InstallApp from "./pages/InstallApp";
import NotFound from "./pages/NotFound";

// Patient pages
import PatientDashboard from "./pages/patient/Dashboard";
import BookAppointment from "./pages/patient/BookAppointment";
import MyAppointments from "./pages/patient/MyAppointments";
import MyProfile from "./pages/patient/MyProfile";
import PatientMeasurements from "./pages/patient/Measurements";
import PatientExercises from "./pages/patient/Exercises";
import PainRecords from "./pages/patient/PainRecords";

// Admin/Staff pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminCalendar from "./pages/admin/Calendar";
import PatientList from "./pages/admin/PatientList";
import PatientDetail from "./pages/admin/PatientDetail";
import RegisterPatient from "./pages/admin/RegisterPatient";
import AdminPlans from "./pages/admin/Plans";
import ClassifyPlans from "./pages/admin/ClassifyPlans";
import AdminAvailability from "./pages/admin/Availability";

// Shared pages
import SettingsPage from "./pages/shared/Settings";
import GoogleCalendarCallback from "./pages/shared/GoogleCalendarCallback";

const queryClient = new QueryClient();

// Rutas fuera de lo que primefh.cl (landing) sirve: se redirigen a
// app.primefh.cl conservando la ruta (login, /app/*, callback, etc.)
const RedirectToApp = () => {
  useEffect(() => {
    redirectToApp(`${window.location.pathname}${window.location.search}`);
  }, []);
  return null;
};

const App = () => {
  const landingOnly = isLandingDomain();

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Rutas públicas de la landing: viven en ambos dominios porque
                localhost (dev) no pasa por isLandingDomain() y necesita ver
                todo; en producción, primefh.cl solo expone estas. */}
            <Route path="/" element={<Index />} />
            <Route path="/gracias" element={<ThankYou />} />
            <Route path="/privacidad" element={<Privacy />} />
            <Route path="/terminos" element={<Terms />} />
            <Route path="/instalar" element={<InstallApp />} />

            {landingOnly ? (
              /* primefh.cl: cualquier otra ruta (login, /app/*, etc.)
                 no existe acá — se manda a app.primefh.cl */
              <Route path="*" element={<RedirectToApp />} />
            ) : (
              <>
                <Route path="/login" element={<LoginDual />} />
                <Route path="/recuperar-contrasena" element={<RecoverPassword />} />
                <Route path="/invitacion/:token" element={<AcceptInvite />} />
                <Route path="/restablecer/:token" element={<ResetPassword />} />

                {/* Patient Portal redirection */}
                <Route path="/patient-portal" element={<Navigate to="/app/dashboard" replace />} />

                {/* Google redirige aquí tras el OAuth de Calendario (Paso 28.A) */}
                <Route
                  path="/auth/google/callback"
                  element={
                    <ProtectedRoute>
                      <GoogleCalendarCallback />
                    </ProtectedRoute>
                  }
                />

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
                path="admin/planes/clasificar"
                element={
                  <RoleRoute roles={['admin', 'professional']}>
                    <ClassifyPlans />
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
              </>
            )}
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
