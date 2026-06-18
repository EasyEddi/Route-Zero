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

    if (
      filters.allowedTypes.length > 0 &&
      !pokemon.types.some((type) => filters.allowedTypes.includes(type))
    ) {
      return false;
    }

    if (filters.ignoreNotFullyEvolved && !pokemon.fullyEvolved) {
      return false;
    }

    if (filters.ignoreEventOnly && pokemon.eventOnly) {
      return false;
    }

    if (filters.ignoreTradeOnly && pokemon.tradeOnly) {
      return false;
    }

    if (filters.ignoreRoaming && pokemon.roaming) {
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

  if (pool.length < 6) {
    return {
      ok: false,
      message: `Mit diesen Filtern bleiben nur ${pool.length} Pokemon uebrig. Fuer ein Team brauchst du mindestens 6.`,
      availableCount: pool.length,
    };
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  return {
    ok: true,
    team: shuffled.slice(0, 6),
    availableCount: pool.length,
  };
}
