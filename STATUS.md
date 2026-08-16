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
- [ ] Paso 04 — Middleware de pertenencia y cierre de IDORs
- [ ] Paso 05 — Anti-escalada de roles y política de contraseñas
- [ ] Paso 06 — Hardening del servidor (helmet, rate limiting, sanitización, validación)
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
| 2026-08-05 | Paso 03 (Fase A) | **`.env.production` sacado del control de versiones — y V7 desmentido.** Antes de pedir la rotación de credenciales, se verificó qué contenía realmente el archivo (extrayendo solo nombres de variable, nunca valores): **una sola variable, `VITE_API_URL`**, que es la URL pública de la API y queda igualmente incrustada en el bundle del frontend. Un barrido del historial completo de git buscando cadenas de conexión de MongoDB, `JWT_SECRET`, `AIRTABLE_API_KEY` y `SMTP_PASS` no encontró ninguna credencial real: todas las coincidencias son ejemplos con usuario/password ficticios en `SETUP.md` y los `.env.example`, y `backend/.env` nunca estuvo trackeado. **Conclusión: nunca hubo filtración → la rotación obligatoria queda cancelada.** El hallazgo V7 del blueprint era un falso positivo (se marcó por el nombre del archivo, sin verificar el contenido); corregido en `BLUEPRINT.md`. | Opus 5 | (ver tag `step-03-secrets`) | **Único pendiente de Mario (no urgente):** verificar en Railway que `JWT_SECRET` sea largo y aleatorio — si fuera una palabra corta o adivinable, alguien podría falsificar sesiones. No es verificable desde el repo. Siguiente: Paso 04 (Opus), el de los IDOR. |
| 2026-08-05 | Paso 02 (Fase A) | **Eliminada la puerta trasera de Airtable.** El login ya no llama a `syncPatientByEmail`: un email desconocido falla con 401 en vez de crear la cuenta con contraseña `123456`. Se eliminó la función completa (su único llamador era el login). **Hallazgo nuevo, fuera del blueprint:** la misma contraseña fija estaba en `scripts/migrate.js` (que Mario ya ejecutó — hay cuentas migradas con esa clave) y en `utils/seed.js`; ambos corregidos para usar contraseñas aleatorias/de entorno. `POST /users/sync-airtable` pasó a solo-admin. Eliminados `scripts/update_passwords.js` (reseteaba TODAS las contraseñas a valores fijos) y `scripts/test_booking_logic.js` (dependía del backdoor). Verificado contra Atlas: 43 usuarios antes y después del intento de login, cuenta no creada, 401. | Opus 5 | `84f6368` (tag `step-02-airtable`) | **Riesgo residual:** pueden existir cuentas reales con contraseña `123456` de la migración previa — el Paso 12 (invitaciones) las regulariza; mientras tanto, Mario puede pedir a los pacientes activos que la cambien. Siguiente: Paso 03 (Opus). |
| 2026-08-05 | Paso 01 (Fase A) | **Cerrada la recuperación insegura y el registro público.** `forgot-password` ya no devuelve el token de reseteo en la respuesta y responde idéntico exista o no el email (sin enumeración de cuentas). Eliminados `POST /auth/register`, `POST /auth/verify-identity` y `PUT /auth/set-password/:verifyToken` — el flujo de RUT + fecha de nacimiento permitía tomar control de cuentas ajenas. Se adelantó el arreglo de `notFound` (antes toda ruta inexistente respondía 500, lo que impedía verificar que los endpoints se hubieran ido; estaba programado para el Paso 07(d), ya marcado como resuelto ahí). Frontend: `RecoverPassword` pasa a versión interina con WhatsApp, y se eliminó `register` de `authService`/`AuthContext`. Verificado con servidor local contra Atlas: los 3 endpoints responden 404 y las respuestas de `forgot-password` son idénticas byte a byte. 771 líneas de código inseguro eliminadas. | Opus 5 | `ced8700` (tag `step-01-auth-doors`) | **Falta desplegar:** push a `main` (Railway) + subir build a Hostinger. Sin desplegar, la vulnerabilidad sigue viva en producción. Siguiente: Paso 02 (Opus). |
| 2026-08-05 | Blueprint | Análisis exhaustivo del código (backend + frontend) con metodología the-architect (brownfield) y generación de `BLUEPRINT.md`: 20 secciones, 28 pasos con verificación ejecutable. Se detectaron 12 hallazgos críticos (V1–V12), incl. token de reseteo devuelto en la respuesta, cuentas auto-creadas desde Airtable con contraseña `123456`, IDORs de fichas médicas, escalada de roles, `.env.production` en git (rotar credenciales) y descuento de sesiones nunca implementado. Entrevista con Mario: cerrar accesos antiguos, sesión 30d renovable, archivos en R2, email con Resend. Ventana de agendamiento confirmada en 4h (resuelve el pendiente del 17-jul). `CLAUDE.md`, `STATUS.md` y `PROMPTS.md` actualizados/regenerados para reflejar el blueprint como plan vigente. | Fable 5 | (pendiente) | Próxima sesión: `BLUEPRINT.md` §9 Paso 01 (Opus, ver `PROMPTS.md`). Fase A completa = urgente, deploy tras cada paso. |

