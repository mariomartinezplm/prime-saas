# BLUEPRINT.md — Prime F&H

> **Plano maestro del proyecto.** Generado el 2026-08-05 con la metodología **The Architect** ([Hainrixz/the-architect](https://github.com/Hainrixz/the-architect)) en modo *brownfield* (proyecto existente — nada se reconstruye desde cero, se arregla y se construye encima).
> **Cómo se usa:** una sesión de Claude Code = un paso de la sección 09 (ORDEN DE CONSTRUCCIÓN), en orden. Cada paso trae su verificación con comandos y su checkpoint de git. Este documento manda sobre `PROMPTS.md` cuando se contradigan; las reglas de trabajo de `CLAUDE.md` (raíz del repo) siguen vigentes siempre.

---

## 📌 RESUMEN EJECUTIVO (léeme primero, Mario)

**Lo que ya funciona:** login por roles (admin/profesional/paciente), agenda con la regla de 4 pacientes simultáneos, cancelación con regla de 4 horas, disponibilidad por profesional, sistema de planes nuevo (etapa 2, a medias), mediciones/ejercicios/dolor con gráficos, PWA instalada en producción.

**Lo que está roto y es PELIGROSO (hoy, en producción, con datos de salud):**

| ID | Vulnerabilidad | En simple |
|---|---|---|
| V1 | `forgot-password` devuelve el token de reseteo en la respuesta | Cualquiera que sepa el email de un paciente puede robarle la cuenta en 30 segundos |
| V2 | Recuperación con RUT + fecha de nacimiento, sin límite de intentos | El RUT y la fecha de nacimiento son datos semi-públicos en Chile → toma de cuenta |
| V3 | Login con email desconocido crea cuenta automática desde Airtable con contraseña `123456` | Puerta trasera masiva |
| V4 | 5+ endpoints sin chequeo de pertenencia (IDOR) | Un paciente puede leer la ficha médica completa de otro cambiando el ID en la URL |
| V5 | El rol se acepta tal cual desde el formulario | Un profesional puede crearse una cuenta admin |
| V6 | Sin rate limiting, sin helmet, sin sanitización NoSQL, contraseñas de 6 caracteres | Se pueden probar contraseñas infinitamente |
| V7 | ~~`.env.production` en el historial de git~~ — **falso positivo, verificado en el Paso 03** | El archivo solo contenía `VITE_API_URL` (dirección pública de la API, visible igual en el bundle). Un barrido del historial completo no encontró **ninguna** credencial real. No hubo filtración ni hace falta rotar |
| V8 | El descuento de sesiones del plan nuevo **nunca ocurre** (`sessionsUsed` jamás se incrementa) | Los planes no se gastan; conviven 2 sistemas de planes que se contradicen |
| V9 | Google Calendar no funciona y es inseguro (tokens que se pierden en silencio, cliente OAuth compartido) | Se pone en cuarentena hasta rediseñarlo |
| V10 | El historial médico completo del usuario se guarda en `localStorage` del navegador | Datos de salud sin protección en el dispositivo |
| V11 | 2 endpoints devuelven error 500 siempre (bugs de código) | Mediciones por paciente y zonas de dolor |
| V12 | `/app/planes` muestra **precios** y la ventana de agendamiento es 24h (las reglas dicen sin precios y 4h) | Contradice tu modelo de negocio |

**Decisiones ya tomadas (entrevista 2026-08-05):** (1) se cierran las 3 puertas de entrada antiguas — solo invitación por email + reset por email; (2) sesión de 30 días renovable y revocable (access token 1h + refresh token 30d); (3) archivos médicos en **Cloudflare R2** privado con URLs firmadas; (4) emails con **Resend** y dominio primefh.cl verificado.

**Orden de ataque:** FASE A (pasos 01–07) tapa los hoyos de seguridad — **empezar HOY**. FASE B construye la autenticación definitiva. FASE C consolida planes y agenda. FASE D completa las features que faltan (notificaciones, archivos, wellness, PWA pulida, respaldos).

---

## 01 · Visión general y Non-Goals

### 1.1 Qué es

Sistema de gestión de pacientes para **Prime F&H**, centro de kinesiología y entrenamiento en Puerto Montt, Chile. PWA mobile-first en `https://app.primefh.cl`. Usuarios: Mario (admin), kinesiólogos/entrenadores (professional) y pacientes (patient). Maneja **datos de salud** (historial clínico, evolución, dolor) — eso eleva el estándar de seguridad de todo el diseño (ver §14).

### 1.2 Estado actual → Estado objetivo (brownfield)

| Área | Hoy | Objetivo |
|---|---|---|
| Auth | JWT 7 días en localStorage; registro público; recuperación por RUT+fecha; Airtable crea cuentas con `123456` | Solo invitación por email; reset por email; access 1h en memoria + refresh 30d rotativo en cookie httpOnly, revocable |
| Autorización | Chequeos de pertenencia ad-hoc y con hoyos (V4, V5) | Middleware único de pertenencia + matriz de permisos (§8.4) aplicada en el servidor en cada endpoint |
| Planes | 2 sistemas en paralelo; el descuento de sesiones no existe (V8) | `ClientPlan` única fuente: Entrenamiento 4/8/12/16, Kinesiología 5/10/20, ciclo 30 días desde el pago, descuento/devolución según reglas |
| Agenda | Máx 4 simultáneos ✅; cancelación 4h ✅; ventana 24h ❌ | Ventana 4h; agenda recurrente con todas las reglas; cron de expiración diario |
| Perfil | Info + historial clínico parcial; sin archivos | 5 secciones completas incl. archivos en R2 |
| Notificaciones | Solo email de cita al profesional | Campanita in-app + espejo por email (Resend) para los eventos del modelo de negocio |
| Wellness | No existe | Check-in diario 5 sliders + alerta < 2.5 |
| Infra | Sin rate limit, sin headers, sin backups, sin tests | Hardening completo + backups + suite de regresión de seguridad |

### 1.3 Métricas de éxito v1

1. 0 vulnerabilidades V1–V7 verificables (los smoke tests de §20 pasan).
2. Un paciente real completa solo: invitación → contraseña → agendar → cancelar → registrar evolución, desde su celular.
3. El descuento de sesiones cuadra: `sessionsUsed + disponibles = sessionsTotal` en todo momento.
4. Backups automáticos verificados antes del primer paciente real.

### 1.4 Non-Goals (fuera de alcance, con gatillo de revisión)

| Non-Goal | Gatillo para revisitar |
|---|---|
| WhatsApp vía N8N (recordatorios, post-sesión) | 2+ semanas de pacientes reales usando la app (regla de `PROMPTS.md`) |
| Capacitor / app nativa | Solo si la PWA demuestra ser insuficiente (mes 3+) |
| Pasarela de pago | El pago se registra manualmente por el admin — decisión de negocio firme |
| Precios visibles en la app | Nunca (regla de negocio); plan vencido → mensaje + botón WhatsApp |
| 2FA para staff | Al superar ~50 pacientes activos o si un incidente lo amerita |
| Cifrado a nivel de campo del historial clínico | Si un auditor o la fiscalización de la Ley 21.719 lo exige; v1 = cifrado at-rest de Atlas + control de acceso estricto (§14) |
| Migrar de stack (Next.js/Supabase/etc.) | Nunca sin decisión explícita de Mario — regla de `CLAUDE.md` |
| Tiempo real (websockets) para notificaciones | Polling de 60s es suficiente a esta escala |

---

## 02 · Stack tecnológico

**Regla brownfield: las convenciones del repo mandan.** No se agrega tecnología que duplique algo ya presente.

| Capa | Tecnología | Versión (lockfile) | Nota |
|---|---|---|---|
| Frontend | Vite + React 18 + TypeScript | según `package.json` raíz | SPA con React Router v6 |
| UI | Tailwind CSS 3.4 + shadcn/ui (48 componentes) + lucide-react | — | Mobile-first, modo claro forzado |
| Gráficos | Recharts | — | Único stack de gráficos permitido (chart.js presente solo en mocks → se elimina con ellos) |
| PWA | vite-plugin-pwa (`registerType: autoUpdate`, skipWaiting) | — | Ya funcionando |
| Backend | Node.js + Express 4 (ES Modules) | — | En `/backend` |
| BDD | MongoDB Atlas + Mongoose 8 | — | Cluster actual (verificar tier en §16) |
| Auth | JWT (jsonwebtoken) + bcryptjs | — | Se extiende con refresh tokens (§8) |
| Email | **Resend** (decisión entrevista) | nueva dep §11 | Reemplaza gradualmente a nodemailer/SMTP |
| Archivos | **Cloudflare R2** (S3-compatible, decisión entrevista) | SDK nueva dep §11 | Bucket privado + URLs firmadas |
| Deploy backend | Railway (auto-deploy push a `main`) + **dominio `api.primefh.cl`** (nuevo, §12) | — | Cron de Railway para tareas programadas |
| Deploy frontend | Hostinger, `https://app.primefh.cl`, build manual | — | Procedimiento en §12.3 |

---

## 03 · Estructura de directorios

### 3.1 Actual (resumen de lo relevante)

```
Prime-Saas/
├── backend/
│   ├── server.js                  # entrada Express, CORS, montaje de rutas
│   ├── config/planCatalog.js      # catálogo 4/8/12/16 y 5/10/20 ✅
│   ├── middleware/ auth.js · error.js
│   ├── models/ User · Plan(legacy) · ClientPlan · ExtraSession · Appointment · Availability · Measurement · Exercise · EVA
│   ├── controllers/ (9)  ├── routes/ (11)  ├── services/clientPlanService.js
│   ├── scripts/ expirePlans.js · migraciones con dry-run (patrón a reutilizar)
│   └── utils/ emailService.js · airtableSync.js (a eliminar) · seed.js
├── src/
│   ├── App.tsx                    # todas las rutas
│   ├── lib/api.ts                 # axios + interceptores
│   ├── contexts/AuthContext.tsx
│   ├── components/ ui/ · guards/ · booking/ · charts/ · forms/ · body/ · layouts/ · staff/ (mocks)
│   ├── pages/ admin/ · patient/ · LoginDual · RecoverPassword · …
│   └── services/ (10 módulos axios)
├── public/icons/                  # ¡VACÍO! los íconos del manifest dan 404 (V-PWA)
├── CLAUDE.md · STATUS.md · BLUEPRINT.md (este archivo)
```

### 3.2 Delta — archivos que este plano crea/elimina

| Acción | Ruta | Paso §9 |
|---|---|---|
| Crear | `backend/middleware/rateLimiter.js` | 06 |
| Crear | `backend/middleware/ownership.js` (o revivir `authorizeOwnerOrAdmin` en `auth.js`) | 04 |
| Crear | `backend/middleware/validate.js` + `backend/validators/*.js` (express-validator) | 06 |
| Crear | `backend/models/RefreshToken.js` | 08 |
| Crear | `backend/services/emailService.js` (rework sobre Resend, reemplaza `utils/emailService.js`) | 11 |
| Crear | `backend/services/inviteService.js` | 12 |
| Crear | `backend/models/Notification.js` + `backend/services/notificationService.js` | 19 |
| Crear | `backend/models/ClientFile.js` + `backend/services/storageService.js` (R2) | 21 |
| Crear | `backend/models/WellnessCheckin.js` | 23 |
| Crear | `backend/tests/` (vitest + supertest) | 07+ |
| Crear | `src/pages/AcceptInvite.tsx` · `src/pages/ResetPassword.tsx` | 13 |
| Eliminar | `backend/utils/airtableSync.js` + hook en login | 02 |
| Eliminar | `src/pages/patient/Subscription.tsx` (muestra precios) | 18 |
| Eliminar | `src/pages/StaffDashboard.tsx` + `components/staff/*` mocks + `src/pages/Login.tsx` (muerto) | 14 |
| Eliminar del tracking | `.env.production`, `dev-dist/` | 03, 26 |

---

## 04 · Modelo de datos

### 4.1 Modelos existentes que se mantienen

`User`, `ClientPlan`, `ExtraSession`, `Appointment`, `Availability`, `Measurement`, `Exercise` (ExerciseProgress), `EVA`. El historial clínico vive **embebido en `User.medicalInfo`** — se mantiene así (un solo documento por paciente, lecturas simples).

### 4.2 Cambios a modelos existentes

| Modelo | Cambio | Paso |
|---|---|---|
| `User` | + `invite: { tokenHash: String, expiresAt: Date, usedAt: Date }` (token de invitación hasheado, un solo uso, 7 días) | 12 |
| `User` | password `minlength` 6 → **8** (aplica a contraseñas nuevas; las existentes siguen sirviendo para login hasta que se cambien) | 05 |
| `User` | + `medicalInfo.heightCm: Number`, `medicalInfo.baseWeightKg: Number`, `medicalInfo.smoker: Boolean` | 25 |
| `User` | `assignedProfessionalId` (ObjectId → User) queda como **campo canónico** de asignación; `assignedProfessional` (texto libre de Airtable) queda solo-lectura legacy | 04 |
| `Appointment` | + `sessionDeducted: Boolean` (default false), + `deduction: { source: 'clientPlan'\|'extraSession', refId: ObjectId }` | 15 |
| `Plan` (legacy) | **Deprecación**: migración de datos activos a `ClientPlan` con script dry-run (patrón de `backend/scripts/`), luego se eliminan modelo, controlador y rutas | 16 |

### 4.3 Modelos nuevos

**`RefreshToken`** (paso 08) — `user` (ref), `tokenHash` (sha256, unique index), `familyId` (String — detecta robo/reuso), `expiresAt` (Date, index TTL), `revokedAt`, `replacedByHash`, `userAgent`, `ip`. Rotación: cada refresh emite token nuevo y marca el anterior como reemplazado; si llega un token ya reemplazado/revocado → se revoca **toda la familia** (posible robo).

**`Notification`** (paso 19) — `user` (ref, destinatario), `type` (enum: `evolution_updated`, `plan_expiring`, `plan_expired`, `appointment_booked`, `appointment_cancelled`, `wellness_alert`), `title`, `body`, `link`, `read` (default false), `readAt`. Índice `{ user: 1, read: 1, createdAt: -1 }`.

**`WellnessCheckin`** (paso 23) — `patient` (ref), `date` (String `YYYY-MM-DD`, zona America/Santiago), `sleep`, `energy`, `stress`, `soreness`, `mood` (todos Number 1–5), `notes`. **Índice único `{ patient: 1, date: 1 }`** — 1 check-in por día garantizado por la BDD, no por el frontend.

**`ClientFile`** (paso 21) — `patient` (ref), `uploadedBy` (ref), `fileName`, `storageKey` (key en R2, nunca URL pública), `mimeType` (enum: `application/pdf`, `image/jpeg`, `image/png`), `sizeBytes` (max 10 MB), `description`. Índice `{ patient: 1, createdAt: -1 }`.

### 4.4 Reglas de integridad clave

- Descuento de sesión = **al agendar** (modelo "la sesión vuelve al plan si cancela con 4+ horas" implica que se tomó al reservar): `$inc { sessionsUsed: 1 }` **atómico y condicionado** (`sessionsUsed < sessionsTotal`) para que dos reservas no consuman la última sesión a la vez. Orden de consumo: primero el plan activo del `serviceType` de la cita; si está agotado, una `ExtraSession` no usada del mismo tipo (`used: true, usedAt, usedInAppointment`). La cita `evaluacion` consume del plan activo que exista (decisión por defecto — Mario puede ajustarla).
- Devolución (cancelación ≥4h o cancelación administrativa): `$inc { sessionsUsed: -1 }` condicionado (`sessionsUsed > 0`) o `used: false` en la extra, según `deduction.source`. Completed / no-show / cancelación <4h: la sesión ya descontada **no** se devuelve.
- Cupos simultáneos: tras insertar la cita se recuenta la ocupación de cada tramo de 30 min tocado; si algún tramo supera 4, se elimina la cita propia y se responde 409 (re-verificación dentro del write, ya que Mongo no permite constraint declarativo aquí).

---

## 05 · Diseño de API

### 5.1 Convenciones

- Base: `https://api.primefh.cl/api` (producción, desde paso 09) · `http://localhost:5000/api` (dev).
- Envelope: `{ success: boolean, message?: string, data?: any, code?: string }` — patrón existente; `code` para errores accionables por el frontend (ej. `NO_ACTIVE_PLAN_SESSIONS`, ya implementado, y nuevos: `INVITE_EXPIRED`, `RATE_LIMITED`, `SLOT_FULL`, `BOOKING_WINDOW`).
- Paginación: `?page=&limit=` con `limit` máx 50 (hoy `GET /users` usa 50 — se estandariza).
- Errores: 400 validación · 401 sin/mal token · 403 sin permiso · 404 no existe **o no te pertenece** (no revelar existencia de recursos ajenos) · 409 conflicto (cupo/última sesión) · 429 rate limit.

### 5.2 Matriz de protección de endpoints (estado objetivo)

Guards: `P` = `protect` (autenticado) · `A` = admin · `PR` = professional · `PA` = patient · `own` = middleware de pertenencia (§8.5): el recurso es del propio usuario, o de un paciente asignado al profesional, o quien pide es admin.

| Endpoint | Guard objetivo | Cambio vs hoy |
|---|---|---|
| **`/api/auth`** | | |
| POST `/login` | público + rate 5/15min | + rate limit (paso 06) |
| POST `/refresh` | cookie refresh + rate 60/h | **nuevo** (paso 08) |
| POST `/logout` | P (revoca refresh) | **nuevo** (paso 08) |
| POST `/forgot-password` | público + rate 3/h · respuesta **siempre** `200 {success:true}` (sin enumerar usuarios, sin token en la respuesta) | **fix V1** (paso 01) |
| PUT `/reset-password/:token` | público + rate 5/h | se mantiene (token llegará por email desde paso 13) |
| POST `/accept-invite/:token` | público + rate 5/h | **nuevo** (paso 12) |
| GET `/me` · PUT `/profile` · PUT `/change-password` | P (whitelist de campos propios; nunca `role`, `isActive`, `assignedProfessionalId`) | endurecer (paso 05) |
| ~~POST `/register`~~ · ~~POST `/verify-identity`~~ · ~~PUT `/set-password/:t`~~ | **ELIMINADOS** | **fix V2** (paso 01) |
| **`/api/users`** | | |
| GET `/` | A: todos · PR: **solo sus asignados** (forzado server-side) · PA: 403 | **fix fuga** (paso 04) |
| POST `/` | A (cualquier rol) · PR (solo `role:'patient'` asignado a sí mismo) + dispara invitación | **fix V5** (pasos 05, 12) |
| GET `/:id` · GET `/:id/profile` | P + **own** | **fix V4** (paso 04) |
| PUT `/:id` | A (todo) · PR (solo sus pacientes, whitelist sin `role`/`isActive`) | **fix V5** (paso 05) |
| DELETE `/:id` | **solo A** (soft-delete: `isActive:false`) | endurecer (paso 05) |
| GET `/stats/dashboard` | A · PR (scoped a sus pacientes) | ajustar (paso 04) |
| POST `/sync-airtable` | solo A, crea cuentas **sin contraseña** en estado "invitación pendiente" → **eliminar del todo al cerrar Fase B** | **fix V3** (paso 02) |
| POST `/:id/resend-invite` | A · PR dueño | **nuevo** (paso 12) |
| **`/api/appointments`** | | |
| GET `/availability/:professionalId/:date` | P (PA: solo su profesional asignado → 403 si no) | endurecer (paso 04) |
| GET `/plan-info/:patientId` | P + **own** | **fix V4** (paso 04) |
| GET `/` | P (scoped por rol — ya existe) | — |
| POST `/` | P (PA: solo self + reglas: saldo, 4h, 4 simultáneos, serviceType del plan) · staff: pacientes asignados | reglas completas (pasos 15, 17) |
| POST `/bulk` | idem + **cap 20 citas por request** | (paso 17) |
| GET `/:id` | P + own | ya existe para PA — extender a PR |
| PUT `/:id` (incluye marcar completed/no-show) | A · PR dueño de la cita | endurecer (paso 04) |
| PUT `/:id/cancel` | PA dueño (regla 4h) · PR dueño · A (cancelación administrativa devuelve sesión siempre) | reglas (paso 15) |
| DELETE `/:id` | solo A | endurecer (paso 04) |
| **`/api/measurements`, `/api/exercises`, `/api/eva`** | | |
| POST / PUT | staff (pacientes asignados) · PA self **con plan activo** (gate ya existe ✅) | + notificación al profesional (paso 19) |
| GET (todas las variantes) | P + own (mayoría ya ✅; unificar con middleware) | (paso 04) |
| DELETE | A · PR **asignado** (hoy: cualquier PR) | (paso 04) |
| **`/api/availability`** | | |
| GET | P (PA: solo su profesional) | (paso 04) |
| PUT `/:professionalId/schedule` · POST/DELETE `/block` | A · **PR solo el suyo** (`professionalId === req.user._id`) | **fix** (paso 04) |
| **`/api/client-plans`** | | |
| GET `/` | A · PR (scoped a asignados) | (paso 04) |
| POST `/` · POST `/expire-check` · PUT `/:id/cancel` | solo A (ya ✅) | — |
| GET `/patient/me` · `/balance/me` | P (ya ✅) | — |
| GET `/patient/:id` · `/balance/:id` | P + own (hoy: PR puede leer cualquiera) | (paso 04) |
| **`/api/extra-sessions`** | POST: A·PR asignado (ya ✅) · GET: P + own (ya ✅) | — |
| **`/api/plans`** (legacy) | — | **se eliminan** en paso 16 |
| **`/api/notifications`** (nuevo) | GET `/` · PUT `/:id/read` · PUT `/read-all` · GET `/unread-count` — P, siempre `user: req.user._id` forzado | (paso 19) |
| **`/api/files`** (nuevo) | POST `/patient/:patientId` (multipart, 10 MB, pdf/jpg/png): PA self con plan activo · staff asignado · A. GET `/patient/:patientId`: P + own. GET `/:id/download` (URL firmada 5 min): P + own. DELETE `/:id`: uploader o A | (paso 21) |
| **`/api/wellness`** (nuevo) | POST `/`: PA self con plan activo (1/día por índice único) · GET `/me`: P · GET `/patient/:id`, `/trends`: staff + own | (paso 23) |
| **`/api/google-calendar`** | **cuarentena: 403 tras flag `GOOGLE_CALENDAR_ENABLED`** hasta rediseño (paso 28) | **fix V9** (paso 07) |
| GET `/api/health` (nuevo) | público (sin datos sensibles) | (paso 27) |

### 5.3 Rate limits (tabla normativa — implementación en paso 06)

| Ruta | Límite | Ventana | Clave | Código |
|---|---|---|---|---|
| POST `/auth/login` | 5 | 15 min | IP + email | 429 `RATE_LIMITED` |
| POST `/auth/forgot-password` | 3 | 1 h | IP + email | 429 |
| PUT `/auth/reset-password/*` · POST `/auth/accept-invite/*` | 5 | 1 h | IP | 429 |
| POST `/auth/refresh` | 60 | 1 h | IP | 429 |
| POST `/files/*` (upload) | 20 | 1 h | usuario | 429 |
| API autenticada (general) | 300 | 5 min | usuario | 429 |
| Global (todo `/api`) | 1000 | 15 min | IP | 429 |

Requiere `app.set('trust proxy', 1)` en Railway para que la IP real (X-Forwarded-For) sea la clave.

---

## 06 · Arquitectura frontend

- **Rutas y guards objetivo:** `ProtectedRoute` (existe) + `RoleRoute` (existe) aplicado **también** a las rutas de paciente (`/app/dashboard`, `/app/reservar`, etc. → `roles:['patient']`; `/app/configuracion` compartida). `/staff-dashboard` (mock sin guard) y `Login.tsx` (muerto) se eliminan. Regla: los guards del cliente son **cosméticos** — la seguridad real es del backend (§8).
- **Tokens:** access token **en memoria** (variable del módulo `api.ts` / contexto), nunca en localStorage. Al recargar la página: `POST /auth/refresh` (la cookie viaja sola) → access nuevo → `GET /auth/me`. Interceptor 401: intenta 1 refresh y reintenta la request; si falla → logout limpio. Se elimina la persistencia del objeto `user` (con `medicalInfo`) en localStorage (**fix V10**).
- **Datos:** se mantiene el patrón actual (`useEffect` + services axios). `@tanstack/react-query` queda instalado pero su adopción es Non-Goal v1 (no refactorizar lo que funciona). Prohibido dejar `catch {}` silenciosos en código nuevo: siempre toast de error.
- **Booking:** eliminar el allowlist hardcodeado de nombres de profesionales en `BookAppointment.tsx` — el backend ya sabe quién es el profesional asignado del paciente; el frontend solo lo muestra.

---

## 07 · Sistema de diseño

Se mantiene el existente (Tailwind + shadcn/ui + tokens HSL en `index.css`, modo claro forzado). Correcciones puntuales (paso 26): `theme_color` del manifest `#0EA5E9` → **`#3D9AA6`** (teal de marca) + `<meta name="theme-color">` en `index.html`; íconos PWA reales en `public/icons/` (192, 512, maskable — hoy 404); `lang` del manifest a `es`. Contraste: verificar que el teal `#3D9AA6` sobre blanco solo se use en textos ≥18px o con peso bold (ratio ~3.3:1 — cumple AA solo para texto grande); para texto normal usar el tono oscurecido ya presente en los tokens.

---

## 08 · Autenticación y autorización

### 8.1 Flujos completos

**Onboarding por invitación (único camino de alta de pacientes):**
1. El profesional crea al paciente desde su panel (datos personales + historial clínico). `assignedProfessionalId = req.user._id` forzado en el servidor.
2. El sistema genera token aleatorio (32 bytes), guarda **solo su hash** en `User.invite.tokenHash` con `expiresAt = +7 días`, y envía por **Resend** el email de bienvenida con link `https://app.primefh.cl/invitacion/<token>`.
3. El paciente abre el link → `POST /auth/accept-invite/:token` con su contraseña nueva (≥8) → el token se marca usado (un solo uso) → login automático → dashboard.
4. Token vencido → pantalla "invitación vencida" + el profesional/admin puede reenviar (`POST /users/:id/resend-invite`, regenera token e invalida el anterior).

**Login:** email (o RUT) + contraseña → si ok: access token (JWT, 1 h) en el body + refresh token (opaco, 30 días) en cookie. Sin cuenta local → 401 genérico (ya no se consulta Airtable — V3).

**Reset de contraseña:** `POST /forgot-password` → respuesta genérica 200 siempre; si el email existe, Resend envía link `https://app.primefh.cl/restablecer/<token>` (hash en BDD, 30 min, un uso) → `PUT /reset-password/:token`. El flujo RUT+fecha de nacimiento **desaparece** (V2).

**Expiración de sesión:** access vence a la hora → el interceptor hace refresh silencioso → el usuario no nota nada hasta el día 30 (o hasta revocación).

**Logout:** `POST /auth/logout` revoca el refresh token en BDD + limpia la cookie + borra el access de memoria.

**Baja de cuenta:** el admin desactiva (`isActive: false`, soft-delete); `protect` ya rechaza usuarios inactivos → todas sus sesiones mueren en ≤1 h (cuando venza su access). Eliminación definitiva de datos: solo admin, con la política de retención de §14.5.

### 8.2 Especificación de tokens

| | Access token | Refresh token |
|---|---|---|
| Formato | JWT HS256, payload `{ id, role, tokenVersion }` | Opaco (32 bytes aleatorios), **solo su sha256 en BDD** |
| Vida | **1 h** (`JWT_EXPIRE=1h`) | **30 días**, rotativo en cada uso |
| Dónde vive | Memoria del frontend (nunca storage) | Cookie `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` |
| Revocación | Indirecta (vence en ≤1 h) | Directa: `revokedAt` en BDD; reuso de token rotado → se revoca la familia completa |
| Secreto | `JWT_SECRET` (rotado en paso 03) | No aplica (opaco) |

### 8.3 Requisito de infraestructura: `api.primefh.cl`

La cookie de refresh exige que backend y frontend sean **same-site**. `app.primefh.cl` ↔ `prime-saas-production.up.railway.app` son sitios distintos (Safari/iPhone bloquea esas cookies). Solución (paso 09): dominio custom `api.primefh.cl` en Railway (Mario crea 1 registro CNAME en Hostinger con guía). `app.primefh.cl` y `api.primefh.cl` comparten sitio `primefh.cl` → la cookie `SameSite=Lax` viaja en los `fetch` entre ellos. CORS queda restringido a `https://app.primefh.cl` + localhost en dev, con `credentials: true`.

### 8.4 Matriz de permisos (quién puede qué)

| Recurso / acción | admin | professional | patient |
|---|---|---|---|
| Ver/editar cualquier usuario | ✅ | ❌ (solo sus asignados, sin tocar `role`/`isActive`) | ❌ (solo su perfil, campos propios) |
| Crear usuarios | ✅ cualquier rol | ✅ solo pacientes (quedan asignados a él) | ❌ |
| Asignar/cambiar rol | ✅ | ❌ | ❌ |
| Desactivar/eliminar usuarios | ✅ | ❌ | ❌ |
| Registrar pago (crear ClientPlan) | ✅ | ❌ | ❌ |
| Sesiones extra | ✅ | ✅ a sus asignados, con motivo opcional | ❌ |
| Ver planes/saldo | ✅ todos | ✅ sus asignados | ✅ el suyo |
| Agendar/cancelar citas | ✅ para cualquiera, sin restricción de ventana | ✅ para sus asignados | ✅ solo para sí (ventana 4h, saldo, cupos) |
| Marcar completed/no-show | ✅ | ✅ sus citas | ❌ |
| Configurar disponibilidad | ✅ todas | ✅ **solo la propia** | ❌ |
| Registrar evolución (mediciones/ejercicios/EVA) | ✅ | ✅ sus asignados | ✅ la suya **solo con plan activo** (vencido = solo lectura) |
| Ver evolución | ✅ | ✅ sus asignados | ✅ la suya (siempre, aunque venza el plan) |
| Archivos | ✅ todo | ✅ sus asignados (subir/ver; borrar solo lo propio) | ✅ los suyos (subir con plan activo; ver siempre; borrar solo lo propio) |
| Notificaciones / wellness | ✅ (dashboards globales) | ✅ (sus pacientes) | ✅ (lo suyo) |

### 8.5 Patrón único de pertenencia (fin de los chequeos ad-hoc)

**Regla dura: la autorización se verifica en el servidor en cada request, antes de hacer el trabajo.** Se implementa un middleware/helper único (paso 04) que reemplaza los chequeos dispersos:

```
assertCanAccessPatient(reqUser, patientId):
  admin → ok
  professional → ok si User(patientId).assignedProfessionalId === reqUser._id
  patient → ok si patientId === reqUser._id
  si no → 404 (no revelar existencia)
```

Se monta en TODOS los endpoints con `:patientId`/`:id` de la matriz 5.2. El `authorizeOwnerOrAdmin` existente en `backend/middleware/auth.js:66` (hoy dead code) se reescribe con esta semántica y se usa de verdad.

---

## 09 · ORDEN DE CONSTRUCCIÓN

> **Protocolo:** 1 paso = 1 sesión de Claude Code (`/clear` antes de cada una). Los pasos 01–07 (FASE A) son hotfixes de seguridad: **hacerlos antes que cualquier otra cosa y deployar tras cada uno.** Convenciones de los Verify: `API=http://localhost:5000/api`; para endpoints autenticados, obtener token con:
> ```bash
> TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"<email-de-prueba>","password":"<pass>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
> ```
> Cada Checkpoint: commit + tag → si un paso sale mal, `git reset --hard <tag-anterior>` recupera el estado bueno.

### FASE A — HOTFIXES DE SEGURIDAD (hoy)

---

**Paso 01 — Cerrar la recuperación insegura y el registro público (V1, V2)**

*Do:* En `backend/controllers/authController.js`: (a) `forgotPassword` deja de devolver `resetToken` y responde siempre `200 { success: true, message: 'Si el email existe, recibirás instrucciones.' }` (también cuando el usuario no existe — sin enumeración); (b) eliminar `verifyIdentity` y `setNewPassword` y sus rutas `POST /verify-identity`, `PUT /set-password/:verifyToken`; (c) eliminar `register` y su ruta `POST /register`. En frontend: `RecoverPassword.tsx` muestra interim "Para recuperar tu acceso, contacta a Prime F&H por WhatsApp" (botón con `config/contact.ts`) — el reset real por email llega en el paso 13.

*Done when:*
- CUANDO llega `POST /api/auth/forgot-password` con un email existente EL SISTEMA DEBE responder 200 sin ningún campo `resetToken` en el body.
- CUANDO llega `POST /api/auth/forgot-password` con un email inexistente EL SISTEMA DEBE responder exactamente igual (200, mismo mensaje).
- CUANDO llega `POST /api/auth/register`, `POST /api/auth/verify-identity` o `PUT /api/auth/set-password/x` EL SISTEMA DEBE responder 404.

*Verify:*
```bash
curl -s -X POST $API/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"noexiste@nada.cl"}' | grep -c resetToken   # espera: 0
curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/register -H 'Content-Type: application/json' -d '{}'   # espera: 404
grep -rn "verifyIdentity\|setNewPassword" backend/routes backend/controllers | wc -l   # espera: 0
```

*Checkpoint:* `git add -A && git commit -m "step 01: fix(seguridad): cerrar recuperacion insegura y registro publico" && git tag step-01-auth-doors`

---

**Paso 02 — Eliminar la puerta trasera de Airtable (V3)**

*Do:* En `backend/controllers/authController.js` (líneas ~88–98): eliminar la llamada a `syncPatientByEmail()` dentro de `login` (login con email desconocido → 401 genérico, punto). En `backend/utils/airtableSync.js`: eliminar `password: '123456'`; las cuentas importadas se crean sin contraseña utilizable (password aleatorio de 32 bytes) y quedarán pendientes de invitación (paso 12). `POST /api/users/sync-airtable` pasa de `authorize('admin','professional')` a `authorize('admin')`. Neutralizar también `backend/scripts/update_passwords.js` (V-adjacente: resetea todas las contraseñas a valores hardcodeados) — se elimina el archivo.

*Done when:*
- CUANDO llega `POST /api/auth/login` con un email que no existe en la BDD EL SISTEMA DEBE responder 401 sin consultar Airtable ni crear ningún usuario.
- CUANDO un usuario `professional` llama `POST /api/users/sync-airtable` EL SISTEMA DEBE responder 403.
- CUANDO se importa un registro de Airtable EL SISTEMA DEBE crear la cuenta sin contraseña conocida (ninguna contraseña literal en el código).

*Verify:*
```bash
grep -rn "syncPatientByEmail" backend/controllers/authController.js | wc -l   # espera: 0
grep -rn "'123456'\|\"123456\"" backend/ --include='*.js' | wc -l   # espera: 0
test -f backend/scripts/update_passwords.js && echo EXISTE || echo OK   # espera: OK
```

*Checkpoint:* `git add -A && git commit -m "step 02: fix(seguridad): eliminar creacion automatica de cuentas via airtable" && git tag step-02-airtable`

---

**Paso 03 — Sacar `.env.production` del repo (V7 — resultó ser falso positivo)**

*Do:* `git rm --cached .env.production` (queda en disco, sale del tracking; `.gitignore` ya lo lista). **Antes de pedir cualquier rotación, verificar qué contenía realmente el archivo** extrayendo solo los nombres de variable (nunca los valores) y barrer el historial completo buscando credenciales reales vs. placeholders.

**Resultado de la verificación (2026-08-05):** el archivo solo contenía `VITE_API_URL` — la URL pública de la API, que de todas formas queda incrustada en el bundle del frontend. El barrido del historial (`mongodb://usuario:pass@`, `JWT_SECRET=`, `AIRTABLE_API_KEY=`, `SMTP_PASS=`) no encontró ninguna credencial real: todas las cadenas de conexión del historial son ejemplos con usuario/password ficticios, y `backend/.env` nunca estuvo trackeado. **No hubo filtración → la rotación obligatoria queda cancelada.** Lo único pendiente de Mario es verificar que `JWT_SECRET` en Railway sea largo y aleatorio (un valor corto o adivinable permitiría falsificar sesiones; no es observable desde el repo).

*Done when:*
- CUANDO se lista el índice de git EL SISTEMA DEBE no incluir `.env.production`.
- CUANDO se barre el historial completo buscando patrones de credenciales EL SISTEMA DEBE no arrojar ninguna coincidencia que no sea un placeholder.
- CUANDO el archivo sale del tracking EL SISTEMA DEBE seguir existiendo en disco y su variable DEBE estar documentada en `.env.example` (para que un clon nuevo pueda compilar).

*Verify:*
```bash
git ls-files | grep -c '.env.production'   # espera: 0
test -f .env.production && echo OK          # espera: OK (sigue en disco para los builds)
grep -c VITE_API_URL .env.example            # espera: >= 1 (documentada para un clon nuevo)
curl -s -o /dev/null -w '%{http_code}' https://prime-saas-production.up.railway.app/   # espera: 200
```

*Checkpoint:* `git add -A && git commit -m "step 03: fix(seguridad): untrack .env.production (sin filtracion de credenciales)" && git tag step-03-secrets`

---

**Paso 04 — Middleware de pertenencia + cierre de IDORs (V4)**

*Do:* Reescribir `authorizeOwnerOrAdmin` en `backend/middleware/auth.js` con la semántica de §8.5 (`assertCanAccessPatient`: admin ok; professional ok si `assignedProfessionalId` coincide; patient ok si es él; si no → 404). Montarlo en: `GET /api/users/:id`, `GET /api/users/:id/profile`, `GET /api/plans/active/:patientId`, `GET /api/appointments/plan-info/:patientId`, `GET /api/client-plans/patient/:patientId`, `GET /api/client-plans/balance/:patientId`, y en los GET por paciente de measurements/exercises/eva (reemplazando los chequeos ad-hoc). Además: `GET /api/users` fuerza scoping por rol SIEMPRE (professional → solo `assignedProfessionalId: req.user._id`, patient → 403); disponibilidad: `PUT /:professionalId/schedule` y bloqueos exigen `professionalId === req.user._id` salvo admin; `DELETE /api/appointments/:id` queda solo-admin; sacar `resetPasswordToken`/`resetPasswordExpire`/`invite` de toda respuesta (select explícito o `toJSON` transform en `User`).

*Done when:*
- CUANDO un paciente A pide `GET /api/users/<idB>` o `GET /api/users/<idB>/profile` de otro paciente EL SISTEMA DEBE responder 404.
- CUANDO un profesional pide `GET /api/users` EL SISTEMA DEBE devolver únicamente usuarios con `assignedProfessionalId` igual a su id.
- CUANDO un profesional intenta `PUT /api/availability/<idOtroProfesional>/schedule` EL SISTEMA DEBE responder 403.
- CUANDO cualquier respuesta serializa un usuario EL SISTEMA DEBE omitir `password`, `resetPasswordToken`, `resetPasswordExpire` e `invite`.

*Verify:*
```bash
# con TOKEN de un paciente de prueba y OTRO_ID el id de otro paciente:
curl -s -o /dev/null -w '%{http_code}' $API/users/$OTRO_ID -H "Authorization: Bearer $TOKEN"           # espera: 404
curl -s -o /dev/null -w '%{http_code}' $API/plans/active/$OTRO_ID -H "Authorization: Bearer $TOKEN"    # espera: 404
curl -s $API/auth/me -H "Authorization: Bearer $TOKEN" | grep -c resetPasswordToken                    # espera: 0
```

*Checkpoint:* `git add -A && git commit -m "step 04: fix(seguridad): middleware de pertenencia y cierre de IDORs" && git tag step-04-idor`

---

**Paso 05 — Anti-escalada de roles y política de contraseñas (V5)**

*Do:* En `backend/controllers/userController.js`: `createUser` y `updateUser` pasan a **whitelist explícita de campos**; `role` e `isActive` solo los asigna un admin; un professional crea únicamente `role:'patient'` con `assignedProfessionalId: req.user._id` forzado; un professional no puede editar/desactivar usuarios `admin` ni `professional`; `DELETE /api/users/:id` solo admin y hace soft-delete (`isActive:false`). `PUT /auth/profile`: whitelist de campos propios (nunca `role`, `isActive`, `assignedProfessionalId`, `email` sin verificación). `User.js`: `minlength` de password 6 → 8; `changePassword` y futuros set-password validan ≥8.

*Done when:*
- CUANDO un profesional llama `POST /api/users` con `role:'admin'` EL SISTEMA DEBE crear (o rechazar) sin honrar ese campo — el usuario resultante DEBE tener `role:'patient'`.
- CUANDO un profesional llama `PUT /api/users/:id` con `role` o `isActive` en el body EL SISTEMA DEBE ignorar esos campos.
- CUANDO un usuario define una contraseña de menos de 8 caracteres EL SISTEMA DEBE responder 400.

*Verify:*
```bash
# con TOKEN_PRO de un profesional:
curl -s -X POST $API/users -H "Authorization: Bearer $TOKEN_PRO" -H 'Content-Type: application/json' \
  -d '{"firstName":"T","lastName":"T","email":"t-esc@test.cl","password":"testtest1","role":"admin"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.role'   # espera: patient
curl -s -o /dev/null -w '%{http_code}' -X PUT $API/auth/change-password -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"currentPassword":"x","newPassword":"corta"}'   # espera: 400
```

*Checkpoint:* `git add -A && git commit -m "step 05: fix(seguridad): whitelist de campos, roles solo-admin, password >= 8" && git tag step-05-roles`

---

**Paso 06 — Hardening del servidor: helmet, rate limiting, sanitización, validación**

*Do:* Instalar `helmet`, `express-rate-limit`, `express-mongo-sanitize` (deps justificadas en §11). En `backend/server.js`: `app.set('trust proxy', 1)`; `helmet()`; `express.json({ limit: '1mb' })`; `express-mongo-sanitize` (bloquea `$`/`.` en input → mata `?status[$ne]=`); montar `backend/middleware/rateLimiter.js` con la tabla §5.3 (login/forgot-password con clave IP+email). Activar `express-validator` (ya instalado, nunca usado): `backend/middleware/validate.js` + validators para los endpoints de auth y de creación (email normalizado, escape de strings, ObjectId válidos, enums). Escapar TODO input de usuario interpolado en los HTML de `utils/emailService.js` (fix XSS almacenado). Escapar el input compilado a RegExp en búsquedas (`userController.js`, `exerciseController.js`, `Exercise.js`) con un helper `escapeRegex`.

*Done when:*
- CUANDO llegan 6 intentos de `POST /auth/login` fallidos en 15 min desde la misma IP+email EL SISTEMA DEBE responder 429 con code `RATE_LIMITED` al sexto.
- CUANDO llega un query param con operador (`?status[$ne]=x`) EL SISTEMA DEBE tratarlo como string inofensivo (cero matches de operador en Mongo).
- CUANDO se sirve cualquier respuesta EL SISTEMA DEBE incluir los headers de helmet (`x-content-type-options: nosniff` presente).
- CUANDO un body supera 1 MB EL SISTEMA DEBE responder 413.

*Verify:*
```bash
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code} ' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"rl@test.cl","password":"mala"}'; done   # espera: ... 429 al final
curl -sI $API/../ | grep -ci 'x-content-type-options'   # espera: 1
grep -rn "escapeRegex" backend/controllers | wc -l      # espera: >= 2
```

*Checkpoint:* `git add -A && git commit -m "step 06: fix(seguridad): helmet, rate limiting, sanitizacion nosql, validacion y escape" && git tag step-06-hardening`

---

**Paso 07 — Cuarentena de Google Calendar, limpieza de scripts y bugs 500 (V9, V11)**

*Do:* (a) `backend/routes/googleCalendarRoutes.js`: middleware al inicio que responde `403 { code: 'FEATURE_DISABLED' }` salvo que `GOOGLE_CALENDAR_ENABLED === 'true'` (por defecto ausente) — la integración está rota (guarda tokens en un campo que el schema descarta) e insegura (cliente OAuth compartido entre requests, sin `state`); se rediseña en el paso 28. Quitar del frontend el botón/flujo que la invoque si existe. (b) ~~`backend/utils/seed.js`~~ — **ya resuelto en el Paso 02**: su Verify exigía cero contraseñas literales en todo `backend/`, lo que obligaba a limpiar el seed también (lee `SEED_ADMIN_PASSWORD` / `SEED_PROFESSIONAL_PASSWORD` / `SEED_PATIENT_PASSWORD` de env, o genera aleatorias que imprime UNA vez). (c) Arreglar los 2 endpoints muertos: importar `mongoose` en `backend/controllers/measurementController.js` y `new mongoose.Types.ObjectId(...)` en `backend/models/EVA.js:163`. (d) ~~`notFound` en `middleware/error.js`~~ — **ya resuelto en el Paso 01**: su criterio de aceptación (endpoints eliminados → 404) dependía de este arreglo, así que se adelantó. (e) Montar la suite de tests base: `vitest` + `supertest` (dev deps §11) con los primeros tests de regresión de A1–A6 en `backend/tests/security.test.js`.

*Done when:*
- CUANDO llega cualquier request a `/api/google-calendar/*` sin el flag activo EL SISTEMA DEBE responder 403 `FEATURE_DISABLED`.
- CUANDO se pide `GET /api/measurements/patient/:id` (con own válido) EL SISTEMA DEBE responder 200, no 500.
- CUANDO se pide una ruta inexistente `/api/nada` EL SISTEMA DEBE responder 404.
- CUANDO se ejecuta `npm test` en `/backend` EL SISTEMA DEBE pasar la suite de seguridad completa.

*Verify:*
```bash
curl -s -o /dev/null -w '%{http_code}' -X POST $API/google-calendar/auth-url -H "Authorization: Bearer $TOKEN"   # espera: 403
curl -s -o /dev/null -w '%{http_code}' $API/nada   # espera: 404
cd backend && npm test   # espera: exit 0, todos los tests en verde
```

*Checkpoint:* `git add -A && git commit -m "step 07: fix(seguridad): cuarentena gcal, seed sin passwords, bugs 500, tests base" && git tag step-07-quarantine`

> 🚦 **Fin de FASE A. Deploy + smoke test en producción (§20.1) antes de seguir.**

### FASE B — AUTENTICACIÓN DEFINITIVA

---

**Paso 08 — Refresh tokens: modelo y endpoints**

*Do:* Crear `backend/models/RefreshToken.js` (§4.3). En `authController`: `login` emite access (1 h — `JWT_EXPIRE=1h`, payload `{id, role}`) + refresh opaco en cookie (`HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=30d`); `POST /auth/refresh` valida hash, rota (nuevo token, marca `replacedByHash`), detecta reuso → revoca familia; `POST /auth/logout` revoca y limpia cookie. `cookie-parser` (dep §11). En dev (`NODE_ENV !== 'production'`) la cookie va sin `Secure`.

*Done when:*
- CUANDO un login es exitoso EL SISTEMA DEBE responder con access token en el body y setear la cookie de refresh con `HttpOnly` y `SameSite=Lax`.
- CUANDO llega `POST /auth/refresh` con cookie válida EL SISTEMA DEBE responder un access nuevo y rotar el refresh (el anterior queda inutilizable).
- CUANDO llega un refresh ya rotado EL SISTEMA DEBE responder 401 y revocar todos los tokens de esa familia.
- CUANDO llega `POST /auth/logout` EL SISTEMA DEBE marcar `revokedAt` y el refresh posterior DEBE fallar con 401.

*Verify:*
```bash
curl -si -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"<test>","password":"<pass>"}' | grep -i 'set-cookie' | grep -ci 'httponly'   # espera: 1
# guardar cookie y refrescar dos veces con la MISMA cookie vieja:
curl -s -c /tmp/cj -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"<test>","password":"<pass>"}' > /dev/null
curl -s -b /tmp/cj -o /dev/null -w '%{http_code}\n' -X POST $API/auth/refresh   # espera: 200
curl -s -b /tmp/cj -o /dev/null -w '%{http_code}\n' -X POST $API/auth/refresh   # espera: 401 (reuso detectado)
```

*Checkpoint:* `git add -A && git commit -m "step 08: feat(auth): refresh tokens rotativos y revocables" && git tag step-08-refresh`

---

**Paso 09 — Dominio `api.primefh.cl` + CORS definitivo**

*Do:* Guiar a Mario: Railway → servicio backend → Settings → Domains → agregar `api.primefh.cl`; Hostinger → DNS de primefh.cl → CNAME `api` → el target que Railway indique; esperar TLS. Código: CORS allowlist exacta `[https://app.primefh.cl, http://localhost:5173]` con `credentials: true`; check de `Origin` en `/auth/refresh` (defensa extra CSRF). Mario actualiza `VITE_API_URL=https://api.primefh.cl/api` en el build de producción y `FRONTEND_URL=https://app.primefh.cl` en Railway.

*Done when:*
- CUANDO se consulta `https://api.primefh.cl/api/health` (o `/`) EL SISTEMA DEBE responder 200 con TLS válido.
- CUANDO una request llega con `Origin: https://malicioso.cl` EL SISTEMA DEBE responder sin header `Access-Control-Allow-Origin`.
- CUANDO el frontend de producción hace login EL SISTEMA DEBE setear la cookie y el refresh posterior DEBE funcionar en Safari de iPhone (prueba manual de Mario).

*Verify:*
```bash
curl -s -o /dev/null -w '%{http_code}' https://api.primefh.cl/   # espera: 200
curl -s -H 'Origin: https://malicioso.cl' -D- -o /dev/null https://api.primefh.cl/ | grep -ci 'access-control-allow-origin'   # espera: 0
```

*Checkpoint:* `git add -A && git commit -m "step 09: feat(infra): dominio api.primefh.cl y cors restringido" && git tag step-09-domain`

---

**Paso 10 — Frontend: token en memoria y fin del PHI en localStorage (V10)**

*Do:* `src/lib/api.ts`: access token en variable de módulo (`setAccessToken()`); interceptor request lo adjunta; interceptor response ante 401 intenta **un** `POST /auth/refresh` (con `withCredentials: true`) y reintenta la request original; si falla → logout. `AuthContext`: al montar, `refresh → me` (silent login); eliminar TODA lectura/escritura de `localStorage` para `token` y `user` (incluye `authService.ts` y `loginWithToken`). El redirect post-login se decide por `user.role` de la respuesta, no por la pestaña usada.

*Done when:*
- CUANDO un usuario inicia sesión y recarga la página EL SISTEMA DEBE restaurar la sesión sin que exista ninguna clave `token` ni `user` en localStorage.
- CUANDO el access token vence en medio de la navegación EL SISTEMA DEBE renovar y completar la request original sin que el usuario vea un error.
- CUANDO el refresh falla EL SISTEMA DEBE redirigir a `/login` con el estado limpio.

*Verify:*
```bash
grep -rn "localStorage" src/services/authService.ts src/contexts/AuthContext.tsx src/lib/api.ts | wc -l   # espera: 0
npm run build   # espera: exit 0
# manual: login → DevTools → Application → Local Storage debe estar vacío de token/user → recargar → sigue logueado
```

*Checkpoint:* `git add -A && git commit -m "step 10: feat(auth): access token en memoria, sin PHI en localStorage" && git tag step-10-frontend-auth`

---

**Paso 11 — Resend: servicio de email con dominio verificado**

*Do:* Guiar a Mario: crear cuenta Resend → agregar dominio `primefh.cl` → copiar los registros DNS (SPF/DKIM) a Hostinger → verificar → crear API key → `RESEND_API_KEY` en Railway. Código: dep `resend` (§11); `backend/services/emailService.js` nuevo con: plantilla base con marca Prime (teal `#3D9AA6`), remitente `Prime F&H <no-responder@primefh.cl>`, funciones `sendInviteEmail`, `sendPasswordResetEmail`, `sendNotificationEmail`, todas con input escapado (helper del paso 06) y fire-and-forget con log de error (sin PHI en logs). Los emails de citas existentes migran a este servicio; `utils/emailService.js` (nodemailer) queda obsoleto y se elimina.

*Done when:*
- CUANDO se ejecuta el script de prueba `node backend/scripts/testEmail.js <email>` EL SISTEMA DEBE entregar un email desde `@primefh.cl` que llega a inbox (no spam) en Gmail.
- CUANDO falta `RESEND_API_KEY` EL SISTEMA DEBE arrancar igual y loguear el error al intentar enviar (nunca crashear por email).
- CUANDO un valor de usuario contiene `<script>` EL SISTEMA DEBE renderizarlo escapado en el HTML del email.

*Verify:*
```bash
node backend/scripts/testEmail.js mariomartinezplm@gmail.com   # espera: "Enviado" + email en inbox
grep -rn "nodemailer" backend/ --include='*.js' | wc -l        # espera: 0
```

*Checkpoint:* `git add -A && git commit -m "step 11: feat(email): resend con dominio primefh.cl verificado" && git tag step-11-resend`

---

**Paso 12 — Onboarding por invitación (backend)**

*Do:* `User.invite` (§4.2) + `backend/services/inviteService.js`: `createInvite(userId)` (token 32 bytes → hash sha256 → `expiresAt +7d` → email Resend con `https://app.primefh.cl/invitacion/<token>`). `POST /api/users` (staff) crea al paciente **sin contraseña utilizable** y dispara la invitación. `POST /auth/accept-invite/:token`: valida hash+expiración+no usado → setea contraseña (≥8) → marca `usedAt` → responde tokens de sesión (login automático). `POST /users/:id/resend-invite` (admin o professional dueño): regenera e invalida el anterior. Las cuentas importadas de Airtable (paso 02) se activan por este mismo camino.

*Done when:*
- CUANDO un profesional crea un paciente EL SISTEMA DEBE enviar el email de invitación y el paciente NO DEBE poder loguearse antes de aceptarla.
- CUANDO llega `POST /auth/accept-invite/:token` válido con contraseña ≥8 EL SISTEMA DEBE activar la cuenta, marcar el token usado y responder sesión iniciada.
- CUANDO el mismo token se usa por segunda vez EL SISTEMA DEBE responder 400 `INVITE_EXPIRED`.
- CUANDO el token tiene más de 7 días EL SISTEMA DEBE responder 400 `INVITE_EXPIRED` y permitir reenvío.

*Verify:*
```bash
cd backend && npm test -- invite   # espera: suite de invitación en verde (crear→aceptar→reuso falla)
grep -rn "tokenHash" backend/models/User.js | wc -l   # espera: >= 1
```

*Checkpoint:* `git add -A && git commit -m "step 12: feat(onboarding): invitacion por email con token de un solo uso" && git tag step-12-invite`

---

**Paso 13 — Onboarding y reset por email (frontend)**

*Do:* `src/pages/AcceptInvite.tsx` (ruta pública `/invitacion/:token`): elegir contraseña (≥8, confirmación) → login automático → dashboard del paciente. `src/pages/ResetPassword.tsx` (ruta `/restablecer/:token`). Reescribir `RecoverPassword.tsx`: solo pide email → mensaje genérico "si el email existe, te llegarán instrucciones" (el backend del paso 01 + email del paso 11 ya lo soportan: conectar `forgotPassword` → `sendPasswordResetEmail`). Botón "Reenviar invitación" en la ficha del paciente (staff). Eliminar de `LoginDual.tsx` el texto que promociona el flujo viejo.

*Done when:*
- CUANDO un paciente abre `/invitacion/<token-válido>` y define su contraseña EL SISTEMA DEBE dejarlo dentro de su dashboard sin pasos adicionales.
- CUANDO un usuario pide reset EL SISTEMA DEBE mostrarle el mismo mensaje exista o no el email, y el link recibido DEBE permitir definir contraseña nueva.
- CUANDO el token es inválido o venció EL SISTEMA DEBE mostrar pantalla de error con botón de WhatsApp.

*Verify:*
```bash
npm run build   # espera: exit 0
grep -rn "verify-identity\|set-password" src/ | wc -l   # espera: 0 (flujo viejo extinto)
# manual: flujo completo con un paciente de prueba y email real
```

*Checkpoint:* `git add -A && git commit -m "step 13: feat(onboarding): pantallas de invitacion y reset por email" && git tag step-13-invite-ui`

---

**Paso 14 — Limpieza de rutas y guards por rol (frontend)**

*Do:* Eliminar `src/pages/StaffDashboard.tsx`, `src/components/staff/*` (mocks con datos ficticios), `src/pages/Login.tsx` (muerto) y la ruta `/staff-dashboard`. Envolver las rutas de paciente en `RoleRoute roles={['patient']}` (`/app/dashboard`, `/app/reservar`, `/app/mis-citas`, `/app/mi-perfil`, `/app/mediciones`, `/app/ejercicios`, `/app/dolor`); `/app/configuracion` queda compartida. Con los mocks fuera, remover `chart.js`/`react-chartjs-2` del `package.json` y `googleapis`/`google-auth-library` del `package.json` **frontend** (error del commit `f08d089` — pertenecen solo al backend).

*Done when:*
- CUANDO un visitante sin sesión abre `/staff-dashboard` EL SISTEMA DEBE responder la página 404 de la SPA.
- CUANDO un usuario `professional` navega a `/app/reservar` EL SISTEMA DEBE redirigirlo a `/app/dashboard`→`/app/admin` (cadena de guards).
- CUANDO se compila el frontend EL SISTEMA DEBE hacerlo sin chart.js ni googleapis en `package.json`.

*Verify:*
```bash
grep -rn "staff-dashboard\|StaffDashboard" src/ | wc -l   # espera: 0
grep -c 'chart.js\|googleapis' package.json               # espera: 0
npm run build                                             # espera: exit 0
```

*Checkpoint:* `git add -A && git commit -m "step 14: fix(frontend): guards por rol y eliminacion de mocks y dead code" && git tag step-14-guards`

### FASE C — PLANES Y AGENDA CONSOLIDADOS

---

**Paso 15 — Motor de descuento de sesiones (V8)**

*Do:* Implementar en `backend/services/clientPlanService.js`: `deductSession(patientId, serviceType, appointmentId)` (atómico: `findOneAndUpdate` con `sessionsUsed < sessionsTotal`; fallback a `ExtraSession` no usada → `used:true, usedAt, usedInAppointment`; retorna `{source, refId}` que se guarda en `Appointment.deduction`) y `refundSession(appointment)` (según `deduction.source`; `$inc:-1` condicionado a `>0`). Cablear: crear cita → deduct; cancelar ≥4h o cancelación por admin → refund; cancelar <4h / completed / no-show → sin refund. Marcar completed/no-show NO vuelve a descontar (ya se descontó al agendar — `sessionDeducted` lo garantiza). Eliminar los `$inc` del modelo legacy `Plan` en `appointmentController` y el "plan permisivo fabricado" (líneas ~168–174).

*Done when:*
- CUANDO un paciente agenda una cita EL SISTEMA DEBE incrementar `sessionsUsed` (o marcar una extra como usada) exactamente en 1 y registrar `deduction` en la cita.
- CUANDO dos requests simultáneas compiten por la última sesión EL SISTEMA DEBE aceptar solo una (la otra recibe 409).
- CUANDO el paciente cancela con 4+ horas EL SISTEMA DEBE devolver la sesión a su origen (plan o extra) y liberar el cupo.
- CUANDO la cita termina en completed, no-show o cancelación tardía EL SISTEMA DEBE mantener la sesión descontada.
- CUANDO el saldo es 0 EL SISTEMA DEBE rechazar el agendamiento con `NO_ACTIVE_PLAN_SESSIONS`.

*Verify:*
```bash
cd backend && npm test -- sessions   # espera: suite verde incl. test de concurrencia (Promise.all de 2 reservas con saldo 1 → un 201 y un 409)
grep -rn '\$inc.*sessionsUsed' backend/controllers/appointmentController.js | wc -l   # espera: 0 (la lógica vive en el servicio)
```

*Checkpoint:* `git add -A && git commit -m "step 15: feat(planes): motor atomico de descuento y devolucion de sesiones" && git tag step-15-deduction`

---

**Paso 16 — Migrar y retirar el modelo `Plan` legacy**

*Do:* Script `backend/scripts/migrateLegacyPlans.js` con `--dry-run` (patrón existente): cada `Plan` activo → `ClientPlan` equivalente (mapeo documentado en el script: kinesiologia→kinesiologia/10, entrenamiento-2x→entrenamiento/8, entrenamiento-3x→entrenamiento/12; `startDate` se conserva, `endDate = startDate+30d`, `sessionsUsed` se traslada con tope). Mario ejecuta dry-run → revisa → real. Luego: `appointmentController` y todo el backend consultan SOLO `clientPlanService` (fuera `MONTHLY_LIMITS` y la lógica de tipos legacy); eliminar `models/Plan.js`, `planController.js`, `planRoutes.js` y el mount `/api/plans`; frontend: `BookAppointment.tsx` y `PatientDetail.tsx` migran de `planService.ts` a `clientPlanService.ts`; eliminar `services/planService.ts`.

*Done when:*
- CUANDO se ejecuta el dry-run EL SISTEMA DEBE reportar el mapeo completo sin escribir nada.
- CUANDO termina la migración real EL SISTEMA DEBE tener 0 planes activos solo-legacy (todo paciente con plan vigente tiene su `ClientPlan`).
- CUANDO llega cualquier request a `/api/plans/*` EL SISTEMA DEBE responder 404.
- CUANDO un paciente sin `ClientPlan` activo intenta agendar EL SISTEMA DEBE rechazar (el plan permisivo fabricado ya no existe).

*Verify:*
```bash
node backend/scripts/migrateLegacyPlans.js --dry-run   # espera: reporte sin errores
grep -rn "models/Plan'" backend/ | wc -l               # espera: 0
curl -s -o /dev/null -w '%{http_code}' $API/plans -H "Authorization: Bearer $TOKEN"   # espera: 404
```

*Checkpoint:* `git add -A && git commit -m "step 16: feat(planes): clientplan como unica fuente, retiro del modelo legacy" && git tag step-16-migration`

---

**Paso 17 — Reglas de agenda al 100%: ventana 4h, cron de expiración, recurrente completa**

*Do:* (a) `PATIENT_BOOK_AHEAD_HOURS` 24 → **4** en `appointmentController.js`, calculado server-side en zona `America/Santiago` (Intl con timeZone; sin dependencia nueva). (b) Expiración diaria: Mario crea en Railway un **cron job** (Settings → Cron) que ejecuta `npm run expire-plans` a las 03:00 America/Santiago (el script `backend/scripts/expirePlans.js` ya existe). (c) `POST /appointments/bulk`: aplicar TODAS las reglas por slot (saldo, 4h, cupos, serviceType — hoy salta varias), cap de 20 elementos, respuesta con resumen `{ created: [...], skipped: [{fecha, motivo}] }`. (d) El endpoint de slots devuelve cupos restantes por slot (verificar — la UI ya lo espera).

*Done when:*
- CUANDO un paciente intenta agendar un slot que empieza en menos de 4 horas (hora de Santiago) EL SISTEMA DEBE responder 400 `BOOKING_WINDOW`.
- CUANDO un paciente intenta agendar un slot a 5+ horas EL SISTEMA DEBE aceptarlo (si hay saldo y cupo).
- CUANDO llega un bulk con 21 elementos EL SISTEMA DEBE responder 400.
- CUANDO el cron corre EL SISTEMA DEBE marcar `expired` todo `ClientPlan` con `endDate` pasada (verificable en la lista admin al día siguiente).

*Verify:*
```bash
cd backend && npm test -- booking   # espera: verde (ventana 4h con reloj mockeado, bulk cap, bulk salta slot lleno e informa)
grep -n "PATIENT_BOOK_AHEAD_HOURS" backend/controllers/appointmentController.js   # espera: = 4
```

*Checkpoint:* `git add -A && git commit -m "step 17: feat(agenda): ventana 4h, cron de expiracion, recurrente con todas las reglas" && git tag step-17-booking-rules`

---

**Paso 18 — Fin de los precios en la app y consolidación de UI de planes (V12)**

*Do:* Eliminar `src/pages/patient/Subscription.tsx` y su ruta `/app/planes` (y su entrada en el sidebar); el estado del plan ya vive en el dashboard del paciente (barra de sesiones + WhatsApp si venció — existe ✅). Unificar el número de WhatsApp: todo usa `src/config/contact.ts` (hoy está duplicado en ~10 componentes + un placeholder falso en `RecoverPassword`). Alerta de vencimiento en panel staff/admin: fila amarilla ≤5 días, roja vencido (parcialmente existe — completar).

*Done when:*
- CUANDO se busca un precio en el código del frontend EL SISTEMA DEBE no contener ninguno (`$200.000` etc. → 0 matches).
- CUANDO un paciente navega a `/app/planes` EL SISTEMA DEBE responder la página 404 de la SPA.
- CUANDO cualquier componente abre WhatsApp EL SISTEMA DEBE usar el número de `config/contact.ts`.

*Verify:*
```bash
grep -rn "200.000\|89.990\|129.990" src/ | wc -l   # espera: 0
grep -rln "56956286651" src/ --include='*.tsx' | grep -v config/contact | wc -l   # espera: 0
npm run build   # espera: exit 0
```

*Checkpoint:* `git add -A && git commit -m "step 18: fix(negocio): sin precios en la app, whatsapp centralizado" && git tag step-18-no-prices`

### FASE D — FEATURES FALTANTES

---

**Paso 19 — Notificaciones (backend)**

*Do:* `models/Notification.js` (§4.3) + `services/notificationService.js`: `notify(userId, type, data)` crea el doc y, para tipos importantes (`plan_expiring`, `plan_expired`, `wellness_alert`, `evolution_updated`), espeja por email (Resend). Cablear eventos: paciente crea/edita medición/ejercicio/EVA → notifica al `assignedProfessionalId`; cita agendada/cancelada → notifica al profesional; `expirePlans.js` → `plan_expiring` (5 días antes) y `plan_expired` (paciente + admin). Endpoints §5.2. 

*Done when:*
- CUANDO un paciente registra una medición EL SISTEMA DEBE crear una notificación para su profesional asignado con link a la ficha.
- CUANDO el cron detecta un plan a ≤5 días de vencer EL SISTEMA DEBE notificar (una sola vez por plan) al paciente y al admin.
- CUANDO se llama `GET /api/notifications/unread-count` EL SISTEMA DEBE responder el conteo solo del usuario autenticado.

*Verify:*
```bash
cd backend && npm test -- notifications   # espera: verde (evento evolución → notificación al profesional correcto y a nadie más)
```

*Checkpoint:* `git add -A && git commit -m "step 19: feat(notificaciones): modelo, servicio notify y eventos cableados" && git tag step-19-notifications`

---

**Paso 20 — Campanita (frontend)**

*Do:* Componente `NotificationBell` en el header de `AppLayout` (las 3 vistas): badge rojo con no-leídas, panel desplegable (título, tiempo relativo, ir al link, marcar todas leídas), polling cada 60 s + refetch al navegar. Mobile-first: en celular el panel ocupa el ancho completo.

*Done when:*
- CUANDO existen notificaciones no leídas EL SISTEMA DEBE mostrar el badge con el número dentro de 60 s.
- CUANDO el usuario toca "marcar todas como leídas" EL SISTEMA DEBE dejar el badge en cero sin recargar la página.

*Verify:*
```bash
npm run build   # espera: exit 0
# manual: crear medición como paciente en una pestaña → badge del profesional sube en la otra dentro de 60s
```

*Checkpoint:* `git add -A && git commit -m "step 20: feat(notificaciones): campanita con badge y panel" && git tag step-20-bell`

---

**Paso 21 — Archivos médicos en R2 (backend)**

*Do:* Guiar a Mario: cuenta Cloudflare → R2 → bucket privado `primefh-archivos` → API token (Object Read & Write) → 4 variables en Railway (§10). Deps: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer` (§11). `services/storageService.js`: upload (multer en memoria → `PutObject` con key `patients/<patientId>/<uuid>.<ext>`), `getSignedDownloadUrl(key, 300s)`, delete. `models/ClientFile.js` + rutas §5.2: límite 10 MB, mimetypes pdf/jpg/png verificados por **magic bytes** (no solo extensión), pertenencia con `assertCanAccessPatient`, paciente sube solo con plan activo.

*Done when:*
- CUANDO un usuario autorizado sube un PDF ≤10 MB EL SISTEMA DEBE guardarlo en R2 y crear el `ClientFile` con su `storageKey` (nunca URL pública).
- CUANDO se pide la descarga EL SISTEMA DEBE responder una URL firmada que expira en 5 minutos.
- CUANDO un paciente pide un archivo de otro paciente EL SISTEMA DEBE responder 404.
- CUANDO se sube un `.exe` renombrado a `.pdf` EL SISTEMA DEBE rechazarlo con 400.

*Verify:*
```bash
cd backend && npm test -- files   # espera: verde (upload ok, mimetype falso rechazado, IDOR 404, URL firmada expira)
```

*Checkpoint:* `git add -A && git commit -m "step 21: feat(archivos): almacenamiento privado en r2 con urls firmadas" && git tag step-21-files-api`

---

**Paso 22 — Archivos médicos (UI)**

*Do:* Pestaña/sección "Archivos" en la ficha del paciente (vista staff `PatientDetail.tsx`) y en el perfil del paciente: subir con nombre + descripción (drag & drop simple), listar con ícono por tipo, ver/descargar (abre URL firmada), eliminar (solo quien subió, o admin — el backend manda). Estados de carga y error visibles. Mobile-first.

*Done when:*
- CUANDO un paciente con plan activo sube un examen desde el celular EL SISTEMA DEBE mostrarlo en su lista y en la ficha que ve su profesional.
- CUANDO un paciente con plan vencido entra a Archivos EL SISTEMA DEBE permitir ver/descargar pero mostrar el botón de subir deshabilitado con el mensaje de renovación.

*Verify:*
```bash
npm run build   # espera: exit 0
# manual: flujo subir→ver→descargar→eliminar en celular y escritorio
```

*Checkpoint:* `git add -A && git commit -m "step 22: feat(archivos): ui de subida y descarga en ficha y perfil" && git tag step-22-files-ui`

---

**Paso 23 — Wellness check-in (modelo + paciente)**

*Do:* `models/WellnessCheckin.js` (§4.3, índice único paciente+día) + rutas §5.2. UI paciente: card "¿Cómo te sientes hoy?" destacada en el dashboard → formulario de 5 sliders 1-5 + notas, respondible en <30 s; si ya respondió hoy, muestra sus respuestas. Si el promedio < 2.5 → `notify(profesional, 'wellness_alert')` (servicio del paso 19).

*Done when:*
- CUANDO un paciente envía su segundo check-in del mismo día EL SISTEMA DEBE responder 409 (índice único, no solo validación de UI).
- CUANDO el promedio de las 5 métricas es < 2.5 EL SISTEMA DEBE crear la alerta al profesional asignado.
- CUANDO un paciente con plan vencido intenta el check-in EL SISTEMA DEBE responder 403 con el mensaje de renovación.

*Verify:*
```bash
cd backend && npm test -- wellness   # espera: verde (unicidad por día, alerta <2.5, gate de plan)
```

*Checkpoint:* `git add -A && git commit -m "step 23: feat(wellness): check-in diario con alerta al profesional" && git tag step-23-wellness`

---

**Paso 24 — Wellness: tendencias para staff/admin**

*Do:* Dashboard del profesional: por paciente asignado, gráfico de tendencia semanal (Recharts) de las 5 métricas + último check-in + indicador rojo si algún promedio semanal < 2.5. Admin: lo mismo global con tabla resumen. Pestaña Wellness en la ficha del paciente con historial.

*Done when:*
- CUANDO un profesional abre su dashboard EL SISTEMA DEBE mostrar la tendencia solo de SUS pacientes asignados.
- CUANDO un paciente tiene promedio semanal < 2.5 EL SISTEMA DEBE marcarlo con indicador rojo en la lista.

*Verify:*
```bash
npm run build   # espera: exit 0
# manual con datos seed de una semana
```

*Checkpoint:* `git add -A && git commit -m "step 24: feat(wellness): dashboards de tendencias" && git tag step-24-wellness-dash`

---

**Paso 25 — Historial clínico completo + export CSV**

*Do:* `User.medicalInfo` + `heightCm`, `baseWeightKg`, `smoker` (§4.2) + UI en ficha (staff) y perfil (paciente, editable según matriz §8.4; la edad se calcula desde `dateOfBirth`, no se guarda). Export CSV para admin: pacientes (datos base + plan + sesiones) y citas del mes — generado en backend (`GET /api/users/export?format=csv`, solo admin, sin `medicalInfo` en el export por defecto).

*Done when:*
- CUANDO el profesional edita altura/peso base/fuma EL SISTEMA DEBE persistirlos y mostrarlos en la ficha.
- CUANDO el admin descarga el CSV EL SISTEMA DEBE entregar un archivo válido sin campos de historial clínico sensible.
- CUANDO un no-admin llama el export EL SISTEMA DEBE responder 403.

*Verify:*
```bash
curl -s -o /dev/null -w '%{http_code}' "$API/users/export?format=csv" -H "Authorization: Bearer $TOKEN"   # espera: 403 (token de paciente)
```

*Checkpoint:* `git add -A && git commit -m "step 25: feat(perfil): historial clinico completo y export csv admin" && git tag step-25-clinical`

---

**Paso 26 — PWA pulida y headers del frontend**

*Do:* (a) Generar íconos reales desde el logo (`src/assets`): `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (180). (b) `vite.config.ts`: `theme_color: '#3D9AA6'`, `lang: 'es'`, eliminar la regla `runtimeCaching` de Supabase (dead config) y **no** cachear `api.primefh.cl` (PHI nunca en caché del SW). (c) `<meta name="theme-color" content="#3D9AA6">` en `index.html`; quitar el `<link>` duplicado de Google Fonts (Inter ya es self-hosted). (d) `dev-dist/` a `.gitignore` + `git rm -r --cached dev-dist`. (e) `dist/.htaccess` (plantilla en `public/.htaccess`): HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y CSP básica (`default-src 'self'; connect-src 'self' https://api.primefh.cl; img-src 'self' data:; style-src 'self' 'unsafe-inline'`). (f) Página `/instalar` con instrucciones iOS/Android + banner `beforeinstallprompt`.

*Done when:*
- CUANDO se piden las URLs de los íconos del manifest EL SISTEMA DEBE responder 200 para las 4 (hoy: 404).
- CUANDO se inspecciona el SW generado EL SISTEMA DEBE no contener ninguna regla de cacheo para `api.primefh.cl` ni `supabase`.
- CUANDO se consulta `https://app.primefh.cl` EL SISTEMA DEBE responder los security headers del `.htaccess`.

*Verify:*
```bash
ls public/icons/ | wc -l   # espera: >= 4
npm run build && grep -c 'supabase' dist/sw.js   # espera: 0
git ls-files | grep -c 'dev-dist'   # espera: 0
curl -sI https://app.primefh.cl | grep -ci 'strict-transport-security'   # espera: 1 (tras subir a Hostinger)
```

*Checkpoint:* `git add -A && git commit -m "step 26: feat(pwa): iconos reales, theme de marca, headers y limpieza de sw" && git tag step-26-pwa`

---

**Paso 27 — Salud, monitoreo y respaldos**

*Do:* (a) `GET /api/health`: verifica conexión Mongo (`mongoose.connection.readyState === 1`) → `{ status: 'ok', db: 'connected' }` o 503; sin datos sensibles. (b) Mario crea monitor gratuito en UptimeRobot → `https://api.primefh.cl/api/health` cada 5 min con alerta a su email. (c) **Respaldos (OBLIGATORIO antes del primer paciente real):** decisión de Mario entre — **Opción 1 (recomendada):** subir Atlas a M2 (~US$9/mes) con backups automáticos de Atlas; **Opción 2 (gratis):** script `backend/scripts/backupToR2.js` (export JSON de todas las colecciones → R2 `backups/YYYY-MM-DD.json.gz`) en un cron diario de Railway + prueba de restauración documentada. Implementar la opción elegida y PROBAR una restauración.

*Done when:*
- CUANDO la BDD está conectada EL SISTEMA DEBE responder 200 en `/api/health`; caída → 503 (y UptimeRobot alerta).
- CUANDO corre el respaldo diario EL SISTEMA DEBE producir un artefacto restaurable con fecha (verificado restaurando en una BDD de prueba).

*Verify:*
```bash
curl -s https://api.primefh.cl/api/health   # espera: {"status":"ok","db":"connected"}
# opción 2: node backend/scripts/backupToR2.js && node backend/scripts/restoreFromR2.js --target=test --latest   # espera: colecciones restauradas con conteos idénticos
```

*Checkpoint:* `git add -A && git commit -m "step 27: feat(infra): health check, uptime y respaldos verificados" && git tag step-27-backups`

---

**Paso 28 (OPCIONAL) — Google Calendar bien hecho**

*Do:* Solo si Mario lo pide: `googleTokens` como campo real del schema `User` (cifrado AES-256-GCM con `ENCRYPTION_KEY` de env, `select:false`), `googleEventId` en `Appointment`, cliente OAuth **por request** (no singleton), `state` firmado anti-CSRF en el flujo OAuth, scope mínimo `calendar.events`, sync con ownership (solo citas propias) y campos correctos (`type/startTime/endTime`). Retirar el flag de cuarentena del paso 07.

*Done when:*
- CUANDO un profesional conecta su Google Calendar EL SISTEMA DEBE persistir los tokens cifrados y nunca exponerlos en ninguna respuesta de la API.
- CUANDO se sincroniza una cita EL SISTEMA DEBE crear el evento con fecha/hora correctas y solo para citas del propio usuario.

*Verify:*
```bash
cd backend && npm test -- gcal   # espera: verde (tokens no aparecen en GET /users/:id, state validado)
```

*Checkpoint:* `git add -A && git commit -m "step 28: feat(gcal): integracion segura con tokens cifrados y scope minimo" && git tag step-28-gcal`

---

## 10 · Setup de entorno

**Regla inquebrantable:** Claude Code jamás lee/crea/edita archivos `.env`. Mario configura las variables (local y Railway) con la guía de cada paso.

### 10.1 Cuentas de terceros a crear (Mario)

| Servicio | Para qué | Paso | Costo |
|---|---|---|---|
| Resend | Emails (invitación, reset, notificaciones) + verificación DNS de primefh.cl | 11 | $0 (3.000/mes) |
| Cloudflare R2 | Archivos médicos + destino de respaldos | 21, 27 | $0 (10 GB) |
| UptimeRobot | Monitoreo de caídas | 27 | $0 |

### 10.2 Variables de entorno

| Variable | Dónde | Estado | Requerida desde paso |
|---|---|---|---|
| `MONGODB_URI` · `JWT_SECRET` · `PORT` · `NODE_ENV` · `FRONTEND_URL` | Railway | existen (**rotar en paso 03**) | — |
| `JWT_EXPIRE` | Railway | existe → cambiar a `1h` | 08 |
| `RESEND_API_KEY` | Railway | nueva | 11 |
| `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET` | Railway | nuevas | 21 |
| `GOOGLE_CALENDAR_ENABLED` | Railway | nueva (ausente = off) | 07 |
| `SEED_ADMIN_PASSWORD` | solo local | nueva (opcional) | 07 |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | Railway | existen — solo si paso 28 | 28 |
| `ENCRYPTION_KEY` | Railway | nueva — solo si paso 28 | 28 |
| `SMTP_*` (5 vars) | Railway | **eliminar tras paso 11** | — |
| `AIRTABLE_*` (3 vars) | Railway | **rotar en 03, eliminar al cerrar Fase B** | — |
| `VITE_API_URL` | build frontend | existe → `https://api.primefh.cl/api` | 09 |

---

## 11 · Dependencias

### 11.1 Nuevas (runtime, backend) — cada una con su porqué

| Paquete | Por qué | Paso |
|---|---|---|
| `helmet` | Security headers estándar en 1 línea | 06 |
| `express-rate-limit` | Rate limiting de la tabla §5.3 | 06 |
| `express-mongo-sanitize` | Bloquea inyección de operadores NoSQL | 06 |
| `cookie-parser` | Leer la cookie del refresh token | 08 |
| `resend` | SDK oficial del servicio de email elegido | 11 |
| `multer` | Parsear multipart (subida de archivos) en memoria | 21 |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | Cliente S3-compatible para R2 + URLs firmadas | 21 |

### 11.2 Nuevas (dev, backend)

`vitest`, `supertest`, `mongodb-memory-server` (suite de regresión de seguridad, paso 07+).

### 11.3 Rechazadas deliberadamente

| Paquete | Por qué NO |
|---|---|
| `zod`/`joi` (backend) | `express-validator` ya está declarado en `package.json` — se usa ese |
| `node-cron` | El cron de Railway hace el trabajo sin proceso extra |
| `passport` | JWT propio ya implementado; passport agrega capas sin beneficio aquí |
| `socket.io` | Polling de 60 s basta (Non-Goal §1.4) |

### 11.4 A eliminar

`airtable` (backend, al cerrar Fase B) · `nodemailer` (backend, paso 11) · `googleapis`/`google-auth-library` (del **frontend** — error histórico; en backend solo si paso 28) · `chart.js`/`react-chartjs-2` (frontend, paso 14).

---

## 12 · Estrategia de deploy

- **Backend (Railway):** auto-deploy en push a `main`. Cada paso de §9 = 1 commit + tag → deploy. Rollback: `git revert` + push (nunca `--force`), o redeploy de un deployment anterior desde el panel de Railway. Cron jobs: expiración diaria (paso 17) y respaldo (paso 27, opción 2).
- **Dominio API (paso 09):** `api.primefh.cl` → CNAME en Hostinger → Railway emite TLS. La URL `*.up.railway.app` deja de usarse en el frontend.
- **Frontend (Hostinger, manual):** `npm run build` → subir el contenido de `dist/` vía File Manager a la carpeta de `app.primefh.cl` (incluye `.htaccess` con headers desde paso 26). Verificación post-subida SIEMPRE en incógnito (SW cachea). Mejora futura (no bloqueante): automatizar con FTP en GitHub Actions.
- **DNS en Hostinger:** CNAME `api` (paso 09) + registros SPF/DKIM de Resend (paso 11).

---

## 13 · Estrategia de testing

- **Framework:** `vitest` + `supertest` + `mongodb-memory-server` en `backend/tests/` (desde paso 07). `npm test` en `/backend` debe estar verde antes de cada checkpoint desde entonces.
- **Cobertura obligatoria (regresión de seguridad):** paciente A no lee datos de B (404) · profesional no lee/edita pacientes no asignados · profesional no crea/promueve admin · login limitado a 5 intentos · `forgot-password` nunca contiene token · invitación de un solo uso · descuento/devolución de sesiones (incl. concurrencia por la última sesión) · ventana 4h · cap del bulk · archivos: mimetype falso rechazado + IDOR 404.
- **Datos de prueba:** cada suite crea sus usuarios en la BDD en memoria (sin tocar Atlas). El seed de desarrollo (`npm run seed`) queda solo para pruebas manuales locales.
- **Manual (Mario, cada sesión):** el flujo tocado, en navegador normal + incógnito + celular. Antes de pacientes reales: checklist §20 completa en iPhone y Android.

---

## 14 · Seguridad y secretos

### 14.1 Tabla de controles

| Control | Implementación | Paso |
|---|---|---|
| Almacenamiento de secretos | Solo variables de Railway / `.env` local (gitignored). Nada en el código ni en el bundle del frontend | 03 |
| Rotación | Post-incidente V7 (paso 03) y luego anual, o inmediata si se sospecha exposición | 03 |
| Validación de entrada | `express-validator` en endpoints de escritura; enums/regex de Mongoose como segunda línea | 06 |
| Encoding de salida | Escape de HTML en emails; React escapa por defecto en la UI; `escapeRegex` en búsquedas | 06 |
| Inyección NoSQL | `express-mongo-sanitize` + validators de tipo | 06 |
| AuthN | JWT 1h + refresh 30d rotativo/revocable (§8.2) | 08 |
| AuthZ | `protect` + `authorize` + `assertCanAccessPatient` en cada endpoint (matriz §5.2) — siempre server-side, siempre antes del trabajo | 04 |
| CSRF | Refresh cookie `SameSite=Lax` + `Path=/api/auth` + check de `Origin`; el resto de la API usa Bearer (inmune a CSRF clásico) | 08, 09 |
| Rate limiting | Tabla §5.3 | 06 |
| Webhooks | No hay en v1. Si N8N llega (fase futura): verificación por firma HMAC **antes** de parsear el body | — |
| Auditoría de dependencias | `npm audit` en cada sesión que toque `package.json`; actualizar solo con motivo | — |
| Security headers | Backend: helmet. Frontend: `.htaccess` con HSTS, nosniff, DENY, Referrer-Policy, CSP (valores literales en paso 26) | 06, 26 |
| PII/PHI | Nunca en localStorage (paso 10), nunca en caché del SW (paso 26), nunca en URLs/query strings, nunca en logs | 10, 26 |
| Higiene de logs | `console.error` sin volcar objetos de request; sin tokens/contraseñas/PHI; stack traces solo en dev | 06 |
| Archivos | Bucket R2 privado; URLs firmadas 5 min; magic bytes; 10 MB; pertenencia | 21 |

### 14.2 Reglas duras (no negociables)

1. Ningún secreto se commitea, se loguea ni llega al bundle del cliente.
2. Toda autorización se verifica en el servidor **antes** de ejecutar el trabajo.
3. Ninguna respuesta de la API incluye `password`, `resetPasswordToken`, `invite.tokenHash`, `googleTokens` ni datos de otro paciente.
4. El frontend puede mentir; el backend no (regla histórica de `CLAUDE.md` — sigue vigente).

### 14.3 Régimen de datos regulados

Esta app procesa **datos sensibles de salud** de personas en Chile:

- **Ley 19.628** (vigente): los datos de salud son datos sensibles; requieren consentimiento y medidas de seguridad.
- **Ley 21.719** (nueva ley de protección de datos, **entra en vigencia el 1 de diciembre de 2026** — este año): crea la Agencia de Protección de Datos, multas reales, obligación de **notificar brechas de seguridad**, y derechos ARCO ampliados (acceso, rectificación, cancelación, oposición y portabilidad).
- Obligaciones concretas que este blueprint cubre: medidas de seguridad técnicas (Fases A–B completas), minimización de exposición (matriz §5.2), respaldo y disponibilidad (paso 27), capacidad de eliminar/desactivar datos de un paciente que lo pida (soft-delete + eliminación definitiva por admin).
- Pendiente de negocio (no de código): texto de consentimiento informado al onboardear pacientes (recomendado: checkbox en la pantalla de invitación, paso 13) y política de privacidad actualizada en `/privacidad`.

### 14.4 Respuesta a incidentes (mínima viable)

Si se sospecha una brecha: (1) rotar `JWT_SECRET` (mata todas las sesiones) y credenciales de Atlas; (2) revisar logs de Railway del período; (3) desde el 1-dic-2026, evaluar notificación a la Agencia según Ley 21.719; (4) documentar en `STATUS.md`.

### 14.5 Retención

Datos clínicos: se conservan mientras la persona sea paciente y por el plazo que exija la normativa sanitaria chilena aplicable a fichas clínicas (referencia: la ficha clínica se conserva por años, no se borra al vencer un plan). Paciente inactivo = `isActive:false` (los datos se conservan, el acceso muere). Eliminación definitiva solo por solicitud del titular vía admin.

---

## 15 · Accesibilidad

Baseline WCAG 2.2 AA pragmática: todos los inputs con `<label>` asociado (los formularios shadcn ya lo hacen — mantener el patrón); targets táctiles ≥44px en móvil (botones de slots y sliders de wellness); contraste: teal `#3D9AA6` sobre blanco solo para texto grande/bold — texto normal usa los tokens oscuros existentes; imágenes/íconos decorativos con `aria-hidden`; el badge de la campanita con `aria-label="N notificaciones sin leer"`; formularios con errores anunciados (mensaje de texto, no solo color). Verificación: Lighthouse a11y ≥ 90 en dashboard de paciente y flujo de reserva (`npx lighthouse https://app.primefh.cl --only-categories=accessibility`).

---

## 16 · Observabilidad y costos

### 16.1 Instrumentación

| Qué | Herramienta | Captura | Quién mira |
|---|---|---|---|
| Errores backend | Logs de Railway (estructurar `console.error` sin PHI) | Stack + ruta + status | Mario cuando algo falla; revisión semanal |
| Uptime | UptimeRobot → `/api/health` cada 5 min | Caídas de API/BDD | Alerta al email de Mario |
| Deploys | Panel de Railway | Build fallido | Mario tras cada push |
| Errores frontend | Toasts + consola (v1) | — | Reporte de usuarios |

### 16.2 Métricas clave (4, sin dashboards de vanidad)

| Métrica | Objetivo | Umbral de alerta |
|---|---|---|
| Uptime mensual de la API | ≥ 99.5% | 2 caídas seguidas de UptimeRobot |
| Latencia p95 de `/api/appointments` | < 800 ms | > 2 s sostenido |
| Logins fallidos por hora | < 20 | pico anómalo = revisar (posible ataque) |
| % de invitaciones aceptadas en 7 días | > 80% | < 50% = el email no llega, revisar Resend |

### 16.3 Modelo de costos mensual

| Servicio | Free tier | Costo v1 (~30 pacientes) | A 10× (~300) | Cliff a vigilar |
|---|---|---|---|---|
| Railway | — | ~US$5 | ~US$10–20 | horas de cómputo del plan |
| MongoDB Atlas | M0 512 MB | $0 (o **M2 ~US$9 con backups** — recomendado) | M10 ~US$60 | **512 MB del M0** (con archivos fuera en R2, tarda en llegar) |
| Cloudflare R2 | 10 GB | $0 | ~US$1–3 | 10 GB gratis |
| Resend | 3.000 emails/mes | $0 | $0–20 | 3.000/mes |
| Hostinger | ya pagado | $0 | $0 | — |
| **Total** | | **≈ US$5–14/mes** | ≈ US$70–100 | |

Línea más cara: Railway (v1) → Atlas (a escala). Palanca más barata: quedarse en M0 usando la opción 2 de respaldos (paso 27) — aceptable solo si la restauración se prueba de verdad.

---

## 17 · Model routing

NOT APPLICABLE — la aplicación no usa LLMs en runtime. (El uso de modelos de Claude Code para construir está en §18.)

---

## 18 · Skills / modelos durante la construcción

Protocolo por sesión (hereda de `PROMPTS.md`): `/clear` → elegir modelo → pegar el paso de §9 → verificar → commit + tag → actualizar `STATUS.md`.

| Pasos | Modelo sugerido | Por qué |
|---|---|---|
| 01–09, 12, 15–17, 19, 21, 27 | Opus (Plan Mode en 08, 15, 16) | Seguridad, atomicidad, migraciones, wiring de eventos entre módulos — donde un error cuesta caro |
| 10, 11, 13, 14, 18, 20, 22–26 | Sonnet | UI, formularios, pantallas, integración mecánica de SDK |
| 28 (opcional) | Opus (Plan Mode) | OAuth + cifrado |

---

## 19 · Workspace del agente

- `CLAUDE.md` (raíz) sigue siendo la ley de trabajo: español simple, una tarea por sesión, modelo de datos primero, validaciones en backend, nunca tocar `.env`, nunca `--force`/borrar datos sin confirmación. Este blueprint no lo duplica — lo referencia.
- Tras aprobar este blueprint, agregar al final de `CLAUDE.md`: *"El plan de construcción vigente vive en `BLUEPRINT.md` §9 — seguir sus pasos en orden."*
- `STATUS.md`: registrar cada sesión (fecha, paso ejecutado, modelo, commit/tag, pendientes). Los checklists de etapas de `STATUS.md` quedan reemplazados por los pasos de §9 (mapa: Fase A–B ≈ seguridad+onboarding; Fase C ≈ etapas 2–3; Fase D ≈ etapas 4–7 de `PROMPTS.md`).
- Verificación crítica configurada por paso (sección Verify) — no inventar comandos distintos; si un Verify falla, el paso no está terminado.

---

## 20 · Puertas de aceptación (antes de pacientes reales)

### 20.1 Smoke test de seguridad (ejecutable tras Fase A, repetir tras Fase B)

```bash
API=https://api.primefh.cl/api   # (o la URL de Railway antes del paso 09)
curl -s -X POST $API/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"x@x.cl"}' | grep -c resetToken        # 0
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/auth/register -H 'Content-Type: application/json' -d '{}'                  # 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/auth/verify-identity -H 'Content-Type: application/json' -d '{}'           # 404
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code} ' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"smoke@x.cl","password":"mala"}'; done; echo   # termina en 429
curl -sI $API/ | grep -ci 'x-content-type-options'                                                                                # 1
```

### 20.2 Checklist funcional (manual, iPhone y Android reales)

- [ ] Invitación → email llega a inbox → paciente elige contraseña → entra a su dashboard.
- [ ] Paciente A logueado NO puede ver datos de paciente B (probar URL con ID ajeno → 404).
- [ ] Registrar pago (admin) → barra de sesiones correcta → agendar descuenta → cancelar con 5h devuelve → cancelar con 3h no deja (botón deshabilitado) → no-show descuenta.
- [ ] 4 pacientes simultáneos llenan el slot → el 5° no puede; agendar a <4h rechazado.
- [ ] Plan vencido: no agenda, no registra evolución (solo lectura), ve mensaje + botón WhatsApp, sin precios en ninguna parte.
- [ ] Evolución registrada por paciente → campanita + email al profesional.
- [ ] Archivo subido por paciente visible para su profesional; inaccesible para terceros.
- [ ] Wellness: 2° check-in del día bloqueado; promedio bajo alerta al profesional.
- [ ] PWA instalable (íconos correctos, color teal) en iPhone y Android.

### 20.3 Infra y datos

- [ ] Credenciales rotadas (V7) verificadas — las viejas del historial de git ya no sirven.
- [ ] Respaldo automático corriendo y **una restauración probada** con éxito.
- [ ] UptimeRobot activo y alertando al email de Mario.
- [ ] Tags `step-01` … presentes (`git tag -l 'step-*'` lista los pasos completados).
- [ ] `cd backend && npm test` verde.
- [ ] Usuarios y datos de prueba eliminados de producción.

### 20.4 Registro de decisiones

| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-08-05 | Cerrar registro público, recuperación RUT+fecha y auto-creación Airtable | Entrevista — V1/V2/V3 |
| 2026-08-05 | Sesión 30d renovable (access 1h + refresh rotativo) | Entrevista |
| 2026-08-05 | Archivos en Cloudflare R2 privado | Entrevista |
| 2026-08-05 | Email con Resend + dominio verificado | Entrevista |
| 2026-08-05 | Ventana de agendamiento = 4 h (código tenía 24 h) | `CLAUDE.md`/`PROMPTS.md` la fijan; STATUS lo tenía pendiente de confirmar |
| 2026-08-05 | Descuento de sesión al agendar, devolución al cancelar ≥4h | Se deriva de "la sesión vuelve al plan" de las reglas |
| 2026-08-05 | `evaluacion` consume del plan activo existente | Default razonable — **Mario puede ajustar** |

---

*Fin del blueprint. Siguiente acción: paso 01 de §9 (sesión nueva, modelo Opus).*
