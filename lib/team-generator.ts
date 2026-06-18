import type { PokemonEntry, TeamFilters } from "./types";

type RollOptions = {
  dryRun?: boolean;
};

type RollResult =
  | {
      ok: true;
      team: PokemonEntry[];
      availableCount: number;
    }
  | {
      ok: false;
      message: string;
      availableCount: number;
    };

export function applyFilters(filters: TeamFilters, entries: PokemonEntry[]) {
  return entries.filter((pokemon) => {
    if (!pokemon.games.includes(filters.gameId)) {
      return false;
    }

    if (filters.bannedTypes.some((type) => pokemon.types.includes(type))) {
      return false;
    }

    if (filters.fullyEvolvedOnly && !pokemon.fullyEvolved) {
      return false;
    }

    if (!filters.allowEventPokemon && pokemon.eventOnly) {
      return false;
    }

    if (!filters.allowTradePokemon && pokemon.tradeOnly) {
      return false;
    }

    if (!filters.allowTradePokemon && !pokemon.nativeGames.includes(filters.gameId)) {
      return false;
    }

    if (!filters.allowRoamingPokemon && pokemon.roaming) {
      return false;
    }

    return true;
  });
}

export function rollTeam(
  filters: TeamFilters,
  entries: PokemonEntry[],
  options: RollOptions = {},
): RollResult {
  const pool = applyFilters(filters, entries);

  if (options.dryRun) {
    return {
      ok: true,
      team: [],
      availableCount: pool.length,
    };
  }

  if (pool.length < filters.teamSize) {
    return {
      ok: false,
      message: `Only ${pool.length} Pokemon match these filters. You need at least ${filters.teamSize} for this team.`,
      availableCount: pool.length,
    };
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  return {
    ok: true,
    team: shuffled.slice(0, filters.teamSize),
    availableCount: pool.length,
  };
}
