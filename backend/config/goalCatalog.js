/**
 * CATÁLOGO DE OBJETIVOS PRIME (versión 1)
 *
 * Son DATOS, no condiciones desperdigadas por la pantalla: la app (servidor y navegador) lee este catálogo para saber
 * qué categorías existen, qué indicadores admite cada una, en qué unidad se mide, de dónde salen los registros y si
 * necesita que un profesional valide la meta.
 *
 *  - Los `id` son estables: se guardan en cada objetivo del paciente. Se puede cambiar un nombre; NUNCA un id.
 *  - Para agregar o cambiar una categoría se edita este archivo y se sube `GOAL_CATALOG_VERSION` (cada objetivo guarda
 *    con qué versión se creó).
 *  - Un indicador NO inventa datos: o se alimenta de un registro que el centro ya guarda (ejercicios, mediciones,
 *    EVA) o es un registro manual que queda identificado como autorreporte o como evaluación del profesional.
 *
 * Fuentes (`source`):
 *   exercise_load        mayor carga (kg) de un ejercicio, por día          ← historial de Ejercicios
 *   exercise_reps        repeticiones máximas con UNA carga concreta         ← historial de Ejercicios
 *   measurement_perimeter perímetro en cm (un lado, una zona)                ← Mediciones
 *   measurement_field    peso, % de grasa o % de masa muscular               ← Mediciones
 *   jump_test            test de salto en cm                                 ← Mediciones
 *   eva                  dolor 0–10 de UNA zona                              ← EVA
 *   checkin              registro manual (autorreporte o profesional)        ← GoalCheckin
 */

export const GOAL_CATALOG_VERSION = 1;

export const DIRECTIONS = ['increase', 'decrease', 'maintain'];
export const SUPERVISION = ['none', 'recommended', 'required'];
export const MAX_ACTIVE_GOALS = 3; // 1 principal + 2 secundarios
export const MAX_INDICATORS_PER_GOAL = 5;

const side = { key: 'side', type: 'enum', label: 'Lado', required: true, options: [{ value: 'left', label: 'Izquierdo' }, { value: 'right', label: 'Derecho' }] };
const testName = { key: 'testName', type: 'text', label: 'Nombre de la prueba', required: true, max: 60 };

// Zonas de dolor: son las mismas que usa el registro de EVA
export const EVA_AREAS = [
  ['cabeza', 'Cabeza'], ['cuello', 'Cuello'], ['hombro-izquierdo', 'Hombro izquierdo'], ['hombro-derecho', 'Hombro derecho'],
  ['codo-izquierdo', 'Codo izquierdo'], ['codo-derecho', 'Codo derecho'], ['muneca-izquierda', 'Muñeca izquierda'], ['muneca-derecha', 'Muñeca derecha'],
  ['espalda-alta', 'Espalda alta'], ['espalda-media', 'Espalda media'], ['espalda-baja', 'Espalda baja'], ['lumbar', 'Lumbar'],
  ['cadera-izquierda', 'Cadera izquierda'], ['cadera-derecha', 'Cadera derecha'], ['rodilla-izquierda', 'Rodilla izquierda'], ['rodilla-derecha', 'Rodilla derecha'],
  ['tobillo-izquierdo', 'Tobillo izquierdo'], ['tobillo-derecho', 'Tobillo derecho'], ['pie-izquierdo', 'Pie izquierdo'], ['pie-derecho', 'Pie derecho'],
  ['pecho', 'Pecho'], ['abdomen', 'Abdomen'], ['otro', 'Otra zona'],
].map(([value, label]) => ({ value, label }));

const MUSCLE_PERIMETERS = [
  ['bicepFlexedLeft', 'Bíceps contraído izquierdo'], ['bicepFlexedRight', 'Bíceps contraído derecho'],
  ['bicepLeft', 'Bíceps relajado izquierdo'], ['bicepRight', 'Bíceps relajado derecho'],
  ['thighLeft', 'Muslo izquierdo'], ['thighRight', 'Muslo derecho'],
  ['calfLeft', 'Pantorrilla izquierda'], ['calfRight', 'Pantorrilla derecha'],
  ['forearmLeft', 'Antebrazo izquierdo'], ['forearmRight', 'Antebrazo derecho'],
  ['chest', 'Pecho'], ['shoulders', 'Hombros'], ['hips', 'Glúteos / cadera'],
].map(([value, label]) => ({ value, label }));

const JUMP_TESTS = [
  ['cmj', 'Salto con contramovimiento (CMJ)'], ['sj', 'Salto desde sentadilla (SJ)'], ['abalakov', 'Salto Abalakov'],
  ['dropJump', 'Drop jump'], ['horizontalJump', 'Salto horizontal'],
  ['cmjLeftLeg', 'CMJ pierna izquierda'], ['cmjRightLeg', 'CMJ pierna derecha'], ['sjLeftLeg', 'SJ pierna izquierda'], ['sjRightLeg', 'SJ pierna derecha'],
].map(([value, label]) => ({ value, label }));

const TEST_UNITS = ['s', 'min', 'm', 'km', 'cm', 'rep', 'kg', 'puntos'];

/**
 * Indicadores. Campos:
 *   id, label, source, unit (o unitOptions), range {min,max}, directions, defaultDirection,
 *   params: lo que la persona debe elegir además del indicador (ejercicio, lado, zona…),
 *   confirmation {records, minDays}: cuántos registros que cumplan la meta hacen falta, separados por cuántos días, para
 *     dar el objetivo por conseguido (una fluctuación aislada nunca basta en lo que cambia de un día a otro),
 *   origin: 'registro' (viene de un registro del centro) | 'autorreporte' | 'profesional',
 *   professionalEntryOnly: solo el profesional ingresa los valores,
 *   professionalTarget: la meta puede quedar en blanco al crear el objetivo: la define el profesional,
 *   clinical: indicador clínico (presión, glucosa, colesterol): el objetivo siempre pasa por validación profesional,
 *   indirect / note: aviso que se muestra junto al indicador.
 */
const IND = {
  exercise_max_load: {
    id: 'exercise_max_load', label: 'Carga máxima en un ejercicio', source: 'exercise_load', unit: 'kg', range: { min: 0.5, max: 1000 },
    directions: ['increase'], defaultDirection: 'increase', params: [{ key: 'exerciseKey', type: 'exercise', label: 'Ejercicio', required: true }],
    confirmation: { records: 1, minDays: 0 }, origin: 'registro',
    note: 'Se toma la mayor carga que registres en ese ejercicio en un día (solo kilos; las libras no se mezclan).',
  },
  exercise_reps_at_load: {
    id: 'exercise_reps_at_load', label: 'Repeticiones con una carga concreta', source: 'exercise_reps', unit: 'rep', range: { min: 1, max: 500 },
    directions: ['increase'], defaultDirection: 'increase',
    params: [{ key: 'exerciseKey', type: 'exercise', label: 'Ejercicio', required: true }, { key: 'loadKg', type: 'number', label: 'Carga (kg)', required: true, min: 0.5, max: 1000 }],
    confirmation: { records: 1, minDays: 0 }, origin: 'registro',
    note: 'Solo cuentan las series hechas con esa misma carga; las demás cargas no se mezclan.',
  },
  perimeter_muscle: {
    id: 'perimeter_muscle', label: 'Perímetro de una zona muscular', source: 'measurement_perimeter', unit: 'cm', range: { min: 1, max: 300 },
    directions: ['increase', 'maintain'], defaultDirection: 'increase', params: [{ key: 'field', type: 'enum', label: 'Zona medida', required: true, options: MUSCLE_PERIMETERS }],
    confirmation: { records: 2, minDays: 14 }, origin: 'registro', indirect: true,
    note: 'Un perímetro mayor no significa necesariamente más músculo: es un indicador de cambio de tu medida.',
  },
  muscle_mass_pct: {
    id: 'muscle_mass_pct', label: 'Porcentaje de masa muscular', source: 'measurement_field', field: 'muscleMassPercentage', unit: '%', range: { min: 1, max: 100 },
    directions: ['increase', 'maintain'], defaultDirection: 'increase', params: [], confirmation: { records: 2, minDays: 14 }, origin: 'registro',
    note: 'Solo se comparan mediciones hechas con el mismo método.',
  },
  body_weight_complement: {
    id: 'body_weight_complement', label: 'Peso corporal (complemento)', source: 'measurement_field', field: 'weight', unit: 'kg', range: { min: 20, max: 400 },
    directions: ['increase', 'maintain'], defaultDirection: 'increase', params: [], confirmation: { records: 2, minDays: 14 }, origin: 'registro',
    note: 'El peso solo no dice cuánto de ese cambio es músculo.',
  },
  body_weight: {
    id: 'body_weight', label: 'Peso corporal', source: 'measurement_field', field: 'weight', unit: 'kg', range: { min: 20, max: 400 },
    directions: ['decrease', 'maintain'], defaultDirection: 'decrease', params: [], confirmation: { records: 2, minDays: 14 }, origin: 'registro',
  },
  body_fat_pct: {
    id: 'body_fat_pct', label: 'Porcentaje de grasa corporal', source: 'measurement_field', field: 'bodyFatPercentage', unit: '%', range: { min: 1, max: 100 },
    directions: ['decrease', 'maintain'], defaultDirection: 'decrease', params: [], confirmation: { records: 2, minDays: 14 }, origin: 'registro',
    note: 'Solo se comparan mediciones hechas con el mismo método.',
  },
  perimeter_waist: {
    id: 'perimeter_waist', label: 'Perímetro de cintura', source: 'measurement_perimeter', field: 'waist', unit: 'cm', range: { min: 20, max: 300 },
    directions: ['decrease', 'maintain'], defaultDirection: 'decrease', params: [], confirmation: { records: 2, minDays: 14 }, origin: 'registro', indirect: true,
    note: 'La cintura es un indicador indirecto: no mide directamente tu porcentaje de grasa.',
  },
  jump_test: {
    id: 'jump_test', label: 'Test de salto', source: 'jump_test', unit: 'cm', range: { min: 1, max: 300 },
    directions: ['increase'], defaultDirection: 'increase', params: [{ key: 'field', type: 'enum', label: 'Prueba', required: true, options: JUMP_TESTS }],
    confirmation: { records: 1, minDays: 0 }, origin: 'registro',
    note: 'Los test de salto los registra tu profesional.',
  },
  performance_test: {
    id: 'performance_test', label: 'Marca en una prueba concreta', source: 'checkin', unitOptions: TEST_UNITS, range: { min: 0, max: 100000 },
    directions: ['increase', 'decrease'], defaultDirection: 'increase', params: [testName],
    confirmation: { records: 1, minDays: 0 }, origin: 'autorreporte',
    note: 'Elige tú si mejorar es subir (distancia, repeticiones) o bajar (tiempo). Solo se compara la misma prueba.',
  },
  blood_pressure_systolic: {
    clinical: true,
    id: 'blood_pressure_systolic', label: 'Presión arterial sistólica', source: 'checkin', unit: 'mmHg', range: { min: 50, max: 260 },
    directions: ['decrease', 'maintain'], defaultDirection: 'maintain', params: [{ key: 'method', type: 'enum', label: 'Cómo se mide', required: true, options: [{ value: 'home', label: 'En casa' }, { value: 'clinic', label: 'En un centro de salud' }] }],
    confirmation: { records: 2, minDays: 14 }, origin: 'autorreporte', professionalTarget: true,
    note: 'La meta de presión la define tu profesional: no existen valores universales.',
  },
  blood_pressure_diastolic: {
    clinical: true,
    id: 'blood_pressure_diastolic', label: 'Presión arterial diastólica', source: 'checkin', unit: 'mmHg', range: { min: 30, max: 160 },
    directions: ['decrease', 'maintain'], defaultDirection: 'maintain', params: [{ key: 'method', type: 'enum', label: 'Cómo se mide', required: true, options: [{ value: 'home', label: 'En casa' }, { value: 'clinic', label: 'En un centro de salud' }] }],
    confirmation: { records: 2, minDays: 14 }, origin: 'autorreporte', professionalTarget: true,
    note: 'La meta de presión la define tu profesional: no existen valores universales.',
  },
  glucose: {
    clinical: true,
    id: 'glucose', label: 'Glucosa', source: 'checkin', unit: 'mg/dL', range: { min: 20, max: 700 },
    directions: ['decrease', 'maintain'], defaultDirection: 'maintain',
    params: [{ key: 'context', type: 'enum', label: 'Cuándo se mide', required: true, options: [{ value: 'fasting', label: 'En ayunas' }, { value: 'postprandial', label: 'Después de comer' }, { value: 'random', label: 'En cualquier momento' }] },
      { key: 'method', type: 'enum', label: 'Con qué se mide', required: true, options: [{ value: 'lab', label: 'Examen de laboratorio' }, { value: 'glucometer', label: 'Glucómetro' }] }],
    confirmation: { records: 2, minDays: 14 }, origin: 'autorreporte', professionalTarget: true,
    note: 'La meta de glucosa la define tu profesional o tu médico.',
  },
  cholesterol: {
    clinical: true,
    id: 'cholesterol', label: 'Colesterol', source: 'checkin', unit: 'mg/dL', range: { min: 10, max: 1000 },
    directions: ['decrease', 'increase', 'maintain'], defaultDirection: 'maintain',
    params: [{ key: 'analyte', type: 'enum', label: 'Qué fracción', required: true, options: [{ value: 'total', label: 'Colesterol total' }, { value: 'ldl', label: 'LDL' }, { value: 'hdl', label: 'HDL' }, { value: 'triglycerides', label: 'Triglicéridos' }] }],
    confirmation: { records: 1, minDays: 0 }, origin: 'autorreporte', professionalTarget: true,
    note: 'Cada fracción se sigue por separado. La meta la define tu profesional o tu médico.',
  },
  resting_heart_rate: {
    id: 'resting_heart_rate', label: 'Frecuencia cardíaca en reposo', source: 'checkin', unit: 'lpm', range: { min: 25, max: 220 },
    directions: ['decrease', 'maintain'], defaultDirection: 'decrease',
    params: [{ key: 'method', type: 'enum', label: 'Cómo se midió', required: true, options: [{ value: 'manual', label: 'Manual (contando el pulso)' }, { value: 'device', label: 'Con un dispositivo' }] }],
    confirmation: { records: 2, minDays: 14 }, origin: 'autorreporte',
    note: 'Los valores los ingresas tú: son autorreporte, no una medición validada.',
  },
  weekly_activity_minutes: {
    id: 'weekly_activity_minutes', label: 'Minutos de actividad física por semana', source: 'checkin', unit: 'min', range: { min: 0, max: 3000 },
    directions: ['increase', 'maintain'], defaultDirection: 'increase', params: [],
    confirmation: { records: 2, minDays: 7 }, origin: 'autorreporte',
    note: 'Es lo que tú declaras: no reemplaza la asistencia validada de tus sesiones.',
  },
  stress_perceived: {
    id: 'stress_perceived', label: 'Estrés percibido (0 a 10)', source: 'checkin', unit: '/10', range: { min: 0, max: 10 },
    directions: ['decrease', 'maintain'], defaultDirection: 'decrease', params: [],
    confirmation: { records: 2, minDays: 14 }, origin: 'autorreporte',
    note: 'Es tu percepción. Tiene su propia escala y no se mezcla con el Readiness.',
  },
  sleep_hours: {
    id: 'sleep_hours', label: 'Horas de sueño', source: 'checkin', unit: 'h', range: { min: 0, max: 24 },
    directions: ['increase', 'maintain'], defaultDirection: 'increase', params: [],
    confirmation: { records: 2, minDays: 14 }, origin: 'autorreporte',
    note: 'Es lo que tú declaras.',
  },
  posture_self_rating: {
    id: 'posture_self_rating', label: 'Cómo percibo mi postura (0 a 10)', source: 'checkin', unit: '/10', range: { min: 0, max: 10 },
    directions: ['increase', 'maintain'], defaultDirection: 'increase', params: [],
    confirmation: { records: 2, minDays: 14 }, origin: 'autorreporte', professionalTarget: true,
    note: 'Es una percepción tuya: se muestra como tal y no es un diagnóstico.',
  },
  posture_functional_test: {
    id: 'posture_functional_test', label: 'Prueba funcional evaluada por tu kinesiólogo', source: 'checkin', unitOptions: TEST_UNITS, range: { min: 0, max: 100000 },
    directions: ['increase', 'decrease'], defaultDirection: 'increase', params: [testName],
    confirmation: { records: 1, minDays: 0 }, origin: 'profesional', professionalEntryOnly: true, professionalTarget: true,
    note: 'Esta evaluación la registra tu kinesiólogo y se muestra separada de lo que tú declaras.',
  },
  pain_eva: {
    id: 'pain_eva', label: 'Dolor de una zona (EVA 0 a 10)', source: 'eva', unit: '/10', range: { min: 0, max: 10 },
    directions: ['decrease', 'maintain'], defaultDirection: 'decrease', params: [{ key: 'bodyArea', type: 'enum', label: 'Zona del cuerpo', required: true, options: EVA_AREAS }],
    confirmation: { records: 2, minDays: 7 }, origin: 'registro', professionalTarget: true,
    note: 'Usa tus registros de dolor de esa zona. Que el dolor baje no significa por sí solo que la función esté recuperada.',
  },
  rom_degrees: {
    id: 'rom_degrees', label: 'Rango de movimiento en grados', source: 'checkin', unit: '°', range: { min: 0, max: 360 },
    directions: ['increase', 'decrease'], defaultDirection: 'increase',
    params: [
      { key: 'joint', type: 'text', label: 'Articulación (ej. hombro)', required: true, max: 40 },
      { key: 'movement', type: 'text', label: 'Movimiento (ej. flexión)', required: true, max: 40 },
      { key: 'side', type: 'enum', label: 'Lado', required: true, options: [{ value: 'left', label: 'Izquierdo' }, { value: 'right', label: 'Derecho' }, { value: 'both', label: 'Ambos / no aplica' }] },
      { key: 'method', type: 'enum', label: 'Cómo se mide', required: true, options: [{ value: 'goniometer', label: 'Goniómetro' }, { value: 'inclinometer', label: 'Inclinómetro' }, { value: 'visual', label: 'Estimación visual' }] },
    ],
    confirmation: { records: 2, minDays: 7 }, origin: 'profesional', professionalEntryOnly: true, professionalTarget: true,
    note: 'Lo mide y registra tu kinesiólogo. Solo se compara la misma articulación, movimiento, lado y método.',
  },
  mobility_test: {
    id: 'mobility_test', label: 'Prueba funcional de movilidad', source: 'checkin', unitOptions: TEST_UNITS, range: { min: 0, max: 100000 },
    directions: ['increase', 'decrease'], defaultDirection: 'increase', params: [testName],
    confirmation: { records: 2, minDays: 7 }, origin: 'autorreporte', professionalTarget: true,
    note: 'Solo se compara la misma prueba.',
  },
  mobility_self_rating: {
    id: 'mobility_self_rating', label: 'Cómo percibo mi movilidad (0 a 10)', source: 'checkin', unit: '/10', range: { min: 0, max: 10 },
    directions: ['increase', 'maintain'], defaultDirection: 'increase', params: [],
    confirmation: { records: 2, minDays: 14 }, origin: 'autorreporte', professionalTarget: true,
    note: 'Es una percepción tuya: se muestra como tal.',
  },
};

// Exactamente diez categorías visibles. `icon` es el nombre de un icono de lucide-react.
export const GOAL_CATEGORIES = [
  { id: 'strength', order: 1, active: true, icon: 'Dumbbell', name: 'Aumentar fuerza', description: 'Quiero mejorar mi fuerza en uno o más ejercicios', supervision: 'none', indicators: ['exercise_max_load', 'exercise_reps_at_load'] },
  { id: 'muscle_mass', order: 2, active: true, icon: 'Activity', name: 'Ganar masa muscular', description: 'Quiero seguir cambios en mis medidas o composición corporal', supervision: 'none', indicators: ['perimeter_muscle', 'muscle_mass_pct', 'body_weight_complement'] },
  { id: 'weight', order: 3, active: true, icon: 'Scale', name: 'Bajar de peso', description: 'Quiero seguir mi peso corporal hacia una meta personal', supervision: 'recommended', indicators: ['body_weight'] },
  { id: 'body_fat', order: 4, active: true, icon: 'Flame', name: 'Bajar grasa corporal', description: 'Quiero seguir cambios en grasa corporal o cintura', supervision: 'recommended', indicators: ['body_fat_pct', 'perimeter_waist'] },
  { id: 'sport_performance', order: 5, active: true, icon: 'Timer', name: 'Mejorar rendimiento deportivo', description: 'Quiero mejorar una marca o prueba de mi deporte', supervision: 'none', indicators: ['jump_test', 'performance_test'] },
  { id: 'cardiometabolic', order: 6, active: true, icon: 'HeartPulse', name: 'Cuidar mi corazón y metabolismo', description: 'Quiero seguir hábitos o indicadores de salud cardiometabólica', supervision: 'recommended', multiIndicator: true, indicators: ['weekly_activity_minutes', 'resting_heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic', 'glucose', 'cholesterol'] },
  { id: 'stress', order: 7, active: true, icon: 'Brain', name: 'Manejar el estrés', description: 'Quiero observar mi estrés y mis hábitos de descanso', supervision: 'none', multiIndicator: true, indicators: ['stress_perceived', 'sleep_hours'] },
  { id: 'posture', order: 8, active: true, icon: 'PersonStanding', name: 'Mejorar postura', description: 'Quiero mejorar una función o percepción de mi postura', supervision: 'required', indicators: ['posture_self_rating', 'posture_functional_test'] },
  { id: 'pain', order: 9, active: true, icon: 'Crosshair', name: 'Reducir dolor', description: 'Quiero seguir la evolución del dolor en una zona', supervision: 'required', indicators: ['pain_eva'] },
  { id: 'mobility', order: 10, active: true, icon: 'Move', name: 'Mejorar movilidad', description: 'Quiero mejorar una amplitud de movimiento o una prueba funcional', supervision: 'required', indicators: ['rom_degrees', 'mobility_test', 'mobility_self_rating'] },
];

export const INDICATORS = IND;

export const getCategory = (id) => GOAL_CATEGORIES.find((c) => c.id === id) ?? null;
export const getIndicator = (id) => IND[id] ?? null;

// Catálogo listo para entregar al navegador: las categorías activas, ordenadas, con sus indicadores ya resueltos
export function publicCatalog() {
  return {
    version: GOAL_CATALOG_VERSION,
    maxActiveGoals: MAX_ACTIVE_GOALS,
    maxIndicatorsPerGoal: MAX_INDICATORS_PER_GOAL,
    categories: GOAL_CATEGORIES.filter((c) => c.active)
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ ...c, indicators: c.indicators.map((id) => IND[id]) })),
  };
}
