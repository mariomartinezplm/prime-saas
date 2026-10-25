/**
 * PRUEBAS — cumpleaños de los pacientes para su profesional (semanal de los lunes y diario). Sin base real: se simulan los modelos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import * as notifications from '../services/notificationService.js';
import * as emails from '../services/emailService.js';
import { sendBirthdayReminders, birthdaysWithin, weekKey, todayKey } from '../services/birthdayReminderService.js';
import { parseBirthDate, birthdayIn } from '../utils/birthDate.js';
import { santiagoToUtc } from '../utils/timezone.js';

vi.mock('../services/notificationService.js', () => ({ notifyOnce: vi.fn() }));
vi.mock('../services/emailService.js', () => ({ sendBirthdayDigestEmail: vi.fn(async () => {}) }));

const id = () => new mongoose.Types.ObjectId();
const chain = (rows) => ({ select: () => ({ lean: async () => rows }) });
const MONDAY_9 = santiagoToUtc(2026, 10, 26, 9, 0); // lunes 26 de octubre de 2026, 09:00 en Chile
const MONDAY_7 = santiagoToUtc(2026, 10, 26, 7, 0);
const WEDNESDAY_9 = santiagoToUtc(2026, 10, 28, 9, 0);
const born = (iso) => new Date(`${iso}T00:00:00.000Z`);

describe('fecha de nacimiento', () => {
  it('acepta una fecha normal y rechaza vacía, inválida, futura o absurda', () => {
    expect(parseBirthDate('1990-05-12').date.toISOString()).toBe('1990-05-12T00:00:00.000Z');
    expect(parseBirthDate('').error).toMatch(/obligatoria/);
    expect(parseBirthDate(undefined).error).toMatch(/obligatoria/);
    expect(parseBirthDate('no-es-fecha').error).toMatch(/válida/);
    expect(parseBirthDate('2999-01-01').error).toMatch(/futura/);
    expect(parseBirthDate('1850-01-01').error).toMatch(/Revisa/);
  });

  it('calcula la edad que cumple y pasa el 29 de febrero al 28 en años no bisiestos', () => {
    expect(birthdayIn(born('1990-10-28'), 2026)).toEqual({ month: 10, day: 28, age: 36 });
    expect(birthdayIn(born('2000-02-29'), 2026)).toEqual({ month: 2, day: 28, age: 26 });
    expect(birthdayIn(born('2000-02-29'), 2028)).toEqual({ month: 2, day: 29, age: 28 });
  });
});

describe('cumpleaños de la semana (lunes a domingo)', () => {
  const week = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 26 + i)));
  it('incluye solo a quienes cumplen entre el lunes y el domingo, ordenados por día', () => {
    const list = birthdaysWithin([
      { firstName: 'Zoe', lastName: 'Rojas', dateOfBirth: born('1990-11-01') }, // domingo 1 de noviembre: dentro
      { firstName: 'Ana', lastName: 'Pérez', dateOfBirth: born('1992-10-28') }, // miércoles
      { firstName: 'Luis', lastName: 'Soto', dateOfBirth: born('1985-11-02') }, // lunes siguiente: fuera
      { firstName: 'Eva', lastName: 'Díaz', dateOfBirth: born('1995-10-25') } // domingo anterior: fuera
    ], week);
    expect(list.map((item) => item.name)).toEqual(['Ana Pérez', 'Zoe Rojas']);
    expect(list[0].age).toBe(34);
    expect(list[0].when).toMatch(/miércoles/);
  });
});

describe('avisos de cumpleaños al profesional', () => {
  const pro = id();
  const otro = id();
  const patients = [
    { firstName: 'Ana', lastName: 'Pérez', dateOfBirth: born('1992-10-28'), assignedProfessionalId: pro }, // esta semana (miércoles)
    { firstName: 'Beto', lastName: 'Lira', dateOfBirth: born('1988-10-26'), assignedProfessionalId: pro }, // hoy lunes
    { firstName: 'Cata', lastName: 'Mora', dateOfBirth: born('1990-10-27'), assignedProfessionalId: otro }, // de otro profesional
    { firstName: 'Dani', lastName: 'Vera', dateOfBirth: born('1990-03-03'), assignedProfessionalId: pro } // otro mes
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(User, 'find').mockImplementation((filter) => {
      if (filter.role === 'patient') return chain(patients);
      return chain([{ _id: pro, email: 'pro@ejemplo.invalid', firstName: 'Pro' }, { _id: otro, email: 'otro@ejemplo.invalid', firstName: 'Otro' }]);
    });
    notifications.notifyOnce.mockResolvedValue({ _id: id() });
  });

  it('el lunes manda la lista de la semana y la de hoy, cada profesional con SUS pacientes', async () => {
    const summary = await sendBirthdayReminders({ now: MONDAY_9 });
    expect(summary).toMatchObject({ weekly: 2, daily: 1, failed: 0 });

    const weeklyForPro = notifications.notifyOnce.mock.calls.find((c) => c[2].dedupeKey === weekKey(String(pro), '2026-10-26'));
    expect(weeklyForPro[1]).toBe('birthday_week');
    expect(weeklyForPro[2].body).toContain('Ana Pérez');
    expect(weeklyForPro[2].body).toContain('Beto Lira');
    expect(weeklyForPro[2].body).not.toContain('Cata');
    expect(weeklyForPro[2].body).not.toContain('Dani');

    const todayForPro = notifications.notifyOnce.mock.calls.find((c) => c[2].dedupeKey === todayKey(String(pro), '2026-10-26'));
    expect(todayForPro[1]).toBe('birthday_today');
    expect(todayForPro[2].body).toContain('Beto Lira');
    expect(todayForPro[2].body).not.toContain('Ana');

    // El correo del profesional lleva la edad que cumple cada paciente
    const mail = emails.sendBirthdayDigestEmail.mock.calls.find((c) => c[0].title === 'Cumpleaños de la semana' && c[0].user.email === 'pro@ejemplo.invalid')[0];
    expect(mail.showAge).toBe(true);
    expect(mail.items.map((i) => [i.name, i.age])).toEqual([['Beto Lira', 38], ['Ana Pérez', 34]]);
  });

  it('fuera del lunes solo avisa de los que cumplen HOY, y no avisa si nadie cumple', async () => {
    const summary = await sendBirthdayReminders({ now: WEDNESDAY_9 });
    expect(summary).toMatchObject({ weekly: 0, daily: 1 });
    expect(notifications.notifyOnce.mock.calls[0][0]).toEqual(pro);
    expect(notifications.notifyOnce.mock.calls[0][2].body).toContain('Ana Pérez');

    vi.clearAllMocks();
    const quiet = await sendBirthdayReminders({ now: santiagoToUtc(2026, 12, 15, 9, 0) });
    expect(quiet).toMatchObject({ weekly: 0, daily: 0 });
    expect(notifications.notifyOnce).not.toHaveBeenCalled();
  });

  it('no avisa antes de las 08:00 de Chile', async () => {
    const summary = await sendBirthdayReminders({ now: MONDAY_7 });
    expect(summary).toMatchObject({ weekly: 0, daily: 0 });
    expect(notifications.notifyOnce).not.toHaveBeenCalled();
  });

  it('si ya se avisó (clave repetida) no manda otro correo', async () => {
    notifications.notifyOnce.mockResolvedValue(null);
    const summary = await sendBirthdayReminders({ now: MONDAY_9 });
    expect(summary).toMatchObject({ weekly: 0, daily: 0, duplicates: 3 });
    expect(emails.sendBirthdayDigestEmail).not.toHaveBeenCalled();
  });

  it('la consulta solo toma pacientes activos, no interesados, con profesional y con fecha', async () => {
    await sendBirthdayReminders({ now: MONDAY_9 });
    const filter = User.find.mock.calls[0][0];
    expect(filter).toMatchObject({ role: 'patient', isActive: true, isProspect: { $ne: true }, assignedProfessionalId: { $ne: null }, dateOfBirth: { $ne: null } });
  });
});
