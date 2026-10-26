// Imagen para compartir un LOGRO (Instagram, WhatsApp, guardarla…). Se arma EN EL DISPOSITIVO: no se sube a ningún servidor y la
// persona ve exactamente lo que va a compartir antes de hacerlo.
//
// Privacidad: por defecto la imagen lleva solo el nombre del logro y la fecha. El nombre de la persona y los números (la marca
// de un ejercicio, la meta alcanzada) son OPCIONES que ella enciende. Los logros de salud o de cuerpo (kinesiología, peso,
// dolor, sueño, estrés, readiness, objetivos) avisan antes de compartir y NO muestran su categoría en la imagen.

export type CardFormat = 'story' | 'post';

export const CARD_SIZES: Record<CardFormat, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: 'Historia (9:16)' },
  post: { w: 1080, h: 1350, label: 'Publicación (4:5)' },
};

// Categorías que cuentan algo de la salud o del cuerpo de la persona
export const SENSITIVE_CATEGORIES: ReadonlySet<string> = new Set(['kinesiologia', 'readiness', 'descanso', 'estres', 'cuerpo', 'objetivos']);

export interface ShareableAchievement {
  title: string;
  category: string;
  categoryLabel: string;
  awardedAt: string;
  // Solo en «Nueva marca personal» y «Objetivo conseguido»
  record?: { exercise: string; previous: number | null; current: number | null; unit: string } | null;
  goal?: { headline: string; value: number | null; unit: string | null } | null;
}

export interface ShareOptions {
  includeName: boolean;
  includeDetail: boolean;
}

export interface AchievementCardModel {
  title: string;
  dateLabel: string;
  // Categoría visible (vacía en los logros de salud o cuerpo)
  categoryLabel: string;
  // Línea de detalle opcional: «Sentadilla · 100 kg»
  detail: string | null;
  name: string | null;
  sensitive: boolean;
}

const number = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

// «26 de octubre de 2026» en hora de Chile
export const shareDateLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' }).format(d);
};

export const isSensitiveAchievement = (a: Pick<ShareableAchievement, 'category' | 'goal'>): boolean => !!a.goal || SENSITIVE_CATEGORIES.has(a.category);

// Lo que dice el detalle, solo si existe de verdad (nunca inventa un número)
export function detailLine(a: ShareableAchievement): string | null {
  if (a.record && a.record.current !== null) return `${a.record.exercise} · ${number(a.record.current)} ${a.record.unit}`.trim();
  if (a.goal) {
    if (a.goal.value !== null && a.goal.unit) return `${a.goal.headline} · ${number(a.goal.value)} ${a.goal.unit}`.trim();
    return a.goal.headline || null;
  }
  return null;
}

export function buildAchievementCardModel(a: ShareableAchievement, options: ShareOptions, firstName?: string | null): AchievementCardModel {
  const sensitive = isSensitiveAchievement(a);
  const name = options.includeName && firstName?.trim() ? firstName.trim() : null;
  return {
    title: a.record ? 'Nueva marca personal' : a.title,
    dateLabel: shareDateLabel(a.awardedAt),
    categoryLabel: sensitive ? '' : a.categoryLabel,
    detail: options.includeDetail ? detailLine(a) : null,
    name,
    sensitive,
  };
}

// ── Dibujo ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

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

// Hexágono con una estrella al centro: la insignia de logro de PRIME
function drawBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const hex = (radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  const fill = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  fill.addColorStop(0, '#2c6b7e');
  fill.addColorStop(1, '#1d4452');
  hex(r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#62b8cf';
  ctx.stroke();
  hex(r * 0.82);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,248,228,0.35)';
  ctx.stroke();

  const star = (outer: number, inner: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  star(r * 0.46, r * 0.2);
  ctx.fillStyle = '#fff8e4';
  ctx.fill();
}

// Dibuja la tarjeta con los colores de la marca y devuelve el PNG
export async function renderAchievementCard(model: AchievementCardModel, format: CardFormat = 'story'): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const { w: W, h: H } = CARD_SIZES[format];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen');

  ctx.fillStyle = '#181619';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.36, 0, W / 2, H * 0.36, W * 0.95);
  glow.addColorStop(0, 'rgba(57,140,162,0.42)');
  glow.addColorStop(1, 'rgba(57,140,162,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const story = format === 'story';
  const centerX = W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Marca arriba (en historia queda lejos del borde: Instagram pone su barra ahí)
  ctx.fillStyle = '#8fd0e0';
  ctx.font = '600 34px Inter, system-ui, sans-serif';
  ctx.fillText('PRIME F&H', centerX, story ? 230 : 110);

  // Las medidas de la publicación (4:5) son más compactas para que quepan el nombre y la despedida sin pisarse
  const badgeY = story ? 600 : 360;
  drawBadge(ctx, centerX, badgeY, story ? 230 : 150);

  let y = badgeY + (story ? 360 : 245);
  ctx.fillStyle = '#8fd0e0';
  ctx.font = '700 34px Inter, system-ui, sans-serif';
  ctx.fillText(model.categoryLabel ? `NUEVO LOGRO · ${model.categoryLabel.toUpperCase()}` : 'NUEVO LOGRO', centerX, y);

  y += 100;
  ctx.fillStyle = '#fff8e4';
  const titleSize = model.title.length > 28 ? 84 : 100;
  ctx.font = `500 ${titleSize}px "Playfair Display", Georgia, serif`;
  const titleLines = wrap(ctx, model.title, W - 200).slice(0, 3);
  titleLines.forEach((line, i) => ctx.fillText(line, centerX, y + i * (titleSize * 1.12)));
  y += titleLines.length * (titleSize * 1.12) + 10;

  if (model.detail) {
    ctx.fillStyle = '#cdc6b6';
    ctx.font = '600 46px Inter, system-ui, sans-serif';
    const lines = wrap(ctx, model.detail, W - 220).slice(0, 2);
    lines.forEach((line, i) => ctx.fillText(line, centerX, y + 40 + i * 58));
    y += 40 + lines.length * 58;
  }

  ctx.fillStyle = '#a8a295';
  ctx.font = '500 38px Inter, system-ui, sans-serif';
  if (model.dateLabel) ctx.fillText(model.dateLabel, centerX, y + 70);
  if (model.name) {
    ctx.fillStyle = '#fff8e4';
    ctx.font = '600 44px Inter, system-ui, sans-serif';
    ctx.fillText(model.name, centerX, y + 150);
  }

  ctx.fillStyle = '#a8a295';
  ctx.font = '500 34px Inter, system-ui, sans-serif';
  ctx.fillText('A mi ritmo, paso a paso.', centerX, H - (story ? 230 : 70));

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}

// La política de seguridad de la app no permite mostrar imágenes desde blob:, así que la vista previa va como data:
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
