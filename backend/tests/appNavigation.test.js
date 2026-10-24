import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Guardia del menú lateral: el rediseño visual NO puede cambiar qué opciones ve cada rol ni a dónde llevan.
// Si alguna vez se agrega o quita una opción a propósito, se actualiza esta lista junto con el cambio.
const source = readFileSync(fileURLToPath(new URL('../../src/components/layouts/AppSidebar.tsx', import.meta.url)), 'utf8');

const itemsOf = (name) => {
  const block = source.match(new RegExp(`const ${name}: NavGroup\\[\\] = \\[([\\s\\S]*?)\\n\\];`));
  expect(block, `no se encontró ${name}`).not.toBeNull();
  return [...block[1].matchAll(/label: '([^']+)', icon: \w+, path: '([^']+)'(, exact: true)?/g)].map((m) => ({
    label: m[1],
    path: m[2],
    exact: !!m[3],
  }));
};

describe('menú lateral: inventario de opciones por rol', () => {
  it('paciente: las 10 opciones de siempre más «Resumen» de progreso (nueva pantalla)', () => {
    expect(itemsOf('patientNav')).toEqual([
      { label: 'Inicio', path: '/app/dashboard', exact: true },
      { label: 'Reservar hora', path: '/app/reservar', exact: false },
      { label: 'Mis citas', path: '/app/mis-citas', exact: false },
      { label: 'Resumen', path: '/app/progreso', exact: true },
      { label: 'Mediciones', path: '/app/mediciones', exact: false },
      { label: 'Ejercicios', path: '/app/ejercicios', exact: false },
      { label: 'Fotos', path: '/app/fotos', exact: false },
      { label: 'Dolor (EVA)', path: '/app/dolor', exact: false },
      { label: 'Mis logros', path: '/app/logros', exact: false },
      { label: 'Mi perfil', path: '/app/mi-perfil', exact: false },
      { label: 'Configuración', path: '/app/configuracion', exact: false },
    ]);
  });

  it('personal (administrador y profesional): las mismas opciones de siempre más «Ingresos» (el panel es solo de personal)', () => {
    expect(itemsOf('staffNav')).toEqual([
      { label: 'Inicio', path: '/app/admin', exact: true },
      { label: 'Calendario', path: '/app/admin/calendario', exact: false },
      { label: 'Disponibilidad', path: '/app/admin/disponibilidad', exact: false },
      { label: 'Pacientes', path: '/app/admin/pacientes', exact: false },
      { label: 'Registrar paciente', path: '/app/admin/registro', exact: false },
      { label: 'Planes', path: '/app/admin/planes', exact: false },
      { label: 'Ingresos', path: '/app/admin/ingresos', exact: false },
      { label: 'Cronómetro', path: '/app/admin/cronometro', exact: false },
      { label: 'Configuración', path: '/app/configuracion', exact: false },
    ]);
  });

  it('el personal y el paciente se distinguen igual que antes (administrador y profesional comparten menú)', () => {
    expect(source).toContain("const isStaff = user?.role === 'admin' || user?.role === 'professional';");
    expect(source).toContain('const groups = isStaff ? staffNav : patientNav;');
  });

  it('conserva «Cerrar sesión», el aviso de cambios sin guardar y la ruta de inicio por rol', () => {
    expect(source).toContain('Cerrar sesión');
    expect(source).toContain('confirmLeave(');
    expect(source).toContain("const homePath = isStaff ? '/app/admin' : '/app/dashboard';");
  });
});

describe('menú lateral: accesibilidad básica del panel móvil', () => {
  it('tiene un botón visible para cerrar y filas táctiles de 44 px', () => {
    expect(source).toContain('aria-label="Cerrar menú"');
    expect(source).toContain('[@media(pointer:coarse)]:h-11');
    expect(source).toContain("aria-current={active ? 'page' : undefined}");
  });

  it('el estado activo no depende solo del color (barra, fondo y negrita)', () => {
    expect(source).toContain('data-[active=true]:font-semibold');
    expect(source).toMatch(/absolute left-0 top-1\/2 h-5 w-\[3px\]/);
  });

  it('respeta las zonas seguras del teléfono arriba y abajo', () => {
    expect(source).toContain('env(safe-area-inset-top)');
    expect(source).toContain('env(safe-area-inset-bottom)');
  });
});
