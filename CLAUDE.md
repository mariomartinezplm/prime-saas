# CLAUDE.md — Prime F&H

## QUÉ ES ESTE PROYECTO

Prime F&H es un centro de kinesiología y entrenamiento en Puerto Montt, Chile. Esta app es su sistema de gestión de pacientes (agenda, planes, evolución clínica). El dueño, Mario, es kinesiólogo y **NO es programador** — construye y mantiene todo esto a través de Claude Code. Por eso:

- Explica los cambios importantes en español simple antes de implementarlos.
- Nunca asumas conocimiento técnico: si algo requiere una decisión, explica las opciones con pros y contras.
- **Una tarea a la vez.** No hagas refactors ni "mejoras" no solicitadas.

## STACK REAL (lo que hay en producción hoy)

- **Frontend:** Vite + React (SPA, no Next.js) + TypeScript + Tailwind + shadcn/ui. Router: React Router v6. Es también una **PWA** (vite-plugin-pwa, service worker, ya funcionando).
- **Backend:** Node.js + Express (ES Modules).
- **Base de datos:** MongoDB Atlas vía Mongoose (no Postgres/Supabase).
- **Auth:** JWT. Middleware en `backend/middleware/auth.js`: `protect` (verifica token), `authorize` (chequea rol), `authorizeOwnerOrAdmin` (dueño del recurso o admin).
- **Roles:** `admin`, `professional`, `patient` (así están en el enum de `User.js` — no "staff"/"client").
- **Deploy:**
  - Backend en **Railway** (`prime-saas-production.up.railway.app`), auto-deploy al hacer push a `main`.
  - Frontend compilado (`npm run build`) y subido manualmente al hosting de **Hostinger**, sirviendo en `https://app.primefh.cl`.
  - Base de datos: MongoDB Atlas (ya configurada).
- **Integraciones ya existentes:** Google Calendar (OAuth, sincronizar citas — `backend/routes/googleCalendarRoutes.js`).
- **NO existe:** Next.js, Supabase, Postgres, RLS, Vercel, N8N, Capacitor. Si en algún momento se decide migrar a esa arquitectura, es una decisión grande que hay que tomar explícitamente con Mario — no asumirla.

## MODELO DE NEGOCIO OBJETIVO — REGLAS EXACTAS (a implementar de forma incremental)

Esto es el modelo de negocio **hacia el que vamos**, no necesariamente lo que ya está construido (ver `STATUS.md` para el estado real de cada regla).

### Planes y sesiones
- Planes de **Entrenamiento:** 4, 8, 12 o 16 sesiones.
- Planes de **Kinesiología:** 5, 10 o 20 sesiones.
- Ciclo de **30 días desde la fecha de pago** (no mes calendario).
- El pago lo registra **manualmente el admin** en la app. No hay pasarela de pago.
- Los **precios NO se muestran** en la app. Si el plan venció: mensaje "Contacta a Prime F&H para renovar" + botón de WhatsApp.
- Al vencer el plan (día 31 sin renovación): **se bloquea agendar** y **se bloquea que el paciente registre datos de evolución** (queda en solo lectura, puede seguir viendo su historial y gráficos).
- Sesiones no usadas al vencer el ciclo: **se pierden, no se acumulan**.
- El **profesional puede agregar sesiones extra** manualmente a sus pacientes asignados (con motivo opcional).

### Descuento de sesiones
Se descuenta 1 sesión del plan cuando:
- La cita se completa (`completed`)
- El paciente no llega (`no-show`)
- El paciente cancela con **menos de 4 horas** de anticipación

No se descuenta si cancela con 4+ horas de anticipación (la sesión vuelve al plan y el slot se libera).

### Agendamiento
- Cada paciente está **asignado a un profesional fijo** (quien lo registró). Solo ve y agenda con ese profesional.
- Sesiones duran **siempre 60 minutos**.
- Slots inician **cada 30 minutos** (10:00, 10:30, 11:00...).
- **Máximo 4 pacientes SIMULTÁNEOS** por profesional en cualquier momento. Ejemplo: 3 pacientes de 10:00-11:00 → a las 10:30 solo queda 1 cupo (porque de 10:30 a 11:00 habría 4 simultáneos). A las 11:00 se liberan los 3.
- **No se puede agendar** con menos de 4 horas de anticipación.
- **No se puede agendar** sin sesiones disponibles o con plan vencido.
- **Agenda recurrente:** el paciente puede agendar múltiples sesiones de una vez (ej: "lunes y miércoles 10:00 todo el mes"). Si un slot está lleno, se salta y se le informa cuáles no se pudieron agendar.
- Cada profesional configura su disponibilidad recurrente por día de semana + bloqueos puntuales de fechas específicas.
- El admin puede agendar y cancelar en nombre de cualquier paciente.

### Onboarding de pacientes
- El **profesional crea al paciente** desde su panel con todos sus datos (info personal + historial clínico).
- El paciente queda asignado automáticamente al profesional que lo creó.
- El sistema envía **email de bienvenida** con link para que el paciente elija su contraseña.

## PERFIL DEL PACIENTE — 5 SECCIONES

1. **Información personal:** nombre, email, teléfono, fecha de nacimiento, dirección, ciudad, plan activo, estado (activo/inactivo).
2. **Historial clínico:** género, altura, peso, lesiones, alergias, fuma (sí/no), enfermedades crónicas, medicamentos actuales, antecedentes quirúrgicos, contacto de emergencia, objetivos del tratamiento.
3. **Archivos:** subida de PDFs/imágenes (exámenes de laboratorio, resonancias, informes). Suben tanto paciente como profesional.
4. **Calendario:** agendar/cancelar según las reglas de arriba.
5. **Evolución** (dos sub-secciones):
   - **Evolución corporal:** peso corporal + perímetros en cm (bíceps, pecho, cintura, glúteos, cuádriceps), con fecha. Gráfico de línea por métrica.
   - **Ejercicios:** registros de ejercicio + peso + reps (ej: sentadilla, 100kg, 8 reps, fecha). Gráfico de progresión de peso por ejercicio, filtrable.

### Reglas de evolución
- Registran datos **tanto el profesional como el paciente**.
- Si el **paciente** registra o modifica algo → **notificación al profesional asignado** (campanita + email).
- El paciente solo puede registrar si tiene **plan activo**. Plan vencido = solo lectura.

## NOTIFICACIONES

- **In-app:** campanita con badge de no leídas. Eventos: paciente modificó evolución, plan por vencer (5 días antes), plan vencido, cita agendada/cancelada.
- **Email:** espejo de las notificaciones importantes.

## WELLNESS CHECK-IN DIARIO

- Formulario de 5 sliders 1-5: sueño, energía, estrés, dolor muscular, ánimo + notas opcionales.
- 1 check-in por paciente por día.
- Si promedio < 2.5 → alerta al profesional asignado.
- Dashboard de tendencias para el profesional (sus pacientes).

## FASE FUTURA (NO implementar hasta que Mario lo pida explícitamente)

- WhatsApp vía N8N (webhook, recordatorios, mensajes post-sesión).
- Capacitor para app nativa Android/iOS.

## SEGURIDAD — REGLAS DURAS

Prime F&H maneja **datos de salud**. Detalle completo (matriz de permisos, flujos de auth, rate limits, manejo de datos sensibles) en `BLUEPRINT.md` §08 y §14 — esto es el resumen que nunca se debe romper:

- **Toda autorización se verifica en el servidor**, en cada endpoint, antes de hacer el trabajo. Los guards de rutas del frontend son cosméticos — nunca la única protección.
- **Pertenencia siempre explícita:** un paciente accede solo a lo suyo; un profesional solo a sus pacientes asignados (`assignedProfessionalId`); el admin accede a todo. Ningún endpoint puede devolver datos de un paciente a otro usuario (ni por error de omisión).
- **Alta de pacientes SOLO por invitación:** el profesional/admin crea al paciente → email con link de un solo uso → el paciente elige su contraseña. Sin registro público, sin recuperación de cuenta basada en RUT o fecha de nacimiento (esas puertas se cerraron por vulnerables — ver `BLUEPRINT.md` Fase A).
- **Nunca exponer en una respuesta de la API:** contraseñas, tokens de reset/invitación, ni tokens de terceros (Google, etc.) de otro usuario.
- **Archivos médicos:** almacenamiento privado, nunca público — acceso solo con URLs firmadas y temporales.
- Los datos de salud son datos sensibles bajo la Ley 19.628 y la Ley 21.719 (vigente desde diciembre de 2026): minimiza qué se guarda, qué se loguea, y qué se cachea en el dispositivo del usuario.

## REGLAS DE TRABAJO PARA CLAUDE CODE

1. **NUNCA modifiques, crees ni leas archivos `.env`** ni ningún archivo con credenciales. Si falta una variable, dile a Mario cuál crear/agregar (en el repo, o en Railway si es de producción).
2. **Una tarea por sesión.** Si Mario pide algo grande, propón dividirlo.
3. **Modelo de datos primero, UI después.** Toda feature nueva parte por el modelo Mongoose y el endpoint del backend.
4. **Las validaciones de negocio (4 horas, máx. 4 simultáneos, sesiones disponibles, plan vencido) van SIEMPRE en el backend**, nunca solo en el frontend. El frontend puede mentir; el backend no.
5. **No romper lo que ya funciona.** Antes de tocar un archivo compartido, revisa qué depende de él.
6. **No agregues dependencias nuevas** sin explicar por qué y pedir confirmación.
7. **Commits descriptivos:** formato `feat(etapa-X): descripción` / `fix(etapa-X): descripción`.
8. **Si hay un error**, pide el mensaje de error exacto antes de adivinar.
9. **Español simple** para explicar decisiones. Código y nombres de variables en inglés.
10. **Nunca ejecutes `git push --force`, `rm -rf`, ni borres datos** (usuarios, planes, citas, archivos de pacientes) sin confirmación explícita.
11. **El plan de construcción vigente vive en `BLUEPRINT.md`, sección 09 (ORDEN DE CONSTRUCCIÓN).** Cada sesión ejecuta un paso, en el orden indicado — no saltarse pasos de la Fase A (seguridad) por hacer features nuevas primero.

## ESTADO DEL PROYECTO

Ver `STATUS.md` (avance sesión a sesión) y `BLUEPRINT.md` (arquitectura completa, seguridad, y los 28 pasos de construcción) en la raíz del repo. Actualiza `STATUS.md` al final de cada sesión marcando el paso completado.
