/**
 * Alias de codes pays tolérés côté serveur (territoires dépendants).
 * Doit rester synchronisé avec src/data/countries.ts du frontend.
 */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  BM: ['GB'], // Bermudes
  CW: ['NL'], // Curaçao
  GI: ['GB'], // Gibraltar
  GL: ['DK'], // Groenland
  GP: ['FR'], // Guadeloupe
  GF: ['FR'], // Guyane française
  HK: ['CN'], // Hong Kong
  KY: ['GB'], // Îles Caïmans
  FO: ['DK'], // Îles Féroé
  RE: ['FR'], // La Réunion
  MQ: ['FR'], // Martinique
  YT: ['FR'], // Mayotte
  NC: ['FR'], // Nouvelle-Calédonie
  PF: ['FR'], // Polynésie française
  PR: ['US'], // Porto Rico
  BL: ['FR'], // Saint-Barthélemy
  MF: ['FR'], // Saint-Martin
  WF: ['FR'], // Wallis-et-Futuna
};

export function isCountryClaimValid(
  code: string,
  geoCode: string | null,
): boolean {
  if (!geoCode) return true;
  if (code === geoCode) return true;
  const aliases = COUNTRY_ALIASES[code] ?? [];
  return aliases.includes(geoCode);
}
