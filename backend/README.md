# Backend - Prime F&H Sistema de Gestión de Pacientes

Backend API REST desarrollado con Node.js, Express y MongoDB para la gestión de pacientes, citas, mediciones, ejercicios y evaluaciones del dolor (EVA).

## 🚀 Tecnologías

- **Node.js** - Entorno de ejecución
- **Express** - Framework web
- **MongoDB Atlas** - Base de datos NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticación basada en tokens
- **bcryptjs** - Encriptación de contraseñas
- **date-fns** - Manipulación de fechas

## 📋 Prerequisitos

- Node.js (v16 o superior)
- npm o yarn
- Cuenta en MongoDB Atlas

## 🔧 Instalación

1. **Instalar dependencias:**
   ```bash
   cd backend
   npm install
   ```

2. **Configurar variables de entorno:**

   Copia el archivo `.env.example` y renómbralo a `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Configurar MongoDB Atlas:**

   a. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

   b. Crea una cuenta gratuita (si no tienes una)

   c. Crea un nuevo cluster:
      - Selecciona el tier gratuito (M0)
      - Elige la región más cercana a Chile (ej: São Paulo, Brazil)
      - Dale un nombre a tu cluster (ej: "prime-fh-cluster")

   d. Configura el acceso:
      - En "Database Access", crea un usuario con contraseña
      - En "Network Access", agrega tu IP o permite acceso desde cualquier lugar (0.0.0.0/0) para desarrollo

   e. Obtén la cadena de conexión:
      - Click en "Connect" en tu cluster
      - Selecciona "Connect your application"
      - Copia la cadena de conexión
      - Reemplaza `<username>`, `<password>` y `<dbname>` con tus credenciales

4. **Actualizar el archivo .env:**
   ```env
   MONGODB_URI=mongodb+srv://tuusuario:tupassword@cluster.xxxxx.mongodb.net/prime-fh?retryWrites=true&w=majority
   JWT_SECRET=tu_clave_secreta_muy_segura_aqui_cambiar_en_produccion
   JWT_EXPIRE=7d
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

   **IMPORTANTE:**
   - Cambia `JWT_SECRET` por una clave aleatoria y segura
   - Puedes generar una con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

5. **Poblar la base de datos con datos iniciales:**
   ```bash
   npm run seed
   ```

   Esto creará:
   - Usuario administrador: Mario Martínez
   - 2 pacientes de ejemplo

## 🏃‍♂️ Ejecución

### Modo desarrollo (con auto-reload):
```bash
npm run dev
```

### Modo producción:
```bash
npm start
```

El servidor estará disponible en `http://localhost:5000`

## 📚 Endpoints de la API

### Autenticación (`/api/auth`)
- `POST /register` - Registrar nuevo usuario
- `POST /login` - Iniciar sesión
- `GET /me` - Obtener usuario actual (protegido)
- `PUT /profile` - Actualizar perfil (protegido)
- `PUT /change-password` - Cambiar contraseña (protegido)
- `POST /forgot-password` - Solicitar reseteo de contraseña
- `PUT /reset-password/:token` - Resetear contraseña

### Usuarios (`/api/users`) - Solo Admin
- `GET /` - Listar todos los usuarios
- `POST /` - Crear nuevo usuario
- `GET /:id` - Obtener usuario por ID
- `PUT /:id` - Actualizar usuario
- `DELETE /:id` - Eliminar usuario
- `GET /:id/profile` - Obtener perfil completo del paciente
- `GET /stats/dashboard` - Estadísticas del dashboard

### Citas (`/api/appointments`)
- `GET /` - Listar citas (admin: todas, paciente: propias)
- `POST /` - Crear nueva cita
- `GET /:id` - Obtener cita por ID
- `PUT /:id` - Actualizar cita (solo admin)
- `DELETE /:id` - Eliminar cita (solo admin)
- `PUT /:id/cancel` - Cancelar cita
- `GET /availability/:professionalId/:date` - Ver disponibilidad

### Mediciones (`/api/measurements`)
- `POST /` - Crear medición (solo admin)
- `GET /patient/:patientId` - Obtener mediciones de un paciente
- `GET /:id` - Obtener medición por ID
- `PUT /:id` - Actualizar medición (solo admin)
- `DELETE /:id` - Eliminar medición (solo admin)
- `GET /compare/:id1/:id2` - Comparar dos mediciones
- `GET /progress/:patientId/:perimeter` - Progreso de un perímetro

### Ejercicios (`/api/exercises`)
- `POST /` - Crear registro de ejercicio (solo admin)
- `GET /patient/:patientId` - Obtener ejercicios de un paciente
- `GET /:id` - Obtener registro por ID
- `PUT /:id` - Actualizar registro (solo admin)
- `DELETE /:id` - Eliminar registro (solo admin)
- `GET /progress/:patientId/:exerciseName` - Progreso de un ejercicio
- `GET /pr/:patientId/:exerciseName` - Récord personal
- `GET /list/:patientId` - Lista de ejercicios únicos
- `GET /stats/:patientId` - Estadísticas por categoría

### EVA - Escala del Dolor (`/api/eva`)
- `POST /` - Crear registro EVA (solo admin)
- `GET /patient/:patientId` - Obtener registros de un paciente
- `GET /:id` - Obtener registro por ID
- `PUT /:id` - Actualizar registro (solo admin)
- `DELETE /:id` - Eliminar registro (solo admin)
- `GET /evolution/:patientId/:bodyArea` - Evolución del dolor
- `GET /affected-areas/:patientId` - Áreas afectadas
- `GET /summary/:patientId` - Resumen del dolor

## 🔐 Autenticación

La API utiliza JWT (JSON Web Tokens) para la autenticación. Para acceder a las rutas protegidas, incluye el token en el header:

```
Authorization: Bearer <tu_token_aqui>
```

## 👤 Credenciales por Defecto

Después de ejecutar `npm run seed`:

**Administrador:**
- Email: `mario@primefh.cl`
- Password: `Prime2024!`

**Paciente 1:**
- Email: `juan.perez@example.com`
- Password: `Patient123!`

**Paciente 2:**
- Email: `ana.gonzalez@example.com`
- Password: `Patient123!`

⚠️ **IMPORTANTE:** Cambia estas contraseñas en producción.

## 📁 Estructura del Proyecto

```
backend/
├── config/
│   └── database.js          # Configuración de MongoDB
├── controllers/
│   ├── authController.js    # Lógica de autenticación
│   ├── userController.js    # Gestión de usuarios
│   ├── appointmentController.js
│   ├── measurementController.js
│   ├── exerciseController.js
│   └── evaController.js
├── middleware/
│   ├── auth.js              # Middleware de autenticación
│   └── error.js             # Manejo de errores
├── models/
│   ├── User.js              # Modelo de usuario
│   ├── Appointment.js       # Modelo de citas
│   ├── Measurement.js       # Modelo de mediciones
│   ├── Exercise.js          # Modelo de ejercicios
│   └── EVA.js               # Modelo de escala EVA
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── appointmentRoutes.js
│   ├── measurementRoutes.js
│   ├── exerciseRoutes.js
│   └── evaRoutes.js
├── utils/
│   └── seed.js              # Script para poblar BD
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js                # Punto de entrada
```

## 🧪 Testing

Para probar la API, puedes usar:
- [Postman](https://www.postman.com/)
- [Insomnia](https://insomnia.rest/)
- [Thunder Client](https://www.thunderclient.com/) (extensión de VS Code)

## 🛠️ Desarrollo

### Scripts disponibles:
- `npm start` - Inicia el servidor en modo producción
- `npm run dev` - Inicia con nodemon para desarrollo
- `npm run seed` - Pobla la base de datos con datos iniciales

## 📝 Notas Importantes

1. **Horarios de disponibilidad:** El sistema está configurado con los horarios de Mario Martínez (L-V: 7-10am, 12-2pm, 4-8pm)

2. **Reglas de agendamiento:**
   - Pacientes: deben agendar antes de las 21:00 hrs del día anterior
   - Cancelaciones: mínimo 4 horas de anticipación

3. **Cálculos automáticos:**
   - IMC calculado automáticamente con peso y altura
   - 1RM (One Rep Max) calculado con fórmula de Epley

4. **Seguridad:**
   - Contraseñas encriptadas con bcrypt
   - Tokens JWT con expiración configurable
   - Middleware de autorización por roles

## 🚀 Despliegue

Para producción, considera usar:
- **Backend:** Railway, Render, Heroku, DigitalOcean
- **Base de datos:** MongoDB Atlas (ya configurado)

Variables de entorno importantes para producción:
```env
NODE_ENV=production
MONGODB_URI=<tu_uri_de_produccion>
JWT_SECRET=<clave_segura_generada_aleatoriamente>
FRONTEND_URL=<url_de_tu_frontend_en_produccion>
```

## 📞 Soporte

Para preguntas o problemas, contacta a Mario Martínez - Prime F&H Puerto Montt
