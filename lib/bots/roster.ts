/**
 * Roster de bots (tarea 9.3).
 *
 * ~50 identidades creíbles en español. Los usernames cumplen las mismas reglas
 * que los humanos (3–20 chars, [a-z0-9_], ver lib/validations/user.ts); los
 * display names imitan el formato que deja Google en el onboarding real.
 * `avatar_url` queda null: hoy ningún componente lo renderiza.
 *
 * El username es la clave de idempotencia del seed: NO renombrar entradas ya
 * sembradas (se crearía un bot duplicado con el nombre nuevo).
 */

export interface BotIdentity {
  username: string;
  displayName: string;
}

export const BOT_ROSTER: readonly BotIdentity[] = [
  { username: "mati_gol", displayName: "Matías Herrera" },
  { username: "lu_pelotazo", displayName: "Lucía Fernández" },
  { username: "el_tano88", displayName: "Franco Bianchi" },
  { username: "sofi_fut", displayName: "Sofía Vargas" },
  { username: "juancho_9", displayName: "Juan Cruz Domínguez" },
  { username: "rodri_dt", displayName: "Rodrigo Salas" },
  { username: "camixgoles", displayName: "Camila Ríos" },
  { username: "pipa_central", displayName: "Felipe Aguirre" },
  { username: "vale_corner", displayName: "Valentina Mora" },
  { username: "nico_gambeta", displayName: "Nicolás Paredes" },
  { username: "anto_offside", displayName: "Antonella Suárez" },
  { username: "gonza_relator", displayName: "Gonzalo Medina" },
  { username: "flor_tribuna", displayName: "Florencia Castro" },
  { username: "seba_volante", displayName: "Sebastián Roldán" },
  { username: "mica_penal", displayName: "Micaela Funes" },
  { username: "tomi_lateral", displayName: "Tomás Villalba" },
  { username: "agus_pressing", displayName: "Agustina Leiva" },
  { username: "facu_enganche", displayName: "Facundo Torres" },
  { username: "caro_golazo", displayName: "Carolina Méndez" },
  { username: "lean_tactico", displayName: "Leandro Quiroga" },
  { username: "dani_hattrick", displayName: "Daniela Ponce" },
  { username: "marto_arquero", displayName: "Martín Ocampo" },
  { username: "juli_contra", displayName: "Julieta Navarro" },
  { username: "santi_chilena", displayName: "Santiago Bravo" },
  { username: "euge_vestuario", displayName: "Eugenia Lagos" },
  { username: "pablo_pelota", displayName: "Pablo Cisneros" },
  { username: "viki_var", displayName: "Victoria Peralta" },
  { username: "andy_amague", displayName: "Andrés Carrizo" },
  { username: "belu_banderin", displayName: "Belén Acosta" },
  { username: "fede_rabona", displayName: "Federico Luna" },
  { username: "marian_mediocampo", displayName: "Mariana Soto" },
  { username: "kevin_korner", displayName: "Kevin Ibáñez" },
  { username: "pau_taquito", displayName: "Paula Giménez" },
  { username: "ramiro_remate", displayName: "Ramiro Escudero" },
  { username: "celes_cabezazo", displayName: "Celeste Arias" },
  { username: "bruno_bicicleta", displayName: "Bruno Maldonado" },
  { username: "ari_alargue", displayName: "Ariana Cuevas" },
  { username: "damian_doblete", displayName: "Damián Robles" },
  { username: "lara_lacancha", displayName: "Lara Espinoza" },
  { username: "ivan_invicto", displayName: "Iván Palacios" },
  { username: "naty_nutmeg", displayName: "Natalia Ferreyra" },
  { username: "oscar_olimpico", displayName: "Óscar Benítez" },
  { username: "romi_rebote", displayName: "Romina Vega" },
  { username: "diego_decampo", displayName: "Diego Montoya" },
  { username: "clari_clasico", displayName: "Clara Ruiz Díaz" },
  { username: "hugo_huracan", displayName: "Hugo Sandoval" },
  { username: "maia_mundial", displayName: "Maia Toledo" },
  { username: "axel_area", displayName: "Axel Figueroa" },
  { username: "tere_tiempo", displayName: "Teresa Molina" },
  { username: "gaston_gol90", displayName: "Gastón Barrios" },
] as const;
