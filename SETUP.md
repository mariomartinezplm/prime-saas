# 🏥 Prime F&H - Sistema de Gestión de Pacientes

Sistema completo de gestión de pacientes para kinesiología y entrenamiento desarrollado para Mario Martínez - Prime F&H, Puerto Montt, Chile.

## 📋 Descripción del Proyecto

Aplicación web full-stack que incluye:
- ✅ **Sistema de autenticación** con JWT (Login, Registro, Recuperación de contraseña)
- ✅ **Gestión de citas** con calendario y disponibilidad en tiempo real
- ✅ **Seguimiento de progresión física** (perímetros corporales, peso, IMC)
- ✅ **Registro de ejercicios** con gráficos de evolución y récords personales
- ✅ **Módulo kinesiológico EVA** (Escala Visual Analógica del Dolor)
- ✅ **Panel administrativo** completo para Mario
- ✅ **Panel del paciente** para autogestión

## 🛠️ Stack Tecnológico

### Backend
- **Node.js** + **Express** - Servidor y API REST
- **MongoDB Atlas** - Base de datos NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticación y autorización
- **bcryptjs** - Encriptación de contraseñas
- **date-fns** - Manejo de fechas y horarios

### Frontend
- **React 18** + **TypeScript** - UI moderna y type-safe
- **Vite** - Build tool ultrarrápido
- **Tailwind CSS** - Estilos utility-first
- **shadcn/ui** - Componentes UI accesibles
- **React Router** - Navegación
- **React Query** - State management del servidor
- **Axios** - Cliente HTTP
- **Recharts** - Gráficos interactivos
- **react-big-calendar** - Calendario de citas

## 📦 Estructura del Proyecto

```
prime-convert-kit/
├── backend/                    # API Backend
│   ├── config/
│   │   └── database.js        # Configuración MongoDB
│   ├── controllers/           # Lógica de negocio
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── appointmentController.js
│   │   ├── measurementController.js
│   │   ├── exerciseController.js
│   │   └── evaController.js
│   ├── middleware/
│   │   ├── auth.js           # Autenticación JWT
│   │   └── error.js          # Manejo de errores
│   ├── models/               # Esquemas de datos
│   │   ├── User.js
│   │   ├── Appointment.js
│   │   ├── Measurement.js
│   │   ├── Exercise.js
│   │   └── EVA.js
│   ├── routes/               # Rutas de la API
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── appointmentRoutes.js
│   │   ├── measurementRoutes.js
│   │   ├── exerciseRoutes.js
│   │   └── evaRoutes.js
│   ├── utils/
│   │   └── seed.js           # Script de datos iniciales
│   ├── .env.example
│   ├── package.json
│   ├── README.md             # Documentación detallada del backend
│   └── server.js             # Punto de entrada
│
├── src/                       # Frontend React
│   ├── components/           # Componentes reutilizables
│   │   └── ui/              # Componentes shadcn/ui
│   ├── contexts/
│   │   └── AuthContext.tsx  # Contexto de autenticación
│   ├── hooks/               # Custom hooks
│   ├── lib/
│   │   └── api.ts          # Cliente Axios configurado
│   ├── pages/              # Páginas de la aplicación
│   │   ├── auth/          # Login, Register
│   │   └── dashboard/     # Dashboards admin y paciente
│   ├── services/          # Servicios API
│   │   ├── authService.ts
│   │   ├── userService.ts
│   │   ├── appointmentService.ts
│   │   ├── measurementService.ts
│   │   ├── exerciseService.ts
│   │   └── evaService.ts
│   ├── types/
│   │   └── index.ts       # Tipos TypeScript
│   └── App.tsx
│
├── .env.example
├── package.json
├── README.md
└── SETUP.md                 # Este archivo
```

## 🚀 Instalación y Configuración

### 1. Prerequisitos

- **Node.js** v16 o superior ([Descargar](https://nodejs.org/))
- **npm** o **yarn**
- Cuenta en **MongoDB Atlas** (gratuita)

### 2. Clonar y Preparar el Proyecto

```bash
# El proyecto ya está clonado en:
cd /home/user/prime-convert-kit

# Instalar dependencias del frontend
npm install

# Instalar dependencias del backend
cd backend
npm install
cd ..
```

### 3. Configurar MongoDB Atlas

1. **Crear cuenta en MongoDB Atlas:**
   - Ve a https://www.mongodb.com/cloud/atlas
   - Regístrate con tu email o cuenta de Google

2. **Crear un cluster:**
   - Selecciona el plan GRATUITO (M0)
   - Elige la región: **São Paulo** (más cercana a Chile)
   - Nombra tu cluster: `prime-fh-cluster`

3. **Configurar acceso:**
   - **Database Access**: Crea un usuario
     - Username: `primefh_admin`
     - Password: Genera una contraseña segura (¡guárdala!)
     - Roles: `Atlas admin` o `Read and write to any database`

   - **Network Access**: Agregar IP
     - Click en "Add IP Address"
     - Para desarrollo: Click en "Allow Access from Anywhere" (0.0.0.0/0)
     - Para producción: Agrega solo las IPs específicas

4. **Obtener la cadena de conexión:**
   - En tu cluster, click en "Connect"
   - Selecciona "Connect your application"
   - Copia la cadena de conexión (se ve así):
     ```
     mongodb+srv://primefh_admin:<password>@prime-fh-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```

### 4. Configurar Variables de Entorno

#### Backend (.env)

```bash
cd backend
cp .env.example .env
```

Edita `backend/.env` con tus datos:

```env
# MongoDB - Reemplaza con tu cadena de conexión
MONGODB_URI=mongodb+srv://primefh_admin:TU_PASSWORD_AQUI@prime-fh-cluster.xxxxx.mongodb.net/prime-fh?retryWrites=true&w=majority

# JWT - Genera una clave segura aleatoria
JWT_SECRET=tu_clave_secreta_muy_larga_y_segura_aqui

# Otras configuraciones
JWT_EXPIRE=7d
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Para generar una JWT_SECRET segura:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Frontend (.env)

```bash
cd ..  # Volver a la raíz
cp .env.example .env
```

Edita `.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 5. Poblar la Base de Datos

```bash
cd backend
npm run seed
```

Esto creará:
- **Usuario Admin** (Mario Martínez)
  - Email: `mario@primefh.cl`
  - Password: `Prime2024!`

- **2 Pacientes de ejemplo**
  - Email: `juan.perez@example.com` / Password: `Patient123!`
  - Email: `ana.gonzalez@example.com` / Password: `Patient123!`

⚠️ **IMPORTANTE**: Cambia estas contraseñas después del primer login.

### 6. Ejecutar la Aplicación

#### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Debería mostrar:
```
✅ MongoDB conectado: ...
🚀 Servidor corriendo en modo development
📡 Puerto: 5000
🌐 URL: http://localhost:5000
```

#### Terminal 2 - Frontend:
```bash
npm run dev
```

Debería mostrar:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### 7. Acceder a la Aplicación

Abre tu navegador en: **http://localhost:5173**

**Login con usuario administrador:**
- Email: `mario@primefh.cl`
- Password: `Prime2024!`

## 📚 Documentación de la API

La API completa está documentada en `/backend/README.md` con todos los endpoints disponibles:

- `/api/auth` - Autenticación
- `/api/users` - Gestión de usuarios
- `/api/appointments` - Citas
- `/api/measurements` - Mediciones corporales
- `/api/exercises` - Ejercicios y progresión
- `/api/eva` - Escala del dolor

Puedes probar la API visitando: http://localhost:5000

## 🎨 Estado Actual del Frontend

### ✅ Completado:
- Configuración base de React + Vite + TypeScript
- Tailwind CSS y shadcn/ui configurados
- Tipos TypeScript completos
- Cliente Axios configurado con interceptores
- Servicios API para todos los módulos
- Contexto de autenticación (AuthContext)
- Landing page existente (ya estaba en el proyecto)

### 📝 Pendiente de Implementar:

#### Componentes de Autenticación:
- `src/pages/auth/Login.tsx` - Página de login
- `src/pages/auth/Register.tsx` - Página de registro
- Componente de ProtectedRoute

#### Panel Administrativo:
- `src/pages/dashboard/AdminDashboard.tsx` - Dashboard principal de Mario
- Gestión de pacientes
- Gestión de citas con calendario
- Registro de mediciones
- Registro de ejercicios
- Registro de EVA

#### Panel del Paciente:
- `src/pages/dashboard/PatientDashboard.tsx` - Dashboard del paciente
- Vista de próximas citas
- Agendamiento de citas
- Visualización de progreso personal

#### Componentes Específicos:
- Sistema de calendario con react-big-calendar
- Gráficos de progresión con Recharts
- Silueta corporal interactiva para perímetros
- Formularios de registro (mediciones, ejercicios, EVA)

## 📖 Guía de Desarrollo para Completar el Frontend

### 1. Crear Página de Login

```tsx
// src/pages/auth/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card } from '../../components/ui/card';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Prime F&H - Login</h1>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Iniciar Sesión
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

### 2. Actualizar App.tsx

```tsx
// src/App.tsx
import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/auth/Login';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import PatientDashboard from './pages/dashboard/PatientDashboard';
// ... otros imports

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard/admin" element={<AdminDashboard />} />
          <Route path="/dashboard/patient" element={<PatientDashboard />} />
          {/* Mantener las rutas existentes de la landing page */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

### 3. Usar React Query para Datos

```tsx
// Ejemplo de uso en un componente
import { useQuery } from '@tanstack/react-query';
import { appointmentService } from '../services/appointmentService';

function UpcomingAppointments() {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => appointmentService.getUpcoming(),
  });

  if (isLoading) return <div>Cargando...</div>;

  return (
    <div>
      {appointments?.map(apt => (
        <div key={apt._id}>{/* Renderizar cita */}</div>
      ))}
    </div>
  );
}
```

### 4. Crear Gráficos con Recharts

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

function ProgressChart({ data }) {
  return (
    <LineChart width={600} height={300} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="value" stroke="#8884d8" />
    </LineChart>
  );
}
```

## 🧪 Testing de la API

Puedes usar **Thunder Client** (extensión de VS Code) o **Postman** para probar los endpoints:

### Ejemplo: Login
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "mario@primefh.cl",
  "password": "Prime2024!"
}
```

### Ejemplo: Crear Cita (requiere token)
```
POST http://localhost:5000/api/appointments
Authorization: Bearer TU_TOKEN_AQUI
Content-Type: application/json

{
  "patient": "ID_DEL_PACIENTE",
  "professional": "ID_DE_MARIO",
  "date": "2024-02-15",
  "startTime": "09:00",
  "endTime": "10:00",
  "type": "entrenamiento"
}
```

## 🚢 Despliegue a Producción

### Backend
Servicios recomendados:
- **Railway** (recomendado) - https://railway.app
- **Render** - https://render.com
- **Heroku** - https://heroku.com

### Frontend
- **Vercel** (recomendado) - https://vercel.com
- **Netlify** - https://netlify.com

### Base de Datos
- Ya configurado con **MongoDB Atlas** (cloud)

## 📞 Próximos Pasos

1. **Instalar dependencias**: `npm install` en raíz y en `/backend`
2. **Configurar MongoDB Atlas** según las instrucciones
3. **Configurar variables de entorno** (.env)
4. **Ejecutar seed**: `cd backend && npm run seed`
5. **Iniciar backend**: `cd backend && npm run dev`
6. **Iniciar frontend**: `npm run dev`
7. **Desarrollar componentes** del frontend según las guías
8. **Probar la aplicación** y ajustar según necesidades

## 🆘 Solución de Problemas

### Error de conexión a MongoDB
- Verifica que tu IP esté en la whitelist de MongoDB Atlas
- Confirma que la cadena de conexión sea correcta
- Asegúrate de reemplazar `<password>` con tu contraseña real

### CORS Error
- Verifica que `FRONTEND_URL` en backend/.env sea correcto
- El backend debe estar corriendo en el puerto 5000
- El frontend debe estar en el puerto 5173

### Error "Cannot find module"
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install

cd backend
rm -rf node_modules package-lock.json
npm install
```

## 📄 Licencia

Este proyecto es privado y de uso exclusivo para Prime F&H - Mario Martínez, Puerto Montt, Chile.

---

**Desarrollado para Prime F&H** 🏋️‍♂️💪

¿Preguntas o problemas? Consulta la documentación detallada en `/backend/README.md` o revisa los comentarios en el código.
