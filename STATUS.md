# STATUS.md — Prime F&H

> Actualizar este archivo al final de CADA sesión de Claude Code.
> Marcar `[x]` el paso completado (según `BLUEPRINT.md` §9) y anotar en el registro de sesiones.

**Última actualización:** 2026-08-05
**Stack:** Vite + React (SPA/PWA) + Express + MongoDB Atlas — NO Next.js/Supabase (ver `CLAUDE.md`)
**Deploy:** Backend en Railway (`prime-saas-production.up.railway.app`, auto-deploy desde `main`) · Frontend en Hostinger (`https://app.primefh.cl`, subida manual del build)

> 📘 **El plano completo del proyecto (arquitectura, seguridad, modelo de datos, y los 28 pasos de construcción) vive en `BLUEPRINT.md`.** Este archivo (`STATUS.md`) solo lleva el control de avance contra esos pasos — no duplica el diseño, para que no se desactualice en dos lugares distintos.

---

## 📸 ESTADO REAL (resumen — detalle verificado en `BLUEPRINT.md` §1.2 y Resumen Ejecutivo)

Hay más construido de lo que parecía a simple vista: auth por roles, agenda con la regla de 4 simultáneos, cancelación con regla de 4 horas, disponibilidad por profesional, sistema de planes (a medias), mediciones/ejercicios/dolor con gráficos, PWA funcionando.

Pero una auditoría completa (2026-08-05) encontró **vulnerabilidades graves en producción** (recuperación de contraseña insegura, creación automática de cuentas desde Airtable, fichas médicas accesibles entre pacientes, escalada de roles, entre otras) y features a medio terminar (el descuento de sesiones del sistema de planes nuevo nunca se ejecuta). El detalle completo, verificado línea por línea, está en `BLUEPRINT.md` — no se repite aquí para evitar que este resumen quede desactualizado. **La Fase A del blueprint (pasos 01–07) tapa lo urgente y va primero.**

---

## 📋 CHECKLIST — BLUEPRINT.md §9 (28 pasos en 4 fases)

### FASE A — Hotfixes de seguridad 🚨 (hacer primero — deploy tras cada paso)
- [x] Paso 01 — Cerrar recuperación insegura y registro público ✅ 2026-08-05 (`step-01-auth-doors`)
- [x] Paso 02 — Eliminar puerta trasera de Airtable ✅ 2026-08-05 (`step-02-airtable`)
- [x] Paso 03 — Sacar `.env.production` del repo ✅ 2026-08-05 (`step-03-secrets`) — la rotación resultó innecesaria (ver registro)
- [x] Paso 04 — Middleware de pertenencia y cierre de IDORs ✅ 2026-09-06 (`step-04-idor`) — **verificado con 24 pruebas reales contra la base de producción**
- [x] Paso 05 — Anti-escalada de roles y política de contraseñas ✅ 2026-09-06 (`step-05-roles`)
- [x] Paso 06 — Hardening del servidor (helmet, rate limiting, sanitización, validación) ✅ 2026-09-06 (`step-06-hardening`)
- [ ] Paso 07 — Cuarentena de Google Calendar, limpieza de scripts y bugs 500

### FASE B — Autenticación definitiva
- [ ] Paso 08 — Refresh tokens: modelo y endpoints
- [ ] Paso 09 — Dominio `api.primefh.cl` + CORS definitivo
- [ ] Paso 10 — Frontend: token en memoria, fin del PHI en localStorage
- [ ] Paso 11 — Resend: servicio de email con dominio verificado
- [ ] Paso 12 — Onboarding por invitación (backend)
- [ ] Paso 13 — Onboarding y reset por email (frontend)
- [ ] Paso 14 — Limpieza de rutas y guards por rol (frontend)

### FASE C — Planes y agenda consolidados
- [ ] Paso 15 — Motor de descuento de sesiones
- [ ] Paso 16 — Migrar y retirar el modelo `Plan` legacy
- [ ] Paso 17 — Reglas de agenda al 100%: ventana 4h, cron de expiración, recurrente completa
- [ ] Paso 18 — Fin de los precios en la app y consolidación de UI de planes

### FASE D — Features faltantes
- [ ] Paso 19 — Notificaciones (backend)
- [ ] Paso 20 — Campanita (frontend)
- [ ] Paso 21 — Archivos médicos en R2 (backend)
- [ ] Paso 22 — Archivos médicos (UI)
- [ ] Paso 23 — Wellness check-in (modelo + paciente)
- [ ] Paso 24 — Wellness: tendencias para staff/admin
- [ ] Paso 25 — Historial clínico completo + export CSV
- [ ] Paso 26 — PWA pulida y headers del frontend
- [ ] Paso 27 — Salud, monitoreo y respaldos
- [ ] Paso 28 — (Opcional) Google Calendar bien hecho

---

## 🚀 ANTES DE ONBOARDEAR PACIENTES REALES

Checklist completa en `BLUEPRINT.md` §20 (Puertas de aceptación): smoke test de seguridad ejecutable, checklist funcional en iPhone/Android, credenciales rotadas, respaldo probado con una restauración real, datos de prueba eliminados.

---

## 📝 REGISTRO DE SESIONES

| Fecha | Paso / Etapa | Qué se hizo | Modelo | Commit | Notas / pendientes |
|---|---|---|---|---|---|
| 2026-07-17 | Infraestructura/Deploy | Diagnóstico y arreglo completo del sitio caído: (1) Railway — el trial gratuito había expirado, se pagó el plan y redesplegó solo; (2) `app.primefh.cl` nunca se había publicado — se creó el subdominio en Hostinger, se corrigió `.env.production` (faltaba `/api` en `VITE_API_URL`), se compiló el frontend y se subió manualmente vía File Manager; (3) bug de CORS — `FRONTEND_URL` en Railway apuntaba a sí mismo en vez de a `https://app.primefh.cl`, corregido y redesplegado. Se limpiaron archivos basura sueltos en `backend/`. | Sonnet 5 | `744264d` | Login con la cuenta semilla (`mario@primefh.cl`) dio credenciales inválidas — revisar/resetear si se necesita acceso admin. |
| 2026-07-17 | Documentación | Se reescribieron `CLAUDE.md` y `STATUS.md` completos: el `CLAUDE.md` anterior describía un stack (Next.js + Supabase) que nunca se construyó — se reemplazó por el stack real (Vite + Express + MongoDB) y el modelo de negocio objetivo. `STATUS.md` se rehízo con un inventario verificado del código (qué existe, qué existe con reglas distintas, qué falta) y un checklist de Etapas 2 a 7. | Sonnet 5 | (pendiente) | Definir con Mario: ¿se ajustan los planes/ventana de agendamiento a las reglas objetivo, o las reglas objetivo se ajustan a lo ya construido? |
| 2026-09-06 | Paso 06 (Fase A) | **Endurecimiento del servidor.** Límite de intentos con `express-rate-limit`: login 5 cada 15 min por IP+email (un login correcto no gasta intentos), recuperación 3/hora, y un techo general de 300/5min para toda la API — antes se podían probar contraseñas sin parar. Cabeceras de seguridad con `helmet` + `trust proxy` (sin esto el límite sería inservible tras el proxy de Railway). Tope de 1 MB por petición. **Decisión de Mario:** la sanitización NoSQL se escribió a mano (`middleware/sanitize.js`) en vez de usar `express-mongo-sanitize`, que lleva años sin mantenimiento y se rompe con Express 5 — son ~20 líneas legibles y una dependencia menos. También `escapeRegex` en todas las búsquedas (antes buscar `(` rompía la consulta y `(a+)+$` podía colgar el servidor) y `escapeHtml` en los correos (el motivo de una cancelación se incrustaba sin escapar en el correo del profesional). El `errorHandler` ahora respeta el código propio del error (413/400 en vez de 500). Verificado: el 6.º intento de login da 429, las cabeceras están presentes, y ni un profesional ni un paciente logran escaparse de su alcance inyectando operadores en la URL. | Opus 5 | `8b15163` (tag `step-06-hardening`) | **Pendiente de infraestructura:** `backend/package-lock.json` está en `.gitignore`, así que Railway instala las versiones que le toquen en cada despliegue en vez de las probadas aquí. Conviene versionarlo. Siguiente: Paso 07, último de la Fase A. |
| 2026-09-06 | Paso 05 (Fase A) | **Cerrada la escalada de privilegios.** El rol lo decide ahora el servidor, no el formulario: antes `createUser` y `updateUser` leían `role` e `isActive` directo del body, así que un profesional podía crearse una cuenta de administrador, ascender a cualquiera o desactivar al admin. Se pasó a lista blanca de campos en ambos: un profesional solo crea pacientes (asignados a él) y solo edita los suyos (403 ante cuentas del equipo, 404 ante pacientes ajenos); rol, estado y asignación quedan reservados al admin. `DELETE /users/:id` pasó a solo-admin y ahora **desactiva en vez de borrar** — un borrado real destruiría la ficha clínica y el historial de citas, que deben conservarse por normativa. Contraseña mínima de 6 → 8 caracteres (modelo, backend con 400 claro, y formularios). Verificado con 12 pruebas reales contra `prime_fh`: la escalada falla por todos los caminos, el admin conserva sus capacidades y los profesionales siguen trabajando normal. Sin datos de prueba residuales. | Opus 5 | `0027c46` (tag `step-05-roles`) | Bug propio detectado y corregido en el camino: usé `canAccessPatient` en `userController` sin importarlo — falló hacia el lado seguro (bloqueaba), pero devolvía 500 en vez de 404. Siguiente: Paso 06 (rate limiting y hardening). |
| 2026-09-06 | Paso 04 — verificación + hallazgo de infraestructura | **Verificación completa del Paso 04: 24 pruebas reales contra `prime_fh`, todas pasaron.** Un paciente no puede leer ficha, perfil clínico, plan, mediciones, ejercicios, dolor, saldo ni sesiones extra de otro (404 en los 10 casos); sí ve todo lo suyo; un profesional solo accede a sus asignados; nadie puede tocar la agenda de otro profesional (403, y se comprobó que la de Tomás quedó intacta); ningún token sensible sale en las respuestas. **HALLAZGO GRAVE DE INFRAESTRUCTURA:** la app en producción estaba conectada a la base `test` (vacía, 1 usuario) en vez de `prime_fh` (43 usuarios, 39 pacientes) — la `MONGODB_URI` de Railway no incluía el nombre de la base. Los 39 pacientes importados de Airtable nunca habían sido visibles en la app. Corregido en Railway y en el `.env` local. En el proceso Mario pegó la contraseña de MongoDB en el chat y fue **rotada** (esta vez sí correspondía). Se añadió `.env.backup` al `.gitignore`. **Bugs corregidos de paso:** los 2 endpoints que siempre respondían 500 (Paso 07c, adelantado) — impedían que un paciente viera sus propias mediciones y zonas de dolor. | Opus 5 | `0c7ea55` | De los 39 pacientes, 38 tienen profesional asignado y 1 queda en el pool. Reparto: 35 a Mario, 2 a Felipe, 1 a Tomás, 0 a Rafael. **Pendiente:** Mario debe corregir la `MONGODB_URI` de Railway (producción caída con 502 hasta entonces). Siguiente: Paso 05. | **Cerrados los IDOR: ya no se puede leer la ficha de otro paciente cambiando el id en la URL.** Se creó una regla única de pertenencia (`canAccessPatient` / `authorizePatientAccess` en `middleware/auth.js`) y se montó en las **16 rutas** con `:patientId` — incluida `extra-sessions/patient/:patientId`, que el blueprint no había listado. Responde 404 (no 403) para no confirmar que el paciente existe. Además: `GET /api/users` ahora decide el alcance en el servidor (un profesional sin filtro recibía la base COMPLETA de usuarios; el paciente solo puede listar staff con campos mínimos), los GET de registro único de measurements/exercises/eva ahora también validan al profesional, cada profesional solo puede editar su propia disponibilidad, `DELETE /appointments/:id` queda solo-admin, y `User.toJSON` nunca serializa `password`/`resetPasswordToken`/`invite`. Verificado: cobertura de las 16 rutas, 11 casos de la regla con doble de prueba, serialización sin fugas. | Opus 5 | `2184587` (tag `step-04-idor`) | **La prueba HTTP de extremo a extremo NO se corrió** — la BD local rechaza la conexión (contraseña de MongoDB desactualizada en `backend/.env`; producción está bien). Mario optó por verificar manualmente en la app tras desplegar. **Riesgo a vigilar:** los pacientes sin `assignedProfessionalId` quedan invisibles para los profesionales — si pasa, correr `npm run migrate-assigned-professional` (idempotente). **Cambio de comportamiento:** el selector de profesionales del paciente ahora sí muestra a los admin (antes un bug lo impedía). Siguiente: Paso 05. | **`.env.production` sacado del control de versiones — y V7 desmentido.** Antes de pedir la rotación de credenciales, se verificó qué contenía realmente el archivo (extrayendo solo nombres de variable, nunca valores): **una sola variable, `VITE_API_URL`**, que es la URL pública de la API y queda igualmente incrustada en el bundle del frontend. Un barrido del historial completo de git buscando cadenas de conexión de MongoDB, `JWT_SECRET`, `AIRTABLE_API_KEY` y `SMTP_PASS` no encontró ninguna credencial real: todas las coincidencias son ejemplos con usuario/password ficticios en `SETUP.md` y los `.env.example`, y `backend/.env` nunca estuvo trackeado. **Conclusión: nunca hubo filtración → la rotación obligatoria queda cancelada.** El hallazgo V7 del blueprint era un falso positivo (se marcó por el nombre del archivo, sin verificar el contenido); corregido en `BLUEPRINT.md`. | Opus 5 | (ver tag `step-03-secrets`) | **Único pendiente de Mario (no urgente):** verificar en Railway que `JWT_SECRET` sea largo y aleatorio — si fuera una palabra corta o adivinable, alguien podría falsificar sesiones. No es verificable desde el repo. Siguiente: Paso 04 (Opus), el de los IDOR. |
| 2026-08-05 | Paso 02 (Fase A) | **Eliminada la puerta trasera de Airtable.** El login ya no llama a `syncPatientByEmail`: un email desconocido falla con 401 en vez de crear la cuenta con contraseña `123456`. Se eliminó la función completa (su único llamador era el login). **Hallazgo nuevo, fuera del blueprint:** la misma contraseña fija estaba en `scripts/migrate.js` (que Mario ya ejecutó — hay cuentas migradas con esa clave) y en `utils/seed.js`; ambos corregidos para usar contraseñas aleatorias/de entorno. `POST /users/sync-airtable` pasó a solo-admin. Eliminados `scripts/update_passwords.js` (reseteaba TODAS las contraseñas a valores fijos) y `scripts/test_booking_logic.js` (dependía del backdoor). Verificado contra Atlas: 43 usuarios antes y después del intento de login, cuenta no creada, 401. | Opus 5 | `84f6368` (tag `step-02-airtable`) | **Riesgo residual:** pueden existir cuentas reales con contraseña `123456` de la migración previa — el Paso 12 (invitaciones) las regulariza; mientras tanto, Mario puede pedir a los pacientes activos que la cambien. Siguiente: Paso 03 (Opus). |
| 2026-08-05 | Paso 01 (Fase A) | **Cerrada la recuperación insegura y el registro público.** `forgot-password` ya no devuelve el token de reseteo en la respuesta y responde idéntico exista o no el email (sin enumeración de cuentas). Eliminados `POST /auth/register`, `POST /auth/verify-identity` y `PUT /auth/set-password/:verifyToken` — el flujo de RUT + fecha de nacimiento permitía tomar control de cuentas ajenas. Se adelantó el arreglo de `notFound` (antes toda ruta inexistente respondía 500, lo que impedía verificar que los endpoints se hubieran ido; estaba programado para el Paso 07(d), ya marcado como resuelto ahí). Frontend: `RecoverPassword` pasa a versión interina con WhatsApp, y se eliminó `register` de `authService`/`AuthContext`. Verificado con servidor local contra Atlas: los 3 endpoints responden 404 y las respuestas de `forgot-password` son idénticas byte a byte. 771 líneas de código inseguro eliminadas. | Opus 5 | `ced8700` (tag `step-01-auth-doors`) | **Falta desplegar:** push a `main` (Railway) + subir build a Hostinger. Sin desplegar, la vulnerabilidad sigue viva en producción. Siguiente: Paso 02 (Opus). |
| 2026-08-05 | Blueprint | Análisis exhaustivo del código (backend + frontend) con metodología the-architect (brownfield) y generación de `BLUEPRINT.md`: 20 secciones, 28 pasos con verificación ejecutable. Se detectaron 12 hallazgos críticos (V1–V12), incl. token de reseteo devuelto en la respuesta, cuentas auto-creadas desde Airtable con contraseña `123456`, IDORs de fichas médicas, escalada de roles, `.env.production` en git (rotar credenciales) y descuento de sesiones nunca implementado. Entrevista con Mario: cerrar accesos antiguos, sesión 30d renovable, archivos en R2, email con Resend. Ventana de agendamiento confirmada en 4h (resuelve el pendiente del 17-jul). `CLAUDE.md`, `STATUS.md` y `PROMPTS.md` actualizados/regenerados para reflejar el blueprint como plan vigente. | Fable 5 | (pendiente) | Próxima sesión: `BLUEPRINT.md` §9 Paso 01 (Opus, ver `PROMPTS.md`). Fase A completa = urgente, deploy tras cada paso. |

