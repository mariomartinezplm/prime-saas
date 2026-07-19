// Datos de contacto del centro. Mismo número usado hoy en la landing (WhatsAppFloat,
// Hero, Services, Pricing, HowItWorks, Partnerships) — ahí sigue hardcodeado en cada
// componente; esta constante es la única fuente para las páginas nuevas de la app.
export const WHATSAPP_PHONE = '56956286651';

export function getWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}
