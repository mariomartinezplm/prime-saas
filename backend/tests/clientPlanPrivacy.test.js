/**
 * PRUEBAS — privacidad de los planes: lo que recibe un PACIENTE por la API.
 *
 * Hallazgo: GET /api/client-plans/patient/(me|:id) y GET /api/client-plans/balance/(me|:id) devolvían el documento completo
 * del plan, incluidas las `notes` escritas por el personal, quién lo registró (`registeredBy`) y campos internos del sistema
 * (avisos enviados, ids de ciclo). El paciente solo necesita los datos de SU plan.
 *
 * Regla: el paciente recibe una vista con los campos propios del plan (lista cerrada); admin y profesional siguen recibiendo
 * el documento completo, con las notas. Cada paciente solo consulta lo suyo.
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real). La serialización es la real: se usa un
 * documento de Mongoose y se mira lo que saldría en el cuerpo de la respuesta (JSON).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';
import User from '../models/User.js';
import { getPatientPlans, getBalance } from '../controllers/clientPlanController.js';
import { canAccessPatient } from '../middleware/auth.js';
import clientPlanRouter from '../routes/clientPlanRoutes.js';

vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();
const PACIENTE = nuevoId();
const OTRO_PACIENTE = nuevoId();
const PERSONAL = nuevoId();

const NOTA_INTERNA = 'NOTA INTERNA DEL PERSONAL: pagó en dos cuotas, no insistir';

// Un plan con TODO lo que puede traer un documento real, incluidas las notas y los campos internos
const planCompleto = () =>
  new ClientPlan({
    patient: PACIENTE,
    serviceType: 'entrenamiento',
    sessionsTotal: 12,
    sessionsUsed: 4,
    startDate: new Date('2026-10-01T03:00:00Z'),
    endDate: new Date('2026-10-31T23:59:59Z'),
    status: 'active',
    term: 'anual',
    billingCycle: 'calendar',
    cycleNumber: 1,
    cyclesTotal: 12,
    termId: nuevoId(),
    renews: true,
    paymentPending: true,
    paymentDueBy: new Date('2026-10-06T03:00:00Z'),
    renewedFrom: nuevoId(),
    renewalNotifiedAt: new Date(),
    expiringTomorrowNotifiedAt: new Date(),
    expiringNotifiedAt: new Date(),
    expiredNotifiedAt: new Date(),
    registeredBy: PERSONAL,
    notes: NOTA_INTERNA,
    createdAt: new Date('2026-09-30T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z')
  });

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
// Lo que viajaría por HTTP
const cuerpo = (res) => JSON.parse(JSON.stringify(res.body));

const paciente = (id = PACIENTE) => ({ _id: id, role: 'patient' });
const admin = { _id: nuevoId(), role: 'admin' };
const profesional = { _id: PERSONAL, role: 'professional' };

// Campos propios del plan que el paciente SÍ necesita (los usan el dashboard, la reserva y su perfil)
const CAMPOS_DEL_PACIENTE = [
  '_id', 'billingCycle', 'createdAt', 'cycleNumber', 'cyclesTotal', 'endDate', 'patient', 'paymentDueBy',
  'paymentPending', 'renews', 'serviceType', 'sessionsTotal', 'sessionsUsed', 'startDate', 'status', 'term', 'unlimited', 'updatedAt'
];
const CAMPOS_INTERNOS = ['notes', 'registeredBy', 'termId', 'renewedFrom', 'renewalNotifiedAt', 'expiringTomorrowNotifiedAt', 'expiringNotifiedAt', 'expiredNotifiedAt'];

function mockHistorial(planes) {
  // El personal consulta con populate('registeredBy'); el paciente, sin él: se soportan ambos recorridos
  const cadena = { populate: () => cadena, sort: () => Promise.resolve(planes) };
  vi.spyOn(ClientPlan, 'find').mockReturnValue(cadena);
}
function mockSaldo(plan) {
  vi.spyOn(ClientPlan, 'findOne').mockResolvedValue(plan);
  vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(2);
}

beforeEach(() => vi.restoreAllMocks());

describe('historial de planes: GET /api/client-plans/patient/(me|:id)', () => {
  it('un PACIENTE no recibe las notas del personal ni quién registró el plan ni campos internos', async () => {
    mockHistorial([planCompleto()]);
    const res = fakeRes();
    await getPatientPlans({ user: paciente(), params: {} }, res);

    const texto = JSON.stringify(cuerpo(res));
    expect(res.statusCode).toBe(200);
    expect(texto).not.toContain(NOTA_INTERNA);
    for (const campo of CAMPOS_INTERNOS) expect(texto, `no debe salir "${campo}"`).not.toContain(`"${campo}"`);
    expect(texto).not.toContain(String(PERSONAL));
  });

  it('el paciente sí recibe los campos propios de su plan (lista cerrada)', async () => {
    mockHistorial([planCompleto()]);
    const res = fakeRes();
    await getPatientPlans({ user: paciente(), params: {} }, res);
    const [plan] = cuerpo(res).data.clientPlans;
    expect(Object.keys(plan).sort()).toEqual([...CAMPOS_DEL_PACIENTE].sort());
    expect(plan).toMatchObject({ serviceType: 'entrenamiento', sessionsTotal: 12, sessionsUsed: 4, status: 'active', term: 'anual', cyclesTotal: 12, paymentPending: true });
  });

  it('admin y profesional con acceso SÍ reciben el documento completo, con las notas', async () => {
    for (const user of [admin, profesional]) {
      mockHistorial([planCompleto()]);
      const res = fakeRes();
      await getPatientPlans({ user, params: { patientId: String(PACIENTE) } }, res);
      const [plan] = cuerpo(res).data.clientPlans;
      expect(plan.notes).toBe(NOTA_INTERNA);
      expect(plan.registeredBy).toBeDefined();
      vi.restoreAllMocks();
    }
  });

  it('un paciente no puede pedir los planes de OTRO paciente (403 y no se consulta nada)', async () => {
    const find = vi.spyOn(ClientPlan, 'find');
    const res = fakeRes();
    await getPatientPlans({ user: paciente(OTRO_PACIENTE), params: { patientId: String(PACIENTE) } }, res);
    expect(res.statusCode).toBe(403);
    expect(find).not.toHaveBeenCalled();
  });

  it('la ruta «me» usa SOLO el id de la sesión (nunca uno que mande el cliente)', async () => {
    mockHistorial([]);
    const find = ClientPlan.find;
    const res = fakeRes();
    await getPatientPlans({ user: paciente(), params: {}, query: { patientId: String(OTRO_PACIENTE) }, body: { patientId: String(OTRO_PACIENTE) } }, res);
    expect(find).toHaveBeenCalledWith({ patient: String(PACIENTE) });
  });
});

describe('saldo: GET /api/client-plans/balance/(me|:id)', () => {
  it('un PACIENTE recibe su saldo sin notas, sin quién registró el plan y sin campos internos', async () => {
    mockSaldo(planCompleto());
    const res = fakeRes();
    await getBalance({ user: paciente(), params: {} }, res);

    const { balance } = cuerpo(res).data;
    const texto = JSON.stringify(balance);
    expect(texto).not.toContain(NOTA_INTERNA);
    for (const campo of CAMPOS_INTERNOS) expect(texto, `no debe salir "${campo}"`).not.toContain(`"${campo}"`);
    expect(Object.keys(balance.plan).sort()).toEqual([...CAMPOS_DEL_PACIENTE].sort());
  });

  it('el saldo conserva lo que usa la pantalla: plan vigente, sesiones, extras y pago pendiente', async () => {
    mockSaldo(planCompleto());
    const res = fakeRes();
    await getBalance({ user: paciente(), params: {} }, res);
    const { balance } = cuerpo(res).data;
    expect(balance).toMatchObject({
      hasActivePlan: true,
      planSessionsAvailable: 8,
      extraSessionsAvailable: 2,
      totalAvailable: 10,
      paymentPending: true
    });
    expect(balance.paymentDueBy).toBeTruthy();
    expect(balance.plan).toMatchObject({ sessionsTotal: 12, sessionsUsed: 4, term: 'anual', cycleNumber: 1, cyclesTotal: 12 });
  });

  it('sin plan vigente el saldo sigue funcionando (plan null)', async () => {
    mockSaldo(null);
    const res = fakeRes();
    await getBalance({ user: paciente(), params: {} }, res);
    const { balance } = cuerpo(res).data;
    expect(balance.hasActivePlan).toBe(false);
    expect(balance.plan).toBeNull();
  });

  it('admin y profesional siguen viendo el plan completo en el saldo, con las notas', async () => {
    for (const user of [admin, profesional]) {
      mockSaldo(planCompleto());
      const res = fakeRes();
      await getBalance({ user, params: { patientId: String(PACIENTE) } }, res);
      expect(cuerpo(res).data.balance.plan.notes).toBe(NOTA_INTERNA);
      vi.restoreAllMocks();
    }
  });

  it('un paciente no puede pedir el saldo de OTRO paciente', async () => {
    const find = vi.spyOn(ClientPlan, 'findOne');
    const res = fakeRes();
    await getBalance({ user: paciente(OTRO_PACIENTE), params: { patientId: String(PACIENTE) } }, res);
    expect(res.statusCode).toBe(403);
    expect(find).not.toHaveBeenCalled();
  });
});

describe('pertenencia a nivel de ruta', () => {
  it('toda la API de planes pide sesión, y las rutas con :patientId pasan por authorizePatientAccess', () => {
    expect(clientPlanRouter.stack[0].name).toBe('protect');
    const rutas = clientPlanRouter.stack.filter((l) => l.route && l.route.path.includes(':patientId') && l.route.methods.get);
    expect(rutas.map((l) => l.route.path).sort()).toEqual(['/balance/:patientId', '/patient/:patientId']);
    // en cada ruta: authorizePatientAccess y, al final, el controlador
    for (const l of rutas) {
      expect(l.route.stack.length).toBe(2);
      expect(['getPatientPlans', 'getBalance']).toContain(l.route.stack[1].name);
    }
  });

  it('canAccessPatient: un paciente solo accede a sí mismo; otro paciente o un id inválido, no', async () => {
    expect(await canAccessPatient({ _id: PACIENTE, role: 'patient' }, String(PACIENTE))).toBe(true);
    expect(await canAccessPatient({ _id: OTRO_PACIENTE, role: 'patient' }, String(PACIENTE))).toBe(false);
    expect(await canAccessPatient({ _id: PACIENTE, role: 'patient' }, 'no-es-un-id')).toBe(false);
  });

  it('un profesional solo accede a pacientes que le pertenecen (404 para los de otro profesional)', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve({ role: 'patient', assignedProfessionalId: nuevoId() }) });
    expect(await canAccessPatient({ _id: PERSONAL, role: 'professional' }, String(PACIENTE))).toBe(false);
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve({ role: 'patient', assignedProfessionalId: PERSONAL }) });
    expect(await canAccessPatient({ _id: PERSONAL, role: 'professional' }, String(PACIENTE))).toBe(true);
  });
});
