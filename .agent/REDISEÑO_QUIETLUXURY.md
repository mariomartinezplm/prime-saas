# Plan de Rediseño "Quiet Luxury" - PrimeFH.cl

## 🎯 Objetivo
Transformar www.primefh.cl de un sitio informativo a una plataforma de salud de élite con estética "Quiet Luxury", funcionalidades avanzadas y MongoDB como base de datos.

---

## 📋 FASE 1: VISUAL & UX (Quiet Luxury)

### 1.1 Tipografía Premium
**Objetivo**: Implementar jerarquía visual con tipografías elegantes

- [ ] **Títulos (Serif)**: Integrar `Playfair Display` o `Cormorant Garamond`
  - Aplicar a: H1, H2 principales
  - Peso: 400-600 (regular a semi-bold)
  
- [ ] **Cuerpo (Sans-Serif)**: Mantener/optimizar `Inter` o cambiar a `Outfit`
  - Aplicar a: párrafos, descripciones, navegación
  - Peso: 300-500 (light a medium)

**Archivos a modificar**:
- `index.html` (Google Fonts)
- `src/index.css` (variables de tipografía)
- `tailwind.config.ts` (font-family custom)

---

### 1.2 Rediseño del Hero
**Objetivo**: Crear impacto visual con profesionalismo médico

**Elementos clave**:
- [ ] Header minimalista con fondo semi-transparente blur
- [ ] Título Hero con tipografía serif grande (texto: "Recupera tu mejor versión")
- [ ] Subtítulo refinado que mencione Puerto Montt
- [ ] CTA principal: "Agendar Evaluación Inicial" (botón premium)
- [ ] CTA secundario: "Conocer el Método" (outline)
- [ ] Imagen de alta calidad (deportista elegante, gym premium)
- [ ] Badge de confianza: "Más de 500 pacientes transformados"

**Colores Hero**:
- Fondo: Gradiente oscuro sutil con overlay
- Texto principal: Blanco/cream (#FFF8E4)
- Accent: Mantener turquesa (#5AB2B6) para CTAs

**Archivo**: `src/components/Hero.tsx`

---

### 1.3 Espaciado & Jerarquía
**Objetivo**: Más "aire" entre secciones para transmitir calma

**Cambios**:
- [ ] Aumentar padding vertical de secciones: `py-20` → `py-24 lg:py-32`
- [ ] Aumentar spacing entre elementos: `space-y-6` → `space-y-8 lg:space-y-12`
- [ ] Márgenes entre secciones: agregar `my-16 lg:my-24`
- [ ] Container más estrecho para texto: `max-w-2xl` → `max-w-xl`

**Archivos**: Todos los componentes principales

---

### 1.4 Interactividad Premium
**Objetivo**: Transiciones suaves y efectos hover refinados

- [ ] **Scroll suave**: Implementar `framer-motion` scroll-triggered animations
- [ ] **Botones**: 
  - Hover: Scale 1.02, sombra elevada
  - Transición: 300ms ease-out
  - Ripple effect en click
  
- [ ] **Cards**: 
  - Hover: Elevación sutil, borde glow
  - Transform: translateY(-4px)
  
- [ ] **Imágenes**: 
  - Parallax sutil en scroll
  - Zoom-in suave en hover

**Herramientas**: `framer-motion`, Tailwind transitions

---

## 📋 FASE 2: CAPTACIÓN & FIDELIZACIÓN

### 2.1 Componente de Reserva de Evaluación
**Objetivo**: Convertir visitantes en pacientes

**Ubicación**: Hero + sección dedicada

**Elementos**:
- [ ] Modal/Slide-in elegante
- [ ] Formulario en 3 pasos:
  1. Datos personales (nombre, email, teléfono)
  2. Objetivo principal (dropdown: pérdida peso, rehabilitación, rendimiento)
  3. Fecha/hora preferida (calendario)
  
- [ ] Validación en tiempo real
- [ ] Confirmación por email automático
- [ ] Estado: "Pendiente de confirmación por el equipo"

**Backend**:
- Endpoint: `POST /api/evaluations`
- Colección MongoDB: `evaluations`

**Archivo nuevo**: `src/components/EvaluationBooking.tsx`

---

### 2.2 Portal de Pacientes (Reemplazo "Reservar mi sesión")

#### 2.2.1 Landing del Portal
**Ubicación**: Header superior derecha → "Mi Portal"

**Elementos**:
- [ ] Login/Registro elegante
- [ ] Autenticación: JWT + Context API
- [ ] Recuperación de contraseña
- [ ] Bienvenida personalizada: "Hola, [Nombre]"

**Archivo**: `src/pages/patient/Dashboard.tsx`

---

#### 2.2.2 Vista "Mi Progreso"
**Objetivo**: Mostrar evolución clínica y física

**Elementos**:
- [ ] **Gráficos de Evolución**:
  - Peso corporal (línea temporal)
  - Medidas corporales (radar chart)
  - Fuerza (barras comparativas)
  - Rango de movimiento (si aplica)
  
- [ ] **Timeline de Hitos**:
  - Evaluaciones realizadas
  - Logros desbloqueados
  - Fotos de progreso (antes/después con slider)
  
- [ ] **Próximos Objetivos**:
  - Metas semanales
  - Sugerencias del kinesiólogo

**Librerías**:
- `recharts` para gráficos elegantes
- `framer-motion` para animaciones

**Backend**:
- Endpoint: `GET /api/patients/:id/progress`
- Colección: `progress_records`

**Archivo nuevo**: `src/pages/patient/Progress.tsx`

---

#### 2.2.3 Sistema de Reserva de Horas
**Objetivo**: Calendario interactivo profesional

**Elementos**:
- [ ] Calendario mensual con slots disponibles
- [ ] Vista semanal para mobile
- [ ] Filtro por profesional
- [ ] Filtro por tipo de sesión (entrenamiento, kine, nutrición)
- [ ] Indicadores de disponibilidad (verde/rojo)
- [ ] Confirmación inmediata
- [ ] Opción de cancelar (con política de 24hrs)
- [ ] Notificaciones: Email + WhatsApp

**Lógica Backend**:
- Endpoint: `GET /api/availability/:professionalId/:date`
- Endpoint: `POST /api/appointments`
- Endpoint: `DELETE /api/appointments/:id`
- Colecciones: 
  - `availability_slots`
  - `appointments`
  - `professionals`

**Archivo**: Ya existe `src/pages/patient/BookAppointment.tsx` (mejorar)

---

## 📋 FASE 3: STACK TÉCNICO & MONGODB

### 3.1 Estructura de Base de Datos

#### Colecciones MongoDB:

```javascript
// 🔹 users
{
  _id: ObjectId,
  email: String,
  password: String (hashed),
  role: String, // 'patient', 'professional', 'admin'
  firstName: String,
  lastName: String,
  rut: String,
  phone: String,
  dateOfBirth: Date,
  createdAt: Date,
  activePlan: ObjectId // referencia a 'plans'
}

// 🔹 plans
{
  _id: ObjectId,
  patient: ObjectId, // referencia a 'users'
  type: String, // 'mensual', 'trimestral'
  sessionsTotal: Number,
  sessionsUsed: Number,
  startDate: Date,
  endDate: Date,
  status: String, // 'active', 'expired', 'cancelled'
}

// 🔹 appointments
{
  _id: ObjectId,
  patient: ObjectId,
  professional: ObjectId,
  date: Date,
  startTime: String,
  endTime: String,
  type: String, // 'entrenamiento', 'kinesiologia', 'nutricion'
  status: String, // 'confirmed', 'cancelled', 'completed'
  notes: String,
  createdAt: Date
}

// 🔹 progress_records
{
  _id: ObjectId,
  patient: ObjectId,
  recordDate: Date,
  metrics: {
    weight: Number,
    bodyFat: Number,
    muscleMass: Number,
    measurements: {
      chest: Number,
      waist: Number,
      hips: Number,
      arm: Number,
      thigh: Number
    }
  },
  strength: {
    benchPress: Number,
    squat: Number,
    deadlift: Number,
    // etc
  },
  photos: [String], // URLs de fotos
  notes: String,
  professional: ObjectId
}

// 🔹 evaluations (nuevos prospectos)
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  objective: String,
  preferredDate: Date,
  preferredTime: String,
  status: String, // 'pending', 'confirmed', 'completed', 'cancelled'
  createdAt: Date
}

// 🔹 availability_slots
{
  _id: ObjectId,
  professional: ObjectId,
  dayOfWeek: Number, // 0-6
  startTime: String,
  endTime: String,
  slotDuration: Number, // minutos
  isActive: Boolean
}
```

---

### 3.2 Arquitectura Backend

**Estructura de carpetas**:
```
backend/
├── src/
│   ├── config/
│   │   └── database.ts        # Conexión MongoDB
│   ├── models/
│   │   ├── User.ts
│   │   ├── Plan.ts
│   │   ├── Appointment.ts
│   │   ├── ProgressRecord.ts
│   │   ├── Evaluation.ts
│   │   └── AvailabilitySlot.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── patients.ts
│   │   ├── appointments.ts
│   │   ├── progress.ts
│   │   └── evaluations.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── validation.ts
│   └── server.ts
```

**Stack actual vs nuevo**:
- ✅ Mantener: Express.js, TypeScript
- ✅ Mantener: JWT para auth
- 🆕 Migrar de JSON a MongoDB Atlas
- 🆕 Mongoose para ODM
- 🆕 Nodemailer para emails
- 🆕 Multer para upload de fotos de progreso

---

### 3.3 Optimización Frontend

#### 3.3.1 Imágenes
- [ ] Implementar Next.js Image o `react-lazy-load-image-component`
- [ ] Convertir imágenes a WebP
- [ ] Lazy loading para todas las imágenes below the fold
- [ ] Placeholder blur mientras carga

#### 3.3.2 Responsividad Dashboard
- [ ] Mobile-first design
- [ ] Drawer para navegación en móvil
- [ ] Gráficos adaptativos (vertical en mobile)
- [ ] Tabs en lugar de sidebar en pantallas pequeñas

---

## 📋 FASE 4: SEO & PERFORMANCE

### 4.1 SEO
- [ ] Meta tags optimizados por página
- [ ] Schema.org markup para médicos/servicios
- [ ] Sitemap.xml generado
- [ ] Canonical URLs
- [ ] Open Graph tags para redes sociales
- [ ] Robots.txt optimizado

### 4.2 Performance
- [ ] Code splitting por ruta
- [ ] Tree shaking
- [ ] Lazy load de componentes pesados
- [ ] Service Worker para caching
- [ ] Lighthouse score > 90

---

## 🗓️ CRONOGRAMA SUGERIDO

**Semana 1-2**: FASE 1 - Visual & UX
- Tipografías
- Rediseño Hero
- Espaciado
- Interactividad

**Semana 3-4**: FASE 2.1 - Captación
- Componente de Evaluación
- Landing del Portal

**Semana 5-6**: FASE 2.2 - Portal de Pacientes
- Vista "Mi Progreso"
- Mejora Sistema de Reservas

**Semana 7-8**: FASE 3 - Backend & MongoDB
- Migración de datos
- Endpoints nuevos
- Testing

**Semana 9-10**: FASE 4 - Optimización
- SEO
- Performance
- Testing QA final
- Deploy

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

1. **Aprobar este plan** o sugerir cambios
2. **Comenzar FASE 1.1**: Tipografías premium
3. **Crear mockup del Hero** para aprobación
4. **Setup MongoDB Atlas** (si aún no tienes cuenta)

---

**¿Quieres que comencemos con la FASE 1 (Tipografías + Hero) ahora mismo?**
