# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prime F&H is a full-stack healthcare patient management system for physiotherapy (kinesiology) and training. It consists of a React/TypeScript frontend and a Node.js/Express backend with MongoDB. The project was bootstrapped with Lovable.dev. All user-facing text is in Spanish.

## Commands

### Frontend (run from project root)
- `npm run dev` — Start Vite dev server on port 8080
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run preview` — Preview production build

### Backend (run from `backend/`)
- `npm run dev` — Start Express server with nodemon on port 5000
- `npm start` — Start Express server (production)
- `npm run seed` — Seed database with test users (admin + 2 patients)

### Environment Setup
- Frontend: copy `.env.example` to `.env` (sets `VITE_API_URL`)
- Backend: copy `backend/.env.example` to `backend/.env` (MongoDB URI, JWT secret, etc.)
- Both frontend and backend have separate `node_modules`; run `npm install` in root and in `backend/`

## Architecture

### Frontend (`src/`)
- **React 18 + TypeScript + Vite** with SWC for fast builds
- **UI**: shadcn/ui components in `src/components/ui/`, styled with Tailwind CSS
- **Routing**: React Router v6 in `App.tsx`. Routes use Spanish paths (`/gracias`, `/privacidad`, `/terminos`)
- **State**: React Query (TanStack Query) for server state; `AuthContext` (`src/contexts/AuthContext.tsx`) for auth state via Context API
- **API client**: Centralized Axios instance in `src/lib/api.ts` with request interceptor (attaches JWT from localStorage) and response interceptor (auto-logout on 401)
- **Services layer**: `src/services/` — one file per domain (auth, user, appointment, measurement, exercise, eva). Each service uses the shared Axios instance
- **Types**: All TypeScript interfaces in `src/types/index.ts`
- **Path alias**: `@` maps to `./src` (configured in vite.config.ts and tsconfig)

### Backend (`backend/`)
- **Node.js + Express** (ES Modules) with MongoDB via Mongoose
- **Structure**: `controllers/` → `routes/` → `models/` → `middleware/` pattern
- **Auth**: JWT-based; middleware in `middleware/auth.js` provides `protect` (token verification), `authorize` (role check), `authorizeOwnerOrAdmin` (resource ownership)
- **Roles**: `admin` and `patient`
- **API prefix**: All routes under `/api/` — auth, users, appointments, measurements, exercises, eva
- **Database config**: `config/database.js` connects to MongoDB Atlas
- **Seed script**: `utils/seed.js` creates default admin (mario@primefh.cl / Prime2024!) and test patients

### Key Patterns
- Services in `src/services/` return typed API responses via `APIResponse<T>` wrapper
- Backend controllers follow consistent CRUD pattern: getAll, getById, create, update, delete
- Backend validation uses express-validator
- Form handling uses react-hook-form + Zod for schema validation
- Toast notifications via Sonner

### Current State
The backend API is fully implemented. The frontend has the landing page, service layer, auth context, and types complete. Dashboard pages (admin/patient), login/register pages, protected routes, calendar (react-big-calendar), and chart components (Recharts) are not yet built.
algo paso con la pagina web, que no la puedo ver
dime que pasó con la pagina web que no la puedo ver