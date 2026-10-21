import type { MonthlySummary } from '@/services/achievementService';

// Imagen para compartir el resumen del mes. Se arma EN EL DISPOSITIVO (no se sube a ningún servidor) y solo con una
// LISTA BLANCA de datos: el mes, cuántas sesiones se completaron y algunos hitos neutros. Nunca el nombre, medidas, peso,
// dolor, tipo de atención (kinesiología), registros ni hitos que revelen datos de salud o corporales.
export const SHAREABLE_CATEGORIES: ReadonlySet<string> = new Set(['primeros', 'constancia', 'trayectoria', 'fuerza']);
export const MAX_SHARED_MILESTONES = 3;

export interface ShareCardModel {
  monthLabel: string;
  sessions: number;
  milestones: string[];
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const shareMonthLabel = (month: string) => {
  const name = MONTHS[Number(month.slice(5, 7)) - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
};

export function buildShareCardModel(summary: MonthlySummary): ShareCardModel {
  const seen = new Set<string>();
  const milestones = summary.milestones
    .filter((m) => SHAREABLE_CATEGORIES.has(m.category))
    .map((m) => m.title)
    .filter((title) => (seen.has(title) ? false : (seen.add(title), true)))
    .slice(0, MAX_SHARED_MILESTONES);
  return { monthLabel: shareMonthLabel(summary.month), sessions: summary.sessions.completed, milestones };
}

// Para compartir hace falta algo que mostrar: sesiones completadas o al menos un hito neutro
export const canShareSummary = (summary: MonthlySummary) => {
  const model = buildShareCardModel(summary);
  return model.sessions > 0 || model.milestones.length > 0;
};

const W = 1080;
const H = 1350;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Dibuja la tarjeta (1080 × 1350) con los colores de la marca y devuelve el PNG
export async function renderShareCard(model: ShareCardModel): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen');

  ctx.fillStyle = '#181619';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 900);
  glow.addColorStop(0, 'rgba(57,140,162,0.35)');
  glow.addColorStop(1, 'rgba(57,140,162,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8fd0e0';
  ctx.font = '600 34px Inter, system-ui, sans-serif';
  ctx.fillText('PRIME F&H  ·  MI CAMINO', 90, 150);

  ctx.fillStyle = '#fff8e4';
  ctx.font = '500 92px "Playfair Display", Georgia, serif';
  ctx.fillText(model.monthLabel, 90, 290);

  ctx.font = '800 380px Inter, system-ui, sans-serif';
  ctx.fillText(String(model.sessions), 90, 730);
  ctx.fillStyle = '#cdc6b6';
  ctx.font = '600 52px Inter, system-ui, sans-serif';
  ctx.fillText(model.sessions === 1 ? 'sesión completada' : 'sesiones completadas', 90, 810);

  let y = 930;
  ctx.fillStyle = '#62b8cf';
  for (const title of model.milestones) {
    // hexágono pequeño como viñeta
    const cx = 120;
    ctx.beginPath();
    [[0, -30], [26, -15], [26, 15], [0, 30], [-26, 15], [-26, -15]].forEach(([dx, dy], i) => (i === 0 ? ctx.moveTo(cx + dx, y - 14 + dy) : ctx.lineTo(cx + dx, y - 14 + dy)));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8e4';
    ctx.font = '600 46px Inter, system-ui, sans-serif';
    const lines = wrap(ctx, title, W - 220);
    lines.forEach((l, i) => ctx.fillText(l, 175, y + i * 54));
    y += Math.max(1, lines.length) * 54 + 36;
    ctx.fillStyle = '#62b8cf';
  }

  ctx.fillStyle = '#a8a295';
  ctx.font = '500 34px Inter, system-ui, sans-serif';
  ctx.fillText('A mi ritmo, paso a paso.', 90, H - 90);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}
