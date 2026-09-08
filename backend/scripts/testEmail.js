/**
 * Prueba manual del envío de correo con Resend (Paso 11 de BLUEPRINT.md).
 *
 * Uso: node backend/scripts/testEmail.js destinatario@ejemplo.com
 */
import dotenv from 'dotenv';
dotenv.config();

import { sendEmail } from '../services/emailService.js';

const destinatario = process.argv[2];

if (!destinatario) {
  console.error('Uso: node backend/scripts/testEmail.js destinatario@ejemplo.com');
  process.exit(1);
}

const resultado = await sendEmail({
  to: destinatario,
  subject: 'Prueba de Resend — Prime F&H',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #3D9AA6;">✅ Resend está funcionando</h2>
      <p>Este correo confirma que Prime F&H puede enviar emails desde
         <strong>primefh.cl</strong> a través de Resend.</p>
    </div>
  `
});

if (resultado.ok) {
  console.log('Enviado');
} else {
  console.error('Falló:', resultado.reason);
  process.exit(1);
}
