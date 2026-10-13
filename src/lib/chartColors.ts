// Paleta única de los gráficos: usa los colores de marca de la app (index.css) en vez de colores
// sueltos. Se escriben como `hsl(var(--token))` para que sigan al tema y funcionan en atributos SVG.
export const CHART = {
  primary: 'hsl(var(--primary))', // turquesa de marca
  secondary: 'hsl(var(--secondary))', // turquesa claro
  coral: 'hsl(var(--coral))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  info: 'hsl(var(--info))',
  danger: 'hsl(var(--destructive))',
} as const;

// Ejes y cuadrícula
export const CHART_GRID = 'hsl(var(--border))';
export const CHART_TICK = 'hsl(var(--muted-foreground))';
