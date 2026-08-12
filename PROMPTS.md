# PROMPTS.md — Playbook de sesiones para Prime F&H

> **Cómo usar este documento:**
> 1. Antes de CADA sesión: escribe `/clear` en Claude Code.
> 2. Cambia el modelo con `/model` según lo que indica cada paso (Claude Code no puede cambiarse de modelo solo — lo haces tú).
> 3. Si dice **Plan Mode**: presiona Shift+Tab antes de pegar el prompt.
> 4. Copia y pega el bloque de prompt tal cual.
> 5. Lee la explicación de Claude; si no la entiendes, pídele un ejemplo.
> 6. Haz **tu verificación** (la de cada paso, abajo) — no des el paso por bueno solo porque Claude dice que funcionó.
> 7. El paso ya termina con su propio commit + tag (Claude lo hace solo, es parte del "Checkpoint" de cada paso en `BLUEPRINT.md`).
> 8. Verifica el deploy (Railway/Hostinger según corresponda) y pide: *"actualiza STATUS.md marcando el Paso NN como completado"*.
>
> **De dónde sale cada prompt:** el diseño técnico completo — qué archivos tocar, qué criterios cumplir, qué comandos correr para verificar — vive en `BLUEPRINT.md`, sección 09 (ORDEN DE CONSTRUCCIÓN). Este documento **no repite** ese detalle (para que no queden dos versiones que se desactualizan entre sí); en cambio, cada prompt le pide a Claude Code que lea el paso correspondiente del blueprint y lo ejecute completo. Lo que sí encontrarás aquí, y que el blueprint no trae, es: qué modelo usar, si hace falta Plan Mode, cuándo te toca a TI hacer algo manual (crear una cuenta, copiar un registro DNS, rotar una contraseña), y cómo verificar tú mismo que quedó bien.
>
> **Requisito:** `BLUEPRINT.md` debe estar en la raíz del repo (ya debería estarlo). Si en algún momento Claude Code te dice que un paso "ya está hecho" o que no aplica, confírmalo y pasa al siguiente — no fuerces un paso innecesario.

---

# FASE A — HOTFIXES DE SEGURIDAD (hacer HOY, sin excepción)

Hoy mismo hay 3 formas de entrar a cuentas ajenas y leer historiales médicos en tu app en producción. Estos 7 pasos las cierran. Sube (`git push`) y espera el redeploy de Railway después de **cada uno** — no acumules varios pasos sin desplegar.

## Paso 01 — Cerrar recuperación insegura y registro público
**Modelo: Opus** | Sin Plan Mode | ~15 min

```
Lee BLUEPRINT.md y ejecuta el Paso 01 de la sección 09 (ORDEN DE CONSTRUCCIÓN) completo:
1. Haz exactamente lo que dice "Do".
2. Corre los comandos de "Verify" — todos deben pasar.
3. Si todo pasa, ejecuta el "Checkpoint" (commit + tag).
4. Explícame en español simple qué cambiaste, por qué, y qué debo probar yo mismo.
```

**Tu verificación:** pide "olvidé mi contraseña" con cualquier correo (F12 → pestaña Network) — el mensaje debe ser genérico y **no debe aparecer ningún token** en la respuesta. Los flujos viejos de registro público y "verificar identidad" ya no deben responder.

## Paso 02 — Eliminar la puerta trasera de Airtable
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 02 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué cambiaste.
```

**Tu verificación:** intenta iniciar sesión con un correo que sabes que NO existe en tu base — debe fallar simple, sin crear ninguna cuenta nueva.

## Paso 03 — Sacar `.env.production` del repo y rotar credenciales
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 03 de la sección 09. Recuerda que NUNCA debes tocar ni leer archivos .env — tu parte es sacar .env.production del control de versiones (git rm --cached) y darme, paso a paso, las instrucciones exactas para que YO rote las credenciales en MongoDB Atlas y Railway. No inventes valores — dime exactamente qué campo cambiar y dónde.
```

**🔧 Esta sesión requiere que TÚ hagas cambios manuales.** Claude te va a guiar paso a paso, pero en resumen:
- MongoDB Atlas → Database Access → cambiar la contraseña del usuario de la base de datos → actualizar `MONGODB_URI` en Railway.
- Generar un `JWT_SECRET` nuevo (Claude te da el comando exacto) → pegarlo en Railway. Esto cierra todas las sesiones activas — es normal y esperado.
- Revisar la contraseña SMTP y la API key de Airtable si siguen en uso.

**Tu verificación:** tras el redeploy, entra a la app en incógnito y confirma que el login sigue funcionando con las credenciales nuevas.

## Paso 04 — Middleware de pertenencia y cierre de IDORs
**Modelo: Opus** | Sin Plan Mode | ⚠️ Sesión importante — toca muchos endpoints

```
Lee BLUEPRINT.md y ejecuta el Paso 04 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué cambiaste y dame 2-3 ejemplos concretos de qué quedó protegido.
```

**Tu verificación:** con dos pacientes de prueba, logueado como el paciente A intenta ver la ficha del paciente B (cambiando el ID en la URL de la app) — debe fallar. Logueado como un profesional de prueba, revisa que su lista de pacientes muestre solo los suyos, no todos.

## Paso 05 — Anti-escalada de roles y política de contraseñas
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 05 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué cambiaste.
```

**Tu verificación:** crea un paciente de prueba desde una cuenta de profesional — confirma con Claude que no hay ninguna forma de que ese paciente termine con rol admin. Intenta definir una contraseña de 5 caracteres en cualquier formulario — debe rechazarla.

## Paso 06 — Hardening del servidor (helmet, rate limiting, sanitización, validación)
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 06 de la sección 09 completo: Do → Verify → Checkpoint. Antes de agregar cada dependencia nueva, confírmame cuáles son (ya están justificadas en BLUEPRINT.md §11, pero quiero que me las recuerdes). Explícame en español simple qué cambiaste.
```

**Tu verificación:** intenta iniciar sesión 6 veces seguidas con una contraseña incorrecta — al sexto intento la app debe bloquearte por un rato con un mensaje de "demasiados intentos".

## Paso 07 — Cuarentena de Google Calendar, limpieza de scripts y bugs 500
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 07 de la sección 09 completo: Do → Verify → Checkpoint. Al final corre npm test en /backend y confírmame que todo pasa en verde. Explícame en español simple qué cambiaste.
```

**Tu verificación:** la sección de Google Calendar debe quedar desactivada sin romper nada más de la app. Pide a Claude el resultado de `npm test` — debe estar todo en verde.

> 🚦 **Fin de Fase A.** Sube los cambios, espera el redeploy de Railway, y prueba el flujo de login completo en incógnito antes de seguir a la Fase B.

---

# FASE B — AUTENTICACIÓN DEFINITIVA

## Paso 08 — Refresh tokens: modelo y endpoints
**Modelo: Opus** | **Plan Mode (Shift+Tab)** | ⚠️ La sesión más importante de esta fase

```
Lee BLUEPRINT.md y ejecuta el Paso 08 de la sección 09. Primero explícame el diseño de los refresh tokens (rotación, revocación, qué pasa si alguien reusa un token robado) con un ejemplo concreto ANTES de implementar. Yo lo apruebo y luego implementas: Do → Verify → Checkpoint.
```

**🔧 Después de este paso:** agrega en Railway la variable `JWT_EXPIRE=1h` (Claude te confirma el nombre exacto si cambia algo).

**Tu verificación:** inicia sesión y usa la app un rato largo — no debería pedirte volver a loguearte a cada momento. Pide a Claude que te muestre el resultado de su prueba de "reuso de token" (debe rechazarlo).

## Paso 09 — Dominio `api.primefh.cl` + CORS definitivo
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 09 de la sección 09. Guíame paso a paso para crear el dominio api.primefh.cl en Railway y el registro DNS en Hostinger — dime exactamente qué copiar y dónde pegarlo. Luego implementa la parte de código (CORS, variables): Do → Verify → Checkpoint.
```

**🔧 Esta sesión requiere que TÚ hagas cambios manuales:**
- Railway → tu servicio backend → Settings → Domains → agregar `api.primefh.cl`.
- Hostinger → DNS de primefh.cl → crear el registro CNAME que Railway te indique.
- Esperar a que aparezca el candado (HTTPS válido) — puede tardar unos minutos.
- Actualizar `VITE_API_URL` (build del frontend) y `FRONTEND_URL` (Railway) según te indique Claude.

**Tu verificación:** abre `https://api.primefh.cl` en el navegador — debe responder sin error de certificado.

## Paso 10 — Frontend: token en memoria, fin del PHI en localStorage
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 10 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué cambiaste.
```

**Tu verificación:** inicia sesión, abre las herramientas del navegador (F12 → Application → Local Storage) y confirma que **no** aparecen tu token ni tus datos ahí. Recarga la página — debes seguir logueado igual.

## Paso 11 — Resend: servicio de email con dominio verificado
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 11 de la sección 09. Primero dime exactamente qué registros DNS debo agregar en Hostinger para verificar primefh.cl en Resend. Cuando confirme que ya los agregué y verifiqué el dominio, implementa el servicio de email: Do → Verify → Checkpoint. Al final, envíame un email de prueba a mariomartinezplm@gmail.com y confírmame que llegó.
```

**🔧 Antes de esta sesión:** crea tu cuenta gratis en resend.com, agrega el dominio `primefh.cl`. Claude te dirá exactamente qué registros DNS copiar al panel de Hostinger. Al verificar el dominio, crea la API key y pégala en Railway como `RESEND_API_KEY`.

**Tu verificación:** el email de prueba debe llegar a tu bandeja de entrada (no a spam) y verse con la marca Prime F&H.

## Paso 12 — Onboarding por invitación (backend)
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 12 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple el flujo completo de invitación.
```

**Tu verificación:** crea un paciente de prueba desde el panel de profesional — no debe poder loguearse todavía (no tiene contraseña). Pide a Claude que confirme que el link de invitación deja de funcionar después de usarse una vez.

## Paso 13 — Onboarding y reset por email (frontend)
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 13 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué pantallas creaste.
```

**Tu verificación:** usa el link de invitación del paso anterior desde tu celular — elige una contraseña y confirma que entras directo a tu dashboard. Prueba también "olvidé mi contraseña" de principio a fin con tu propio correo real.

## Paso 14 — Limpieza de rutas y guards por rol (frontend)
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 14 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué eliminaste y qué rutas quedaron protegidas.
```

**Tu verificación:** intenta entrar a `/staff-dashboard` sin haber iniciado sesión — debe dar la página de "no encontrado". Logueado como profesional, intenta entrar a una pantalla de paciente (ej. reservar cita) — debe redirigirte a tu panel.

> 🚦 **Fin de Fase B.** El sistema de acceso queda terminado y seguro. Prueba el flujo completo en tu celular: invitación → elegir contraseña → login → logout → volver a entrar.

---

# FASE C — PLANES Y AGENDA CONSOLIDADOS

## Paso 15 — Motor de descuento de sesiones
**Modelo: Opus** | **Plan Mode (Shift+Tab)** | ⚠️ Sesión crítica para el negocio

```
Lee BLUEPRINT.md y ejecuta el Paso 15 de la sección 09. Primero explícame el diseño con un ejemplo numérico concreto (paciente con plan de 10 sesiones, agenda, cancela, no-show) ANTES de implementar. Yo lo apruebo y luego implementas: Do → Verify → Checkpoint.
```

**Tu verificación:** con un paciente de prueba, agenda una cita y confirma que el contador de sesiones baja en 1 de inmediato. Cancélala con más de 4 horas de anticipación — el contador debe volver a subir. Márcala como no-show en otra cita — no debe devolver la sesión.

## Paso 16 — Migrar y retirar el modelo `Plan` legacy
**Modelo: Opus** | **Plan Mode (Shift+Tab)**

```
Lee BLUEPRINT.md y ejecuta el Paso 16 de la sección 09. Corre primero el script de migración en modo --dry-run y muéstrame el reporte completo. Yo lo reviso y te confirmo antes de que corras la migración real. Después: Do → Verify → Checkpoint.
```

**Tu verificación:** compara la lista de planes activos en el panel admin antes y después de migrar — la cantidad de pacientes con plan vigente debe ser la misma (nadie debe "perder" su plan). No apruebes la migración real sin haber revisado el reporte del dry-run tú mismo.

## Paso 17 — Reglas de agenda al 100%: ventana 4h, cron de expiración, recurrente completa
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 17 de la sección 09 completo: Do → Verify → Checkpoint. Dame también las instrucciones exactas para crear el Cron Job en Railway que expira los planes vencidos cada madrugada.
```

**🔧 Después de esta sesión:** en Railway → Settings → Cron, crea el job que Claude te indique (ejecuta `npm run expire-plans` de madrugada, hora de Chile).

**Tu verificación:** intenta agendar una hora que empiece en menos de 4 horas — debe rechazarla con un mensaje claro. Intenta a más de 4 horas — debe dejarte si hay cupo y saldo.

## Paso 18 — Fin de los precios en la app y consolidación de UI de planes
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 18 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué eliminaste.
```

**Tu verificación:** revisa la app completa como paciente (incluida la landing) — no debe aparecer ningún precio en ninguna pantalla logueada. El botón de WhatsApp de renovación debe seguir funcionando.

> 🚦 **Fin de Fase C.** Planes y agenda funcionan según las reglas de negocio reales. Buen momento para una prueba completa con 2-3 pacientes de prueba: registrar pago → agendar varias veces → cancelar → dejar vencer el plan.

---

# FASE D — FEATURES FALTANTES

## Paso 19 — Notificaciones (backend)
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 19 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué eventos quedaron conectados y a quién notifican.
```

**Tu verificación:** registra una medición como paciente de prueba — pide a Claude cómo confirmar que se creó la notificación para el profesional asignado (por ejemplo, revisando el endpoint) sin esperar a que exista la campanita todavía.

## Paso 20 — Campanita (frontend)
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 20 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple cómo se ve y funciona.
```

**Tu verificación:** repite la acción del paso anterior (registra una medición como paciente) y entra como el profesional asignado — debes ver la campanita con el número en rojo dentro de 60 segundos, y poder marcarla como leída.

## Paso 21 — Archivos médicos en R2 (backend)
**Modelo: Opus** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 21 de la sección 09. Primero dime exactamente qué crear en Cloudflare (bucket, permisos del API token) y qué 4 variables pegar en Railway. Cuando confirme que ya las configuré, implementa: Do → Verify → Checkpoint.
```

**🔧 Antes de esta sesión:** crea tu cuenta en Cloudflare, activa R2, crea un bucket privado, y genera un API token con los permisos que Claude te indique.

**Tu verificación:** pide a Claude que suba un archivo de prueba y confírmalo tú mismo en el panel de Cloudflare (el archivo debe estar ahí). Confirma que la URL del archivo NO es accesible directamente sin pasar por tu backend.

## Paso 22 — Archivos médicos (UI)
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 22 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué pantallas creaste.
```

**Tu verificación:** como paciente de prueba, sube un PDF cualquiera desde tu celular y confirma que tu profesional lo ve en tu ficha. Bórralo y confirma que desaparece para ambos.

## Paso 23 — Wellness check-in (modelo + paciente)
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 23 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple cómo funciona la alerta de promedio bajo.
```

**Tu verificación:** responde el check-in del día como paciente de prueba. Intenta responderlo dos veces el mismo día — la segunda vez debe mostrarte tus respuestas en vez de un formulario nuevo. Responde con valores bajos (1-2) y confirma que se genera la alerta al profesional.

## Paso 24 — Wellness: tendencias para staff/admin
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 24 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué ve el profesional y qué ve el admin.
```

**Tu verificación:** con unos días de check-ins de prueba cargados, entra como profesional y confirma que ves el gráfico de tendencia solo de tus pacientes asignados (no todos).

## Paso 25 — Historial clínico completo + export CSV
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 25 de la sección 09 completo: Do → Verify → Checkpoint. Explícame en español simple qué campos agregaste y qué trae el CSV.
```

**Tu verificación:** agrega altura/peso base/si fuma a un paciente de prueba y confirma que se guarda. Como admin, descarga el CSV y ábrelo en Excel o Sheets — no debe traer datos clínicos sensibles, solo lo básico (nombre, plan, sesiones).

## Paso 26 — PWA pulida y headers del frontend
**Modelo: Sonnet** | Sin Plan Mode

```
Lee BLUEPRINT.md y ejecuta el Paso 26 de la sección 09 completo: Do → Verify → Checkpoint. Recuérdame probar la instalación en incógnito o borrando caché.
```

**Tu verificación:** desinstala la app de tu celular si la tenías instalada, y vuelve a instalarla desde `app.primefh.cl` — el ícono y el color deben verse bien (teal de marca, no azul). Prueba en iPhone **y** Android — no asumas que uno implica el otro.

## Paso 27 — Salud, monitoreo y respaldos
**Modelo: Opus** | Sin Plan Mode | ⚠️ No cerrar este paso sin ver una restauración funcionando

```
Lee BLUEPRINT.md y ejecuta el Paso 27 de la sección 09. Primero explícame las dos opciones de respaldo (subir MongoDB Atlas a M2 vs. respaldo gratis programado a Cloudflare R2) con costo real y qué implica cada una — yo elijo. Después implementa la opción elegida: Do → Verify → Checkpoint. Termina mostrándome una restauración de prueba funcionando de principio a fin.
```

**🔧 Esta sesión termina con una decisión tuya** entre pagar ~US$9/mes por respaldos automáticos de Atlas, o quedarte gratis con un respaldo programado que Claude configura. Después: crea una cuenta gratis en UptimeRobot apuntando a `https://api.primefh.cl/api/health`.

**Tu verificación:** no des este paso por completado solo porque Claude dice que "debería funcionar" — pídele que te muestre la restauración real, con tus propios ojos, antes de aprobar el checkpoint.

## Paso 28 — (Opcional) Google Calendar bien hecho
**Modelo: Opus** | **Plan Mode (Shift+Tab)**

Solo hacer este paso si de verdad quieres recuperar la sincronización con Google Calendar — no es necesario para el funcionamiento normal de la app, y hoy está desactivada sin que eso rompa nada (Paso 07).

```
Lee BLUEPRINT.md y ejecuta el Paso 28 de la sección 09. Primero explícame el diseño (cómo se guardan los tokens cifrados, cómo se evita el CSRF del OAuth) ANTES de implementar. Yo lo apruebo y luego implementas: Do → Verify → Checkpoint.
```

**Tu verificación:** conecta tu calendario de Google desde tu cuenta de profesional y confirma que una cita nueva aparece ahí con la fecha y hora correctas.

---

# ✅ CHECKLIST FINAL — antes de pacientes reales

Ver `BLUEPRINT.md` §20 (Puertas de aceptación) para la lista completa y el smoke test de seguridad ejecutable. En resumen, antes de onboardear al primer paciente real:

1. Los 28 pasos de arriba completados (o al menos toda la Fase A + B — seguridad y acceso).
2. Flujo completo probado en iPhone y Android reales: invitación → contraseña → agendar → cancelar → evolución → wellness.
3. Backups activados y **una restauración probada** con éxito.
4. Usuarios y datos de prueba eliminados de producción.
5. Variables de entorno de Railway verificadas carácter por carácter.

---

# PROTOCOLO DE CADA SESIÓN (recordatorio)

1. `/clear`
2. `/model` → el que indica el paso
3. Plan Mode (Shift+Tab) si el paso lo dice
4. Pegar el prompt
5. Leer la explicación; si no la entiendes, pedir ejemplo
6. Hacer **tu verificación** (la de cada paso, arriba) — en navegador y celular, incógnito si se tocó el service worker
7. Confirmar que el commit y el tag quedaron hechos (el Checkpoint del paso ya lo hace)
8. Verificar el deploy de Railway (backend) o subir el build a Hostinger (frontend), según lo que haya tocado el paso
9. Pedir: *"actualiza STATUS.md marcando el Paso NN como completado"*
