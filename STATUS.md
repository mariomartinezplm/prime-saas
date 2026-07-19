# STATUS.md — Prime F&H

> Actualizar este archivo al final de CADA sesión de Claude Code.
> Marcar `[x]` lo completado y anotar en el registro de sesiones.

**Última actualización:** 2026-07-17
**Stack:** Vite + React (SPA/PWA) + Express + MongoDB Atlas — NO Next.js/Supabase (ver `CLAUDE.md`)
**Deploy:** Backend en Railway (`prime-saas-production.up.railway.app`, auto-deploy desde `main`) · Frontend en Hostinger (`https://app.primefh.cl`, subida manual del build)

---

## ✅ ESTADO REAL ACTUAL (verificado en el código, no supuesto)

### Ya construido y funcionando
- **Auth JWT** completo: login dual (paciente / personal), recuperar contraseña, roles `admin` / `professional` / `patient`, middleware `protect` / `authorize`.
- **Dashboards** de admin, profesional (StaffDashboard) y paciente, con navegación por rol.
- **Agenda/citas:** calendario, reserva, cancelación, vista de profesional y admin. Integración con Google Calendar (OAuth) ya implementada.
- **Reglas de negocio YA implementadas en el backend** (`appointmentController.js`):
  - Máximo 4 pacientes simultáneos por profesional por slot ✅ (`MAX_PATIENTS_PER_SLOT`).
  - Descuento de sesión al cancelar dentro de la ventana + devolución si cancela con anticipación ✅ (`$inc sessionsUsed`).
  - Bloqueo de agendamiento si el plan no está activo o venció ✅ (chequea `Plan.status`/`endDate`, y `User.isActive` como fallback).
- **Disponibilidad:** horario recurrente por día de semana + bloqueos puntuales de fecha, ya implementado (`Availability.js`).
- **Historial clínico:** ya existen en `User.js` los campos género, objetivos, contacto de emergencia, enfermedades crónicas, medicamentos, alergias, lesiones, cirugías (con fecha), `lastPaymentDate`, y un campo `assignedProfessional` (string).
- **Evolución:** mediciones corporales (peso + perímetros) con gráficos (`Measurement.js`, `WeightChart`, `PerimeterChart`), registro de ejercicios con gráfico de progresión (`Exercise.js`, `ExerciseProgressChart`), y registros de dolor/EVA con diagrama corporal (`EVA.js`, no estaba en el modelo de negocio original pero ya existe y es útil).
- **PWA:** manifest + service worker ya configurados y funcionando.
- **Landing page** completa en español (marketing, Isapres/Fonasa, equipo, WhatsApp).

### Existe pero con reglas DISTINTAS a las del modelo de negocio objetivo (hay que decidir si se ajusta)
- **Planes:** hoy son `kinesiologia` (10 sesiones fijas), `entrenamiento-2x` / `entrenamiento-3x` (por semana), con ciclos `mensual/trimestral/semestral/anual` de **mes calendario**. El objetivo es: Entrenamiento 4/8/12/16 sesiones, Kinesiología 5/10/20 sesiones, **ciclo de 30 días desde la fecha de pago**. No coincide — requiere decidir migración de datos si hay planes activos reales.
- **Ventana de agendamiento:** el backend exige **24 horas** de anticipación para agendar (`PATIENT_BOOK_AHEAD_HOURS`). El objetivo dice **4 horas**. La cancelación sí usa 4 horas correctamente.
- **`assignedProfessional`** es un campo de texto libre en `User.js`, no una referencia real (`ObjectId`) al profesional — funciona como dato pero no fuerza integridad ni permite queries robustas ("mis pacientes asignados").

### NO existe todavía (confirmado por búsqueda en el código)
- Sesiones extra otorgadas manualmente por el profesional (con motivo).
- Sistema de notificaciones in-app (campanita/badge) — no hay modelo `Notification` ni componente de UI.
- Emails de notificación de evolución modificada / plan por vencer / plan vencido (sí existe email de cita creada).
- Wellness check-in diario (sliders de sueño/energía/estrés/dolor/ánimo) — no hay modelo ni pantalla.
- Subida de archivos del paciente (PDFs/imágenes de exámenes) — no hay modelo `ClientFile` ni endpoint de upload.
- Campos de altura, peso base y "fuma sí/no" en el historial clínico (el peso sí se registra como serie de tiempo en Evolución, pero no como dato base del historial).
- Bloqueo de solo-lectura explícito en evolución cuando el plan vence (existe el bloqueo de agendar; falta confirmar/implementar el de evolución).

---

## 📋 CHECKLIST — ETAPAS 2 A 7

### ETAPA 2 — PLANES Y AGENDAMIENTO
**Parte A: Planes**
- [ ] Migrar `Plan.js` a las reglas objetivo (Entrenamiento 4/8/12/16, Kinesiología 5/10/20, ciclo 30 días desde el pago)
- [ ] Registro de pago por admin con trazabilidad clara (quién lo registró y cuándo)
- [ ] Alerta de plan por vencer (5 días antes) en panel admin/profesional
- [ ] Profesional: agregar sesiones extra a sus pacientes asignados (con motivo opcional)
- [x] Bloqueo automático al vencer plan (agendar) — ya implementado
- [ ] Bloqueo automático al vencer plan (registrar evolución) — confirmar/implementar
- [ ] Mensaje "Contacta a Prime F&H para renovar" + botón WhatsApp cuando el plan venció

**Parte B: Calendario**
- [x] Máximo 4 pacientes simultáneos por profesional — ya implementado
- [ ] Cambiar ventana de agendamiento de 24h a 4h (o confirmar con Mario si 24h es intencional)
- [x] Cancelación con regla de 4 horas (devuelve o descuenta sesión) — ya implementado
- [x] Disponibilidad recurrente por día de semana + bloqueos puntuales — ya implementado
- [ ] Agenda recurrente (agendar múltiples sesiones de una vez, avisar slots llenos)
- [x] Vista de agenda de profesional y admin — ya implementado
- [ ] Convertir `assignedProfessional` en referencia real (`ObjectId`) al usuario profesional

### ETAPA 3 — PERFIL COMPLETO DEL PACIENTE
- [x] Información personal (ya existe, confirmar que sea editable desde el perfil del paciente)
- [x] Historial clínico (la mayoría de los campos ya existen en `User.js`) — falta altura, peso base, fuma sí/no
- [ ] Sección Archivos: subir/ver/descargar PDFs e imágenes (paciente y profesional)
- [x] Evolución corporal: peso + perímetros con gráficos — ya implementado
- [x] Ejercicios: registro y gráfico de progresión — ya implementado
- [ ] Notificación al profesional cuando el paciente registra/modifica evolución
- [ ] Reportes admin con export CSV

### ETAPA 4 — NOTIFICACIONES
- [ ] Modelo `Notification` + campanita con badge en las 3 vistas
- [ ] Eventos: evolución modificada, plan por vencer, plan vencido, cita agendada/cancelada
- [ ] Emails espejo de notificaciones importantes

### ETAPA 5 — WELLNESS CHECK-IN
- [ ] Modelo + formulario diario de 5 sliders + notas (1 por paciente por día)
- [ ] Alerta al profesional si promedio < 2.5
- [ ] Dashboard de tendencias para el profesional

### ETAPA 6 — WHATSAPP VÍA N8N (postergada hasta que Mario lo pida explícitamente)
- [ ] Webhook al completar sesión
- [ ] Mensaje post-sesión por WhatsApp
- [ ] Recordatorio D-1 por WhatsApp

### ETAPA 7 — CAPACITOR / APP NATIVA (postergada, solo si hace falta)
- [ ] Evaluar necesidad real vs. PWA actual
- [ ] APK Android firmado si se decide seguir por este camino

---

## 📝 REGISTRO DE SESIONES

| Fecha | Etapa | Qué se hizo | Modelo | Commit | Notas / pendientes |
|---|---|---|---|---|---|
| 2026-07-17 | Infraestructura/Deploy | Diagnóstico y arreglo completo del sitio caído: (1) Railway — el trial gratuito había expirado, se pagó el plan y redesplegó solo; (2) `app.primefh.cl` nunca se había publicado — se creó el subdominio en Hostinger, se corrigió `.env.production` (faltaba `/api` en `VITE_API_URL`), se compiló el frontend y se subió manualmente vía File Manager; (3) bug de CORS — `FRONTEND_URL` en Railway apuntaba a sí mismo en vez de a `https://app.primefh.cl`, corregido y redesplegado. Se limpiaron archivos basura sueltos en `backend/`. | Sonnet 5 | `744264d` | Login con la cuenta semilla (`mario@primefh.cl`) dio credenciales inválidas — revisar/resetear si se necesita acceso admin. |
| 2026-07-17 | Documentación | Se reescribieron `CLAUDE.md` y `STATUS.md` completos: el `CLAUDE.md` anterior describía un stack (Next.js + Supabase) que nunca se construyó — se reemplazó por el stack real (Vite + Express + MongoDB) y el modelo de negocio objetivo. `STATUS.md` se rehízo con un inventario verificado del código (qué existe, qué existe con reglas distintas, qué falta) y un checklist de Etapas 2 a 7. | Sonnet 5 | (pendiente) | Definir con Mario: ¿se ajustan los planes/ventana de agendamiento a las reglas objetivo, o las reglas objetivo se ajustan a lo ya construido? |

---

## 🚀 ANTES DE ONBOARDEAR PACIENTES REALES

- [ ] Backups de MongoDB Atlas activados y probados
- [ ] Revisar reglas de negocio ajustadas (Etapa 2) antes de cobrar planes reales
- [ ] Datos de prueba (seed) eliminados o separados de datos reales
- [ ] Probado flujo completo: onboarding → agendar → cancelar → evolución → notificación
