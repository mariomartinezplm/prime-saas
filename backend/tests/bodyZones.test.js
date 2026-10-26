/**
 * PRUEBAS — zonas del cuerpo: una sola lista para el dolor (EVA), los objetivos y el mapa; el paciente anota su propio dolor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { BODY_ZONES, ALL_BODY_ZONES, BODY_ZONE_IDS } from '../config/bodyZones.js';
import { EVA_AREAS } from '../config/goalCatalog.js';
import EVA from '../models/EVA.js';
import User from '../models/User.js';
import * as plans from '../services/clientPlanService.js';
import * as notifications from '../services/notificationService.js';
import { createEVARecord } from '../controllers/evaController.js';

vi.mock('../services/clientPlanService.js', () => ({ hasActivePlan: vi.fn() }));
vi.mock('../services/notificationService.js', () => ({ notify: vi.fn(async () => ({})) }));
vi.mock('../services/goals/goalAchievements.js', () => ({ evaluateGoalAchievements: vi.fn(async () => {}) }));

const { BODY_ZONE_GEOMETRY, zoneShape, zonesInView, zoneLabel } = await import('../../src/lib/bodyZones.ts');

describe('lista única de zonas', () => {
  it('los ids no se repiten y cubren lo que Mario pidió: codo, antebrazo, muñeca, rodilla, tibia, tobillo, planta y dorso del pie', () => {
    expect(new Set(BODY_ZONE_IDS).size).toBe(BODY_ZONE_IDS.length);
    for (const side of ['izquierdo', 'derecho']) expect(BODY_ZONE_IDS).toContain(`codo-${side}`);
    for (const id of ['antebrazo-derecho', 'muneca-izquierda', 'rodilla-derecha', 'tibia-izquierda', 'tobillo-derecho', 'planta-izquierda', 'dorso-pie-derecho', 'brazo-derecho', 'gluteo-izquierdo', 'pantorrilla-derecha']) {
      expect(BODY_ZONE_IDS, id).toContain(id);
    }
  });

  it('los registros y objetivos antiguos siguen siendo válidos (ids que ya existían)', () => {
    for (const id of ['cabeza', 'cuello', 'hombro-izquierdo', 'codo-derecho', 'espalda-alta', 'espalda-media', 'espalda-baja', 'lumbar', 'cadera-izquierda', 'rodilla-derecha', 'tobillo-izquierdo', 'pie-izquierdo', 'pie-derecho', 'pecho', 'abdomen', 'otro']) {
      expect(BODY_ZONE_IDS, id).toContain(id);
    }
  });

  it('el registro de dolor y los objetivos de dolor aceptan exactamente las mismas zonas', () => {
    const evaIds = EVA.schema.path('bodyArea').enumValues;
    expect(evaIds).toEqual(BODY_ZONE_IDS);
    expect(EVA_AREAS.map((a) => a.value)).toEqual(BODY_ZONE_IDS);
  });

  it('el mapa del navegador dibuja cada zona de la lista (y ninguna que no exista)', () => {
    const drawn = new Set(BODY_ZONE_GEOMETRY.map((z) => z.id));
    for (const zone of BODY_ZONES) expect(drawn.has(zone.id), zone.id).toBe(true);
    for (const id of drawn) expect(BODY_ZONE_IDS, id).toContain(id);
  });

  it('los nombres y los perímetros del mapa son los mismos que los del servidor', () => {
    for (const zone of BODY_ZONES) {
      const g = BODY_ZONE_GEOMETRY.find((x) => x.id === zone.id);
      expect(g.label, zone.id).toBe(zone.label);
      expect(g.kind, zone.id).toBe(zone.kind);
      expect(g.side, zone.id).toBe(zone.side ?? null);
      expect(g.perimeter ?? [], zone.id).toEqual(zone.perimeter ?? []);
    }
    expect(zoneLabel('lumbar')).toBe('Lumbar'); // los ids antiguos también tienen nombre
  });

  it('la derecha de la persona queda a la izquierda del dibujo de frente, y a la derecha de espalda', () => {
    const find = (id) => BODY_ZONE_GEOMETRY.find((z) => z.id === id);
    expect(zoneShape(find('codo-derecho'), 'front').cx).toBeLessThan(120);
    expect(zoneShape(find('codo-izquierdo'), 'front').cx).toBeGreaterThan(120);
    expect(zoneShape(find('codo-derecho'), 'back').cx).toBeGreaterThan(120);
    expect(zoneShape(find('rodilla-izquierda'), 'back').cx).toBeLessThan(120);
  });

  it('cada vista dibuja las zonas que se ven en ella: el pecho solo de frente, la espalda solo de espalda', () => {
    const front = zonesInView('front').map((z) => z.id);
    const back = zonesInView('back').map((z) => z.id);
    expect(front).toEqual(expect.arrayContaining(['pecho', 'abdomen', 'tibia-derecha', 'dorso-pie-izquierdo', 'muslo-anterior-derecho']));
    expect(front).not.toContain('espalda-alta');
    expect(back).toEqual(expect.arrayContaining(['espalda-alta', 'espalda-media', 'espalda-baja', 'gluteo-izquierdo', 'pantorrilla-derecha', 'planta-izquierda', 'muslo-posterior-derecho']));
    expect(back).not.toContain('pecho');
  });

  it('cada perímetro de una zona es un campo real de Mediciones', async () => {
    const { default: Measurement } = await import('../models/Measurement.js');
    const fields = Object.keys(Measurement.schema.paths).filter((p) => p.startsWith('perimeters.')).map((p) => p.split('.').pop());
    for (const zone of ALL_BODY_ZONES) for (const f of zone.perimeter ?? []) expect(fields, `${zone.id} → ${f}`).toContain(f);
  });
});

const id = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  statusCode: 200,
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

describe('el paciente registra su propio dolor', () => {
  const ME = id();
  const OTHER = id();
  const PRO = id();
  let created;
  beforeEach(() => {
    vi.clearAllMocks();
    created = null;
    vi.mocked(plans.hasActivePlan).mockResolvedValue(true);
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ME, firstName: 'Ana', lastName: 'P', assignedProfessionalId: PRO });
    vi.spyOn(EVA, 'create').mockImplementation(async (doc) => {
      created = doc;
      return { ...doc, populate: async () => {} };
    });
  });
  const req = (body) => ({ user: { _id: ME, role: 'patient' }, body });

  it('se guarda a su nombre aunque el cliente mande el id de otra persona, y solo con los campos que le corresponden', async () => {
    const res = fakeRes();
    await createEVARecord(req({ patient: String(OTHER), painLevel: 6, bodyArea: 'codo-derecho', observations: 'al levantar', treatmentPlan: 'inventado', medication: 'x', recordedBy: String(OTHER) }), res);
    expect(res.statusCode).toBe(201);
    expect(String(created.patient)).toBe(String(ME));
    expect(String(created.recordedBy)).toBe(String(ME));
    expect(created.treatmentPlan).toBeUndefined();
    expect(created.medication).toBeUndefined();
    expect(created.bodyArea).toBe('codo-derecho');
  });

  it('con el plan vencido no puede registrar (solo lectura)', async () => {
    vi.mocked(plans.hasActivePlan).mockResolvedValue(false);
    const res = fakeRes();
    await createEVARecord(req({ painLevel: 4, bodyArea: 'rodilla-izquierda' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('NO_ACTIVE_PLAN_SESSIONS');
    expect(created).toBeNull();
  });

  it('su profesional asignado recibe el aviso', async () => {
    await createEVARecord(req({ painLevel: 3, bodyArea: 'tibia-derecha' }), fakeRes());
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(notifications.notify).mock.calls[0][0])).toBe(String(PRO));
    expect(vi.mocked(notifications.notify).mock.calls[0][1]).toBe('evolution_updated');
  });

  it('cuando lo registra el personal no se avisa a nadie (es su propia acción)', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: OTHER, firstName: 'Luis', lastName: 'S', assignedProfessionalId: PRO });
    vi.spyOn(await import('../middleware/auth.js'), 'canAccessPatient').mockResolvedValue(true);
    await createEVARecord({ user: { _id: PRO, role: 'professional' }, body: { patient: String(OTHER), painLevel: 5, bodyArea: 'pecho' } }, fakeRes());
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
