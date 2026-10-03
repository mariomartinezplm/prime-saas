/**
 * PRUEBAS — fotos de progreso (subir, listar, cambiar visibilidad, borrar).
 *
 * Regla central (decisión de Mario): una foto "solo yo" la ven ÚNICAMENTE quien
 * la sube y el admin. El profesional asignado NO la ve, aunque sea su paciente.
 *
 * Mismo patrón que files.test.js / invite.test.js: vitest + vi.spyOn, sin BD ni R2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import * as storageService from '../services/storageService.js';
import * as clientPlanService from '../services/clientPlanService.js';
import * as notificationService from '../services/notificationService.js';
import {
  requireActivePlanToUpload,
  uploadPhoto,
  getPatientPhotos,
  updatePhoto,
  deletePhoto
} from '../controllers/photoController.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

const query = (value) => ({
  select: () => query(value),
  sort: () => query(value),
  limit: () => query(value),
  populate: () => query(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  catch: (reject) => Promise.resolve(value).catch(reject)
});

const PROF_A = nuevoId();
const PROF_B = nuevoId();
const PACIENTE = nuevoId();
const ADMIN = nuevoId();

const paciente = { _id: PACIENTE, role: 'patient' };
const profA = { _id: PROF_A, role: 'professional' };
const profB = { _id: PROF_B, role: 'professional' };
const admin = { _id: ADMIN, role: 'admin' };

// Bytes iniciales reales de un JPG y de un PDF: el tipo se detecta por contenido
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(32)]);

const archivo = (buffer = JPG) => ({ buffer, size: buffer.length, originalname: 'foto.jpg' });

function mockUsuarios() {
  vi.spyOn(User, 'findById').mockImplementation((id) => {
    if (id.toString() === PACIENTE.toString()) {
      return query({
        _id: PACIENTE, role: 'patient', firstName: 'Ana', lastName: 'Pérez', assignedProfessionalId: PROF_A
      });
    }
    return query(null);
  });
}

function foto(extra = {}) {
  return {
    _id: nuevoId(),
    patient: PACIENTE,
    uploadedBy: PACIENTE,
    storageKey: `photos/${PACIENTE}/${nuevoId()}.jpg`,
    mimeType: 'image/jpeg',
    position: 'front',
    visibility: 'shared',
    takenAt: new Date('2026-09-01'),
    createdAt: new Date('2026-09-01'),
    save: vi.fn().mockResolvedValue(true),
    deleteOne: vi.fn().mockResolvedValue(true),
    ...extra
  };
}

// Evalúa el filtro que arma el controlador, para probar el resultado real
// (qué fotos salen) y no la forma de la consulta.
function aplicarFiltro(fotos, filtro) {
  return fotos.filter((f) => {
    if (filtro.patient && f.patient.toString() !== filtro.patient.toString()) return false;
    if (filtro.$or) {
      return filtro.$or.some((c) =>
        (c.visibility && f.visibility === c.visibility) ||
        (c.uploadedBy && f.uploadedBy.toString() === c.uploadedBy.toString()));
    }
    return true;
  });
}

function mockFotosEnBase(fotos) {
  return vi.spyOn(ProgressPhoto, 'find').mockImplementation((filtro) => query(aplicarFiltro(fotos, filtro)));
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockUsuarios();
  vi.spyOn(storageService, 'isStorageConfigured').mockReturnValue(true);
  vi.spyOn(storageService, 'uploadObject').mockResolvedValue(undefined);
  vi.spyOn(storageService, 'deleteObject').mockResolvedValue(undefined);
  vi.spyOn(storageService, 'getSignedDownloadUrl').mockResolvedValue('https://r2.example/firmada');
  vi.spyOn(clientPlanService, 'hasActivePlan').mockResolvedValue(true);
  vi.spyOn(notificationService, 'notify').mockResolvedValue(undefined);
});

describe('getPatientPhotos — quién ve qué', () => {
  const compartida = foto({ uploadedBy: PACIENTE, visibility: 'shared' });
  const privada = foto({ uploadedBy: PACIENTE, visibility: 'private' });
  const delPersonal = foto({ uploadedBy: PROF_A, visibility: 'shared' });

  const listar = async (user) => {
    mockFotosEnBase([compartida, privada, delPersonal]);
    const res = fakeRes();
    await getPatientPhotos({ user, params: { patientId: PACIENTE.toString() } }, res);
    return res;
  };

  it('el paciente ve las suyas (compartidas y privadas) y las que subió el personal', async () => {
    const res = await listar(paciente);
    expect(res.body.data.map((f) => f.id)).toEqual([compartida._id, privada._id, delPersonal._id]);
  });

  it('EL PROFESIONAL ASIGNADO NO VE la foto privada del paciente', async () => {
    const res = await listar(profA);
    const ids = res.body.data.map((f) => f.id);
    expect(ids).toContain(compartida._id);
    expect(ids).toContain(delPersonal._id);
    expect(ids).not.toContain(privada._id);
  });

  it('el admin ve todas, incluida la privada', async () => {
    const res = await listar(admin);
    expect(res.body.data).toHaveLength(3);
  });

  it('cada foto trae una URL firmada y nunca la clave interna del bucket', async () => {
    const res = await listar(paciente);
    expect(res.body.data[0].url).toBe('https://r2.example/firmada');
    expect(JSON.stringify(res.body)).not.toMatch(/storageKey|photos\//);
  });

  it('sin almacenamiento configurado: 503', async () => {
    storageService.isStorageConfigured.mockReturnValue(false);
    const res = fakeRes();
    await getPatientPhotos({ user: paciente, params: { patientId: PACIENTE.toString() } }, res);
    expect(res.statusCode).toBe(503);
  });
});

describe('uploadPhoto', () => {
  const subir = async (user, { file = archivo(), body = {} } = {}) => {
    const create = vi.spyOn(ProgressPhoto, 'create').mockResolvedValue({ _id: nuevoId() });
    const res = fakeRes();
    await uploadPhoto({ user, params: { patientId: PACIENTE.toString() }, file, body }, res);
    return { res, create };
  };

  it('el paciente sube una foto compartida por defecto y se avisa a su profesional', async () => {
    const { res, create } = await subir(paciente);

    expect(res.statusCode).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({ patient: PACIENTE, uploadedBy: PACIENTE, visibility: 'shared', mimeType: 'image/jpeg' });
    expect(storageService.uploadObject).toHaveBeenCalledTimes(1);
    expect(notificationService.notify).toHaveBeenCalledTimes(1);
  });

  it('el paciente elige "solo yo": se guarda privada y NO se avisa al profesional', async () => {
    const { res, create } = await subir(paciente, { body: { visibility: 'private' } });

    expect(res.statusCode).toBe(201);
    expect(create.mock.calls[0][0].visibility).toBe('private');
    expect(notificationService.notify).not.toHaveBeenCalled();
  });

  it('lo que sube el personal es SIEMPRE compartido, aunque pida privado', async () => {
    const { create } = await subir(profA, { body: { visibility: 'private' } });

    expect(create.mock.calls[0][0].visibility).toBe('shared');
    expect(notificationService.notify).not.toHaveBeenCalled();
  });

  it('un PDF se rechaza: solo se aceptan fotos JPG o PNG', async () => {
    const { res, create } = await subir(paciente, { file: archivo(PDF) });

    expect(res.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
    expect(storageService.uploadObject).not.toHaveBeenCalled();
  });

  it('posición, visibilidad y fecha inválidas se rechazan antes de subir nada', async () => {
    for (const body of [{ position: 'techo' }, { visibility: 'publica' }, { takenAt: new Date(Date.now() + 30 * 864e5).toISOString() }]) {
      const { res } = await subir(paciente, { body });
      expect(res.statusCode).toBe(400);
    }
    expect(storageService.uploadObject).not.toHaveBeenCalled();
  });

  it('sin archivo: 400. Sin almacenamiento: 503', async () => {
    const sinArchivo = await subir(paciente, { file: null });
    expect(sinArchivo.res.statusCode).toBe(400);

    storageService.isStorageConfigured.mockReturnValue(false);
    const sinR2 = await subir(paciente);
    expect(sinR2.res.statusCode).toBe(503);
  });

  it('si falla el registro en la base, la foto no queda huérfana en R2', async () => {
    vi.spyOn(ProgressPhoto, 'create').mockRejectedValue(new Error('db caída'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = fakeRes();

    await uploadPhoto({ user: paciente, params: { patientId: PACIENTE.toString() }, file: archivo(), body: {} }, res);

    expect(res.statusCode).toBe(500);
    expect(storageService.deleteObject).toHaveBeenCalledTimes(1);
  });
});

describe('requireActivePlanToUpload', () => {
  it('paciente con plan vencido: 403 con código para mostrar WhatsApp', async () => {
    clientPlanService.hasActivePlan.mockResolvedValue(false);
    const res = fakeRes();
    const next = vi.fn();

    await requireActivePlanToUpload({ user: paciente }, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('NO_ACTIVE_PLAN_SESSIONS');
    expect(next).not.toHaveBeenCalled();
  });

  it('el personal no tiene esa restricción', async () => {
    clientPlanService.hasActivePlan.mockResolvedValue(false);
    const next = vi.fn();

    await requireActivePlanToUpload({ user: profA }, fakeRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('updatePhoto / deletePhoto', () => {
  const pedido = (user, f, body = {}) => ({ user, params: { id: f._id.toString() }, body });

  it('el paciente cambia su foto de compartida a "solo yo"', async () => {
    const f = foto();
    vi.spyOn(ProgressPhoto, 'findById').mockReturnValue(query(f));
    const res = fakeRes();

    await updatePhoto(pedido(paciente, f, { visibility: 'private' }), res);

    expect(res.statusCode ?? 200).toBe(200);
    expect(f.visibility).toBe('private');
    expect(f.save).toHaveBeenCalled();
  });

  it('el personal no puede ocultarle una foto al propio paciente: la visibilidad se ignora', async () => {
    const f = foto({ uploadedBy: PROF_A, visibility: 'shared' });
    vi.spyOn(ProgressPhoto, 'findById').mockReturnValue(query(f));

    await updatePhoto(pedido(profA, f, { visibility: 'private', note: 'frontal' }), fakeRes());

    expect(f.visibility).toBe('shared');
    expect(f.note).toBe('frontal');
  });

  it('un profesional NO modifica la foto de un paciente aunque la vea (403)', async () => {
    const f = foto({ visibility: 'shared' });
    vi.spyOn(ProgressPhoto, 'findById').mockReturnValue(query(f));
    const res = fakeRes();

    await updatePhoto(pedido(profA, f, { note: 'x' }), res);

    expect(res.statusCode).toBe(403);
    expect(f.save).not.toHaveBeenCalled();
  });

  it('una foto privada: el profesional asignado recibe 404 al editarla o borrarla (ni sabe que existe)', async () => {
    const f = foto({ visibility: 'private' });
    vi.spyOn(ProgressPhoto, 'findById').mockReturnValue(query(f));

    const resPut = fakeRes();
    await updatePhoto(pedido(profA, f, { note: 'x' }), resPut);
    const resDel = fakeRes();
    await deletePhoto(pedido(profA, f), resDel);

    expect(resPut.statusCode).toBe(404);
    expect(resDel.statusCode).toBe(404);
    expect(f.deleteOne).not.toHaveBeenCalled();
    expect(storageService.deleteObject).not.toHaveBeenCalled();
  });

  it('un profesional de OTRO paciente tampoco la ve: 404', async () => {
    const f = foto({ visibility: 'shared' });
    vi.spyOn(ProgressPhoto, 'findById').mockReturnValue(query(f));
    const res = fakeRes();

    await deletePhoto(pedido(profB, f), res);

    expect(res.statusCode).toBe(404);
  });

  it('el paciente borra su foto: se elimina de R2 y de la base (aunque el plan esté vencido)', async () => {
    clientPlanService.hasActivePlan.mockResolvedValue(false);
    const f = foto();
    vi.spyOn(ProgressPhoto, 'findById').mockReturnValue(query(f));
    const res = fakeRes();

    await deletePhoto(pedido(paciente, f), res);

    expect(res.statusCode ?? 200).toBe(200);
    expect(storageService.deleteObject).toHaveBeenCalledWith(f.storageKey);
    expect(f.deleteOne).toHaveBeenCalled();
  });

  it('el admin puede borrar cualquiera, incluso una privada', async () => {
    const f = foto({ visibility: 'private' });
    vi.spyOn(ProgressPhoto, 'findById').mockReturnValue(query(f));
    const res = fakeRes();

    await deletePhoto(pedido(admin, f), res);

    expect(res.statusCode ?? 200).toBe(200);
    expect(f.deleteOne).toHaveBeenCalled();
  });

  it('un profesional no borra la foto compartida de un paciente (la subió el paciente): 403', async () => {
    const f = foto({ visibility: 'shared' });
    vi.spyOn(ProgressPhoto, 'findById').mockReturnValue(query(f));
    const res = fakeRes();

    await deletePhoto(pedido(profA, f), res);

    expect(res.statusCode).toBe(403);
    expect(f.deleteOne).not.toHaveBeenCalled();
  });
});
