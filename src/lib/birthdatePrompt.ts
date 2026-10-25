// Pregunta por la fecha de nacimiento a quien todavía no la tiene. Se puede dejar para más tarde, pero vuelve a aparecer.
export const BIRTHDATE_SNOOZE_DAYS = 2;

export interface BirthdatePromptPref {
  snoozedUntil?: number;
}

export function shouldPromptBirthdate(input: { hasBirthDate: boolean; pref: BirthdatePromptPref; now: number }): boolean {
  if (input.hasBirthDate) return false;
  return !(input.pref.snoozedUntil && input.pref.snoozedUntil > input.now);
}
