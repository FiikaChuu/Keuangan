export type InsightPreferences = {
  allocation: boolean;
  spending: boolean;
  together: boolean;
};
export const defaultInsightPreferences: InsightPreferences = {
  allocation: true,
  spending: true,
  together: true,
};
export const PREFERENCES_KEY = 'skysave.insight-preferences';
export function readInsightPreferences(): InsightPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null');
    if (value && Object.keys(defaultInsightPreferences).every((k) => typeof value[k] === 'boolean'))
      return {
        allocation: value.allocation,
        spending: value.spending,
        together: value.together,
      };
  } catch {
    /* Use safe defaults when the browser cannot read preferences. */
  }
  return { ...defaultInsightPreferences };
}
