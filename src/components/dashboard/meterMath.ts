// Valor visual de una barra de progreso: siempre acotado a 0–100 y sin inventar números. Un valor ausente o inválido
// (NaN, infinito) se dibuja vacío y SIN valor accesible. Las cifras reales que se muestran en texto no pasan por aquí.
export function meterPercent(ratio: number): { valid: boolean; pct: number } {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return { valid: false, pct: 0 };
  return { valid: true, pct: Math.round(Math.min(1, Math.max(0, ratio)) * 100) };
}

// ¿Esta barra debe animar su entrada? Solo con un valor válido y mayor que cero, con identificador, y la primera vez que se muestra
export function shouldAnimateMeter(ratio: number, animateKey: string | undefined, alreadyShown: ReadonlySet<string>): boolean {
  const { valid, pct } = meterPercent(ratio);
  return valid && pct > 0 && !!animateKey && !alreadyShown.has(animateKey);
}
