// Datos de contacto del centro — única fuente para todo el frontend (landing y app).
export const WHATSAPP_PHONE = '56956286651'; // sin "+", formato que espera wa.me
export const CONTACT_PHONE_DISPLAY = '+56 9 5628 6651'; // formato legible para mostrar en pantalla
export const CONTACT_PHONE_TEL = `+${WHATSAPP_PHONE}`; // formato para href="tel:" y JSON-LD

export function getWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}
