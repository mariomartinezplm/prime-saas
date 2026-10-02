/**
 * PRUEBAS — archivos médicos en R2 (Paso 21 de BLUEPRINT.md).
 *
 * Sin R2 ni BD reales: el servicio de almacenamiento se simula, los modelos se
 * espían con vi.spyOn. La URL firmada sí se genera de verdad (es un cálculo
 * local, no hace llamadas de red).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import ClientFile from '../models/ClientFile.js';
import User from '../models/User.js';
import { detectFileType } from '../utils/fileType.js';
import {
  uploadFile,
  getPatientFiles,
  getDownloadUrl,
  deleteFile,
  requireActivePlanToUpload
} from '../controllers/fileController.js';

vi.mock('../services/clientPlanService.js', () => ({ hasActivePlan: vi.fn() }));
vi.mock('../services/storageService.js', () => ({
  isStorageConfigured: vi.fn(() => true),
  uploadObject: vi.fn(async () => {}),
  getSignedDownloadUrl: vi.fn(async () => 'https://signed.example/archivo?X-Amz-Expires=300'),
  deleteObject: vi.fn(async () => {}),
  SIGNED_URL_TTL_SECONDS: 300
}));
import { hasActivePlan } from '../services/clientPlanService.js';
import { isStorageConfigured, uploadObject, getSignedDownloadUrl, deleteObject } from '../services/storageService.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(50)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(50)]); // cabecera de un ejecutable de Windows

const multerFile = (buffer, originalname = 'examen.pdf') => ({ buffer, originalname, size: buffer.length });

const withSelect = (value) => ({ select: vi.fn().mockResolvedValue(value) });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(isStorageConfigured).mockReturnValue(true);
  vi.mocked(uploadObject).mockClear();
  vi.mocked(deleteObject).mockClear();
  vi.mocked(getSignedDownloadUrl).mockClear();
});

describe('detectFileType — tipo real por contenido', () => {
  it('reconoce PDF, JPG y PNG', () => {
    expect(detectFileType(PDF)).toEqual({ mimeType: 'application/pdf', ext: 'pdf' });
    expect(detectFileType(JPG)).toEqual({ mimeType: 'image/jpeg', ext: 'jpg' });
    expect(detectFileType(PNG)).toEqual({ mimeType: 'image/png', ext: 'png' });
  });

  it('rechaza un ejecutable, texto y buffers vacíos', () => {
    expect(detectFileType(EXE)).toBeNull();
    expect(detectFileType(Buffer.from('hola'))).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
    expect(detectFileType(undefined)).toBeNull();
  });
});

describe('POST /files/patient/:patientId — subir', () => {
  const setup = (buffer, overrides = {}) => {
    const patientId = nuevoId();
    vi.spyOn(User, 'findById').mockReturnValue(withSelect({ _id: patientId, role: 'patient' }));
    const createSpy = vi.spyOn(ClientFile, 'create').mockImplementation(async (data) => ({
      _id: nuevoId(),
      createdAt: new Date(),
      ...data
    }));
    const uploaderId = nuevoId();
    const req = {
      user: { _id: uploaderId, role: 'professional' },
      params: { patientId: patientId.toString() },
      body: {},
      file: multerFile(buffer),
      ...overrides
    };
    return { req, res: fakeRes(), createSpy, patientId, uploaderId };
  };

  it('PDF válido: se guarda en R2 con key patients/<id>/<uuid>.pdf y se crea el ClientFile (201)', async () => {
    const { req, res, createSpy, patientId } = setup(PDF);
    req.body = { description: 'Resonancia de rodilla' };

    await uploadFile(req, res);

    expect(res.statusCode).toBe(201);
    const [key, body, contentType] = vi.mocked(uploadObject).mock.calls[0];
    expect(key).toMatch(new RegExp(`^patients/${patientId}/[0-9a-f-]{36}\\.pdf$`));
    expect(body).toBe(PDF);
    expect(contentType).toBe('application/pdf');
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      patient: patientId,
      mimeType: 'application/pdf',
      storageKey: key,
      description: 'Resonancia de rodilla'
    }));
  });

  it('la respuesta nunca incluye la storageKey', async () => {
    const { req, res } = setup(PNG);
    await uploadFile(req, res);
    expect(res.statusCode).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('storageKey');
    expect(JSON.stringify(res.body)).not.toContain('patients/');
  });

  it('un .exe renombrado a .pdf se rechaza con 400 y NO llega a R2', async () => {
    const { req, res, createSpy } = setup(EXE);
    req.file = multerFile(EXE, 'informe.pdf');
    req.file.mimetype = 'application/pdf';

    await uploadFile(req, res);

    expect(res.statusCode).toBe(400);
    expect(uploadObject).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('sin archivo adjunto: 400', async () => {
    const { req, res } = setup(PDF);
    req.file = undefined;
    await uploadFile(req, res);
    expect(res.statusCode).toBe(400);
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it('si R2 no está configurado: 503, sin intentar subir', async () => {
    vi.mocked(isStorageConfigured).mockReturnValue(false);
    const { req, res } = setup(PDF);
    await uploadFile(req, res);
    expect(res.statusCode).toBe(503);
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it('si la base falla después de subir, borra el archivo huérfano de R2', async () => {
    const { req, res, createSpy } = setup(PDF);
    createSpy.mockRejectedValue(new Error('db caída'));
    await uploadFile(req, res);
    expect(res.statusCode).toBe(500);
    expect(deleteObject).toHaveBeenCalledWith(vi.mocked(uploadObject).mock.calls[0][0]);
  });

  it('el destino no es un paciente: 404', async () => {
    const { req, res } = setup(PDF);
    vi.spyOn(User, 'findById').mockReturnValue(withSelect({ _id: nuevoId(), role: 'admin' }));
    await uploadFile(req, res);
    expect(res.statusCode).toBe(404);
    expect(uploadObject).not.toHaveBeenCalled();
  });
});

describe('requireActivePlanToUpload — paciente solo sube con plan activo', () => {
  it('paciente sin plan activo: 403 y no continúa', async () => {
    vi.mocked(hasActivePlan).mockResolvedValue(false);
    const res = fakeRes();
    const next = vi.fn();
    await requireActivePlanToUpload({ user: { _id: nuevoId(), role: 'patient' } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('paciente con plan activo: continúa', async () => {
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    const next = vi.fn();
    await requireActivePlanToUpload({ user: { _id: nuevoId(), role: 'patient' } }, fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('el staff no necesita plan: continúa sin consultarlo', async () => {
    vi.mocked(hasActivePlan).mockClear();
    const next = vi.fn();
    await requireActivePlanToUpload({ user: { _id: nuevoId(), role: 'professional' } }, fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(hasActivePlan).not.toHaveBeenCalled();
  });
});

describe('GET /files/:id/download — URL firmada', () => {
  const fileOf = (patientId, uploadedBy = nuevoId()) => ({
    _id: nuevoId(),
    patient: patientId,
    uploadedBy,
    fileName: 'Resonancia.pdf',
    mimeType: 'application/pdf',
    storageKey: `patients/${patientId}/abc.pdf`
  });

  it('el dueño obtiene una URL firmada que vence en 300 s', async () => {
    const patientId = nuevoId();
    vi.spyOn(ClientFile, 'findById').mockReturnValue(withSelect(fileOf(patientId)));
    const res = fakeRes();

    await getDownloadUrl({ user: { _id: patientId, role: 'patient' }, params: { id: 'x' } }, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.expiresIn).toBe(300);
    expect(getSignedDownloadUrl).toHaveBeenCalledWith(
      `patients/${patientId}/abc.pdf`,
      { fileName: 'Resonancia.pdf', contentType: 'application/pdf' }
    );
  });

  it('IDOR: un paciente que pide el archivo de OTRO paciente recibe 404', async () => {
    vi.spyOn(ClientFile, 'findById').mockReturnValue(withSelect(fileOf(nuevoId())));
    const res = fakeRes();

    await getDownloadUrl({ user: { _id: nuevoId(), role: 'patient' }, params: { id: 'x' } }, res);

    expect(res.statusCode).toBe(404);
    expect(getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('IDOR: un profesional NO asignado recibe 404', async () => {
    const patientId = nuevoId();
    vi.spyOn(ClientFile, 'findById').mockReturnValue(withSelect(fileOf(patientId)));
    vi.spyOn(User, 'findById').mockReturnValue(withSelect({ assignedProfessionalId: nuevoId(), role: 'patient' }));
    const res = fakeRes();

    await getDownloadUrl({ user: { _id: nuevoId(), role: 'professional' }, params: { id: 'x' } }, res);

    expect(res.statusCode).toBe(404);
    expect(getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('archivo inexistente: 404', async () => {
    vi.spyOn(ClientFile, 'findById').mockReturnValue(withSelect(null));
    const res = fakeRes();
    await getDownloadUrl({ user: { _id: nuevoId(), role: 'admin' }, params: { id: 'x' } }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /files/:id', () => {
  const setup = (user, { patientId = nuevoId(), uploadedBy = nuevoId() } = {}) => {
    const deleteOne = vi.fn().mockResolvedValue({});
    const file = {
      _id: nuevoId(),
      patient: patientId,
      uploadedBy,
      storageKey: `patients/${patientId}/abc.pdf`,
      deleteOne
    };
    vi.spyOn(ClientFile, 'findById').mockReturnValue(withSelect(file));
    return { req: { user, params: { id: 'x' } }, res: fakeRes(), deleteOne, file };
  };

  it('quien lo subió puede borrarlo: se elimina de R2 y de la base', async () => {
    const patientId = nuevoId();
    const { req, res, deleteOne, file } = setup({ _id: patientId, role: 'patient' }, { patientId, uploadedBy: patientId });
    await deleteFile(req, res);
    expect(res.body.success).toBe(true);
    expect(deleteObject).toHaveBeenCalledWith(file.storageKey);
    expect(deleteOne).toHaveBeenCalled();
  });

  it('el admin puede borrar archivos de cualquiera', async () => {
    const { req, res, deleteOne } = setup({ _id: nuevoId(), role: 'admin' });
    await deleteFile(req, res);
    expect(res.body.success).toBe(true);
    expect(deleteOne).toHaveBeenCalled();
  });

  it('el paciente NO puede borrar lo que subió su profesional (403)', async () => {
    const patientId = nuevoId();
    const { req, res, deleteOne } = setup({ _id: patientId, role: 'patient' }, { patientId, uploadedBy: nuevoId() });
    await deleteFile(req, res);
    expect(res.statusCode).toBe(403);
    expect(deleteObject).not.toHaveBeenCalled();
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('un paciente ajeno recibe 404', async () => {
    const { req, res } = setup({ _id: nuevoId(), role: 'patient' });
    await deleteFile(req, res);
    expect(res.statusCode).toBe(404);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('si R2 falla al borrar, el registro se conserva para reintentar', async () => {
    const { req, res, deleteOne } = setup({ _id: nuevoId(), role: 'admin' });
    vi.mocked(deleteObject).mockRejectedValueOnce(new Error('r2 caído'));
    await deleteFile(req, res);
    expect(res.statusCode).toBe(500);
    expect(deleteOne).not.toHaveBeenCalled();
  });
});

describe('GET /files/patient/:patientId — listado', () => {
  it('nunca pide la storageKey (el campo es select:false)', async () => {
    const chain = { sort: vi.fn().mockReturnThis(), populate: vi.fn().mockResolvedValue([]) };
    const findSpy = vi.spyOn(ClientFile, 'find').mockReturnValue(chain);
    const res = fakeRes();

    await getPatientFiles({ params: { patientId: 'p1' } }, res);

    expect(findSpy).toHaveBeenCalledWith({ patient: 'p1' });
    expect(res.body.success).toBe(true);
    expect(ClientFile.schema.path('storageKey').options.select).toBe(false);
  });
});

describe('storageService — URL firmada real (cálculo local)', () => {
  it('genera una URL de R2 que vence en 300 segundos', async () => {
    vi.resetModules();
    vi.doUnmock('../services/storageService.js');
    process.env.R2_ACCOUNT_ID = 'cuentaprueba';
    process.env.R2_ACCESS_KEY_ID = 'AKIAPRUEBA';
    process.env.R2_SECRET_ACCESS_KEY = 'secretoprueba';
    process.env.R2_BUCKET_NAME = 'bucket-prueba';

    const real = await vi.importActual('../services/storageService.js');
    const url = await real.getSignedDownloadUrl('patients/p1/abc.pdf', { fileName: 'Exámen.pdf', contentType: 'application/pdf' });

    expect(url).toContain('cuentaprueba.r2.cloudflarestorage.com');
    expect(url).toContain('bucket-prueba');
    expect(url).toContain('X-Amz-Expires=300');
    expect(url).toContain('X-Amz-Signature=');

    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
  });
});
