/**
 * PRUEBAS — biblioteca de ejercicios compartida: se cruzan los ejercicios de todas las personas, solo nombre y categoría,
 * y solo entran los que usan al menos 2 personas distintas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import ExerciseProgress from '../models/Exercise.js';
import { exerciseLibrary } from '../services/exerciseNames.js';
import { getExerciseLibrary } from '../controllers/exerciseController.js';
import router from '../routes/exerciseRoutes.js';

const id = () => new mongoose.Types.ObjectId();
const [a, b, c] = [id(), id(), id()];
const group = (name, patients, category = 'fuerza') => ({ _id: name, patients, category });
const run = (rows, opts) => {
  vi.spyOn(ExerciseProgress, 'aggregate').mockResolvedValue(rows);
  return exerciseLibrary(opts);
};

describe('biblioteca de ejercicios', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('cruza a las personas: escrituras distintas del mismo ejercicio suman y gana la más usada', async () => {
    const list = await run([group('Sentadilla búlgara', [a, b]), group('sentadilla bulgara ', [c]), group('press banca', [a, b, c])]);
    expect(list.map((e) => e.key)).toEqual(['press banca', 'sentadilla bulgara']);
    expect(list[1].name).toBe('Sentadilla búlgara');
  });

  it('un ejercicio de una sola persona NO entra (podría llevar un dato personal)', async () => {
    const list = await run([group('Rehab hombro de Juan', [a]), group('Peso muerto', [a, b])]);
    expect(list.map((e) => e.name)).toEqual(['Peso muerto']);
  });

  it('solo devuelve nombre, categoría y clave: nada de personas ni cantidades', async () => {
    const [item] = await run([group('Remo', [a, b], 'fuerza')]);
    expect(Object.keys(item).sort()).toEqual(['category', 'key', 'name']);
  });

  it('nunca une ejercicios distintos aunque se parezcan, e ignora nombres vacíos', async () => {
    const list = await run([group('Sentadilla trasera', [a, b]), group('Sentadilla búlgara', [a, b]), group('  ', [a, b])]);
    expect(list.map((e) => e.key).sort()).toEqual(['sentadilla bulgara', 'sentadilla trasera']);
  });

  it('el endpoint responde con la lista y la ruta exige sesión', async () => {
    vi.spyOn(ExerciseProgress, 'aggregate').mockResolvedValue([group('Remo', [a, b])]);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await getExerciseLibrary({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.exercises).toHaveLength(1);
    const names = router.stack.filter((l) => l.route?.path === '/library').map((l) => l.route.path);
    expect(names).toEqual(['/library']);
    expect(router.stack[0].name).toBe('protect');
  });
});
