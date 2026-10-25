/**
 * PRUEBAS — foto de perfil: limpieza del JPEG (sin EXIF/ubicación) y endpoints de la propia cuenta (subir, ver, quitar).
 * Sin base real ni R2: se simulan el modelo y el almacenamiento.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { sanitizeJpeg, JpegError } from '../utils/jpegSanitize.js';

vi.mock('../services/storageService.js', () => ({
  isStorageConfigured: vi.fn(() => true),
  uploadObject: vi.fn(async () => {}),
  getObjectBuffer: vi.fn(async () => Buffer.from('JPEGBYTES')),
  deleteObject: vi.fn(async () => {})
}));
import * as storage from '../services/storageService.js';
import { uploadAvatar, getAvatar, deleteAvatar } from '../controllers/avatarController.js';
import { getMe } from '../controllers/authController.js';

const u16 = (n) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
const seg = (marker, body) => Buffer.concat([Buffer.from([0xff, marker]), u16(body.length + 2), body]);
const sof = (w, h, comps = 3) => seg(0xc0, Buffer.concat([Buffer.from([8]), u16(h), u16(w), Buffer.from([comps]), Buffer.from(Array.from({ length: comps }, (_, i) => [i + 1, 0x11, 0]).flat())]));
const EXIF = seg(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from('GPSLatitude=-41.4717;Make=Apple;Model=iPhone')]));
const COMMENT = seg(0xfe, Buffer.from('hecho en casa'));
const ICC = seg(0xe2, Buffer.from('ICC_PROFILE\0perfil'));
const JFIF = seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'));
const DQT = seg(0xdb, Buffer.alloc(65, 1));
const SOS = seg(0xda, Buffer.from([3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0]));
const DATA = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9a]);
const jpeg = ({ w = 512, h = 512, comps = 3, extra = [] } = {}) =>
  Buffer.concat([Buffer.from([0xff, 0xd8]), JFIF, ...extra, DQT, sof(w, h, comps), SOS, DATA, Buffer.from([0xff, 0xd9])]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);

describe('limpieza del JPEG', () => {
  it('quita EXIF (ubicación y modelo del teléfono), comentarios y perfiles, y conserva la imagen', () => {
    const original = jpeg({ extra: [EXIF, COMMENT, ICC] });
    expect(original.includes(Buffer.from('GPSLatitude'))).toBe(true);
    const { buffer, width, height } = sanitizeJpeg(original);
    expect(width).toBe(512);
    expect(height).toBe(512);
    expect(buffer.includes(Buffer.from('GPSLatitude'))).toBe(false);
    expect(buffer.includes(Buffer.from('iPhone'))).toBe(false);
    expect(buffer.includes(Buffer.from('hecho en casa'))).toBe(false);
    expect(buffer.includes(Buffer.from('ICC_PROFILE'))).toBe(false);
    expect(buffer.includes(DATA)).toBe(true);
    expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(buffer.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
    expect(sanitizeJpeg(buffer).width).toBe(512); // lo limpio sigue siendo un JPEG válido
  });

  it('rechaza lo que no es JPEG, lo dañado, lo muy chico, lo muy grande y los colores raros', () => {
    expect(() => sanitizeJpeg(PNG)).toThrow(JpegError);
    expect(() => sanitizeJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00]))).toThrow(JpegError);
    expect(() => sanitizeJpeg(jpeg({ w: 20, h: 20 }))).toThrow(/pequeña/);
    expect(() => sanitizeJpeg(jpeg({ w: 4000, h: 3000 }))).toThrow(/grande/);
    expect(() => sanitizeJpeg(jpeg({ comps: 4 }))).toThrow(/color/);
    expect(() => sanitizeJpeg(Buffer.concat([Buffer.from([0xff, 0xd8]), JFIF, DQT, SOS, DATA]))).toThrow(JpegError); // sin fin de imagen
  });
});

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  statusCode: 200,
  headers: {},
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; }),
  set: vi.fn(function (h) { Object.assign(this.headers, h); return this; }),
  type: vi.fn(function () { return this; }),
  send: vi.fn(function (body) { this.sent = body; return this; }),
  end: vi.fn(function () { return this; })
});
const query = (value) => ({ select: () => query(value), then: (ok, no) => Promise.resolve(value).then(ok, no) });

const ME = nuevoId();
const OTHER = nuevoId();

describe('endpoints de la foto de perfil', () => {
  let me;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.isStorageConfigured).mockReturnValue(true);
    me = { _id: ME, avatarKey: `avatars/${ME}/vieja.jpg`, avatarUpdatedAt: new Date('2026-10-01T00:00:00Z') };
    vi.spyOn(User, 'findById').mockImplementation((id) => query(String(id) === String(ME) ? me : null));
    vi.spyOn(User, 'updateOne').mockResolvedValue({});
  });
  const req = (extra = {}) => ({ user: { _id: ME, role: 'patient' }, body: {}, headers: {}, file: { buffer: jpeg({ extra: [EXIF] }), size: 999 }, ...extra });

  it('sube SU foto limpia, la guarda en su carpeta privada y borra la anterior', async () => {
    const res = fakeRes();
    await uploadAvatar(req(), res);
    expect(res.statusCode).toBe(200);
    const [key, body, contentType] = storage.uploadObject.mock.calls[0];
    expect(key).toMatch(new RegExp(`^avatars/${ME}/[0-9a-f-]+\\.jpg$`));
    expect(contentType).toBe('image/jpeg');
    expect(body.includes(Buffer.from('GPSLatitude'))).toBe(false);
    expect(User.updateOne.mock.calls[0][0]).toEqual({ _id: ME });
    expect(User.updateOne.mock.calls[0][1].$set.avatarKey).toBe(key);
    expect(storage.deleteObject).toHaveBeenCalledWith(`avatars/${ME}/vieja.jpg`);
    expect(res.body.data.avatarUpdatedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(res.body)).not.toContain('avatars/');
  });

  it('ignora cualquier id que mande el cliente: nunca toca la cuenta de otra persona', async () => {
    const res = fakeRes();
    await uploadAvatar(req({ body: { userId: String(OTHER) }, params: { id: String(OTHER) } }), res);
    expect(User.findById).toHaveBeenCalledWith(ME);
    expect(User.updateOne.mock.calls[0][0]).toEqual({ _id: ME });
  });

  it('rechaza PNG, archivos disfrazados y fotos sin pasar por la limpieza, sin guardar nada', async () => {
    for (const buffer of [PNG, Buffer.from('MZ\x90\0 programa.exe'), jpeg({ w: 4000, h: 4000 })]) {
      const res = fakeRes();
      await uploadAvatar(req({ file: { buffer, size: buffer.length, mimetype: 'image/jpeg', originalname: 'foto.jpg' } }), res);
      expect(res.statusCode).toBe(400);
    }
    const sinArchivo = fakeRes();
    await uploadAvatar(req({ file: undefined }), sinArchivo);
    expect(sinArchivo.statusCode).toBe(400);
    expect(storage.uploadObject).not.toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it('si no se puede anotar en la base, borra el archivo recién subido y no deja la foto vieja borrada', async () => {
    User.updateOne.mockRejectedValue(new Error('base caída'));
    const res = fakeRes();
    await uploadAvatar(req(), res);
    expect(res.statusCode).toBe(500);
    const uploaded = storage.uploadObject.mock.calls[0][0];
    expect(storage.deleteObject).toHaveBeenCalledWith(uploaded);
    expect(storage.deleteObject).not.toHaveBeenCalledWith(`avatars/${ME}/vieja.jpg`);
  });

  it('sin almacenamiento configurado responde 503 con un mensaje claro', async () => {
    vi.mocked(storage.isStorageConfigured).mockReturnValue(false);
    const res = fakeRes();
    await uploadAvatar(req(), res);
    expect(res.statusCode).toBe(503);
  });

  it('ver: entrega solo la foto de quien pregunta, privada y siempre revalidada; si no cambió, 304', async () => {
    const res = fakeRes();
    await getAvatar(req(), res);
    expect(res.sent).toEqual(Buffer.from('JPEGBYTES'));
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(`avatars/${ME}/vieja.jpg`);
    expect(res.headers['Cache-Control']).toBe('private, no-cache');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');

    const again = fakeRes();
    await getAvatar(req({ headers: { 'if-none-match': res.headers.ETag } }), again);
    expect(again.statusCode).toBe(304);
    expect(storage.getObjectBuffer).toHaveBeenCalledTimes(1);
  });

  it('ver: quien no tiene foto recibe 404', async () => {
    me.avatarKey = undefined;
    const res = fakeRes();
    await getAvatar(req(), res);
    expect(res.statusCode).toBe(404);
  });

  it('quitar: borra el archivo y deja a la persona sin foto', async () => {
    const res = fakeRes();
    await deleteAvatar(req(), res);
    expect(res.statusCode).toBe(200);
    expect(User.updateOne).toHaveBeenCalledWith({ _id: ME }, { $unset: { avatarKey: 1, avatarUpdatedAt: 1 } });
    expect(storage.deleteObject).toHaveBeenCalledWith(`avatars/${ME}/vieja.jpg`);
  });
});

describe('la ruta de una foto nunca sale por la API', () => {
  it('toJSON no incluye avatarKey (sí avatarUpdatedAt)', () => {
    const user = new User({ firstName: 'Ana', lastName: 'P', email: 'a@ejemplo.invalid', password: 'x', role: 'patient', avatarKey: 'avatars/x/y.jpg', avatarUpdatedAt: new Date() });
    const json = user.toJSON();
    expect(json.avatarKey).toBeUndefined();
    expect(json.avatarUpdatedAt).toBeInstanceOf(Date);
  });
});

describe('/auth/me entrega lo que el menú necesita', () => {
  it('incluye la estrella de fundador (solo si es verdad) y la fecha de la foto, nunca su ruta', async () => {
    for (const isFounder of [true, false]) {
      const doc = { _id: ME, firstName: 'Ana', lastName: 'P', role: 'professional', isFounder, avatarUpdatedAt: new Date('2026-10-01'), avatarKey: 'avatars/secreto.jpg' };
      vi.spyOn(User, 'findById').mockResolvedValue(doc);
      const res = fakeRes();
      await getMe({ user: { _id: ME } }, res);
      expect(res.body.data.user.isFounder).toBe(isFounder);
      expect(res.body.data.user.avatarUpdatedAt).toEqual(doc.avatarUpdatedAt);
      expect(JSON.stringify(res.body)).not.toContain('secreto');
    }
  });

  it('un usuario sin la marca no aparece como fundador (ni un valor raro)', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ME, role: 'professional', isFounder: 'si' });
    const res = fakeRes();
    await getMe({ user: { _id: ME } }, res);
    expect(res.body.data.user.isFounder).toBe(false);
  });
});
