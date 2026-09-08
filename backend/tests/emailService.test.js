/**
 * PRUEBAS — servicio de email con Resend (Paso 11 de BLUEPRINT.md).
 *
 * Sin red real: se mockea `global.fetch`. Cubre lo que puede romperse sin
 * avisar (falta la API key, Resend responde con error, texto de usuario sin
 * escapar en el HTML) — el envío real a un inbox se verifica manualmente con
 * `node backend/scripts/testEmail.js`, tal como indica el Verify del blueprint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sendEmail — envío de bajo nivel', () => {
  const ORIGINAL_KEY = process.env.RESEND_API_KEY;

  afterEach(() => {
    process.env.RESEND_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
  });

  it('sin RESEND_API_KEY: no revienta, avisa y devuelve ok:false', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import('../services/emailService.js');

    const fetchSpy = vi.spyOn(global, 'fetch');
    const resultado = await sendEmail({ to: 'x@y.cl', subject: 'Prueba', html: '<p>Hola</p>' });

    expect(resultado.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled(); // ni siquiera intenta la petición
  });

  it('con API key: llama a la API de Resend con el remitente correcto', async () => {
    process.env.RESEND_API_KEY = 'clave-de-prueba';
    const { sendEmail } = await import('../services/emailService.js');

    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });

    const resultado = await sendEmail({ to: 'paciente@correo.cl', subject: 'Asunto', html: '<p>Cuerpo</p>' });

    expect(resultado.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer clave-de-prueba' })
      })
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.from).toBe('Prime F&H <no-responder@primefh.cl>');
    expect(body.to).toBe('paciente@correo.cl');
  });

  it('si Resend responde con error HTTP, no lanza — devuelve ok:false', async () => {
    process.env.RESEND_API_KEY = 'clave-de-prueba';
    const { sendEmail } = await import('../services/emailService.js');

    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 422 });

    const resultado = await sendEmail({ to: 'x@y.cl', subject: 'Prueba', html: '<p>Hola</p>' });
    expect(resultado.ok).toBe(false);
  });

  it('si fetch lanza (sin red), no propaga la excepción — devuelve ok:false', async () => {
    process.env.RESEND_API_KEY = 'clave-de-prueba';
    const { sendEmail } = await import('../services/emailService.js');

    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(sendEmail({ to: 'x@y.cl', subject: 'Prueba', html: '<p>Hola</p>' })).resolves.toEqual(
      expect.objectContaining({ ok: false })
    );
  });
});

describe('Plantillas de citas — escape de input de usuario', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'clave-de-prueba';
  });
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.restoreAllMocks();
  });

  const capturarHtmlEnviado = () => {
    let htmlEnviado = '';
    vi.spyOn(global, 'fetch').mockImplementation((url, opts) => {
      htmlEnviado = JSON.parse(opts.body).html;
      return Promise.resolve({ ok: true });
    });
    return () => htmlEnviado;
  };

  it('sendAppointmentCreatedEmail escapa un motivo/nombre con etiquetas HTML', async () => {
    const { sendAppointmentCreatedEmail } = await import('../services/emailService.js');
    const obtenerHtml = capturarHtmlEnviado();

    await sendAppointmentCreatedEmail({
      patient: { firstName: '<script>robar()</script>', lastName: 'Test' },
      professional: { firstName: 'Ana', email: 'ana@primefh.cl' },
      date: new Date('2026-10-01'),
      startTime: '10:00',
      endTime: '11:00',
      type: 'kinesiologia'
    });

    const html = obtenerHtml();
    expect(html).not.toContain('<script>robar()</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sendAppointmentCancelledEmail escapa el motivo de cancelación', async () => {
    const { sendAppointmentCancelledEmail } = await import('../services/emailService.js');
    const obtenerHtml = capturarHtmlEnviado();

    await sendAppointmentCancelledEmail({
      patient: { firstName: 'Juan', lastName: 'Pérez' },
      professional: { firstName: 'Ana', email: 'ana@primefh.cl' },
      date: new Date('2026-10-01'),
      startTime: '10:00',
      cancelledBy: { firstName: 'Juan', lastName: 'Pérez' },
      cancellationReason: '<img src=x onerror=alert(1)>'
    });

    const html = obtenerHtml();
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('el remitente siempre es el de la marca, sin importar el contenido', async () => {
    const { sendAppointmentUpdatedEmail } = await import('../services/emailService.js');
    let fromEnviado = '';
    vi.spyOn(global, 'fetch').mockImplementation((url, opts) => {
      fromEnviado = JSON.parse(opts.body).from;
      return Promise.resolve({ ok: true });
    });

    await sendAppointmentUpdatedEmail({
      patient: { firstName: 'Ana', lastName: 'López' },
      professional: { firstName: 'Tomás', email: 't@primefh.cl' },
      date: new Date('2026-10-01'),
      startTime: '10:00',
      endTime: '11:00',
      changes: 'Horario'
    });

    expect(fromEnviado).toBe('Prime F&H <no-responder@primefh.cl>');
  });
});
