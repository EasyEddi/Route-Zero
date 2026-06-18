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

function shuffleEntries(entries: PokemonEntry[]) {
  return [...entries].sort(() => Math.random() - 0.5);
}

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

function hasDuplicateType(entry: PokemonEntry, usedTypes: Set<string>) {
  return entry.types.some((type) => usedTypes.has(type));
}

function buildTeamWithRules(filters: TeamFilters, pool: PokemonEntry[]) {
  if (filters.allowDuplicatePokemon && filters.allowDuplicateTypes) {
    return Array.from({ length: filters.teamSize }, () => pool[Math.floor(Math.random() * pool.length)]);
  }

  if (filters.allowDuplicateTypes) {
    return shuffleEntries(pool).slice(0, filters.teamSize);
  }

  const selected: PokemonEntry[] = [];
  const usedIds = new Set<number>();
  const usedTypes = new Set<string>();
  let attempts = 0;
  const maxAttempts = 20000;

  function chooseNext(): boolean {
    attempts += 1;

    if (attempts > maxAttempts) {
      return false;
    }

    if (selected.length === filters.teamSize) {
      return true;
    }

    const candidates = shuffleEntries(pool).filter((entry) => {
      if (!filters.allowDuplicatePokemon && usedIds.has(entry.id)) {
        return false;
      }

      return !hasDuplicateType(entry, usedTypes);
    });

    for (const candidate of candidates) {
      selected.push(candidate);
      usedIds.add(candidate.id);
      candidate.types.forEach((type) => usedTypes.add(type));

      if (chooseNext()) {
        return true;
      }

      selected.pop();
      usedIds.delete(candidate.id);
      candidate.types.forEach((type) => {
        if (!selected.some((entry) => entry.types.includes(type))) {
          usedTypes.delete(type);
        }
      });
    }

    return false;
  }

  return chooseNext() ? selected : null;
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

  if (pool.length === 0 || (!filters.allowDuplicatePokemon && pool.length < filters.teamSize)) {
    return {
      ok: false,
      message: `Only ${pool.length} Pokemon match these filters. You need at least ${filters.teamSize} for this team.`,
      availableCount: pool.length,
    };
  }

  const team = buildTeamWithRules(filters, pool);

  if (!team) {
    return {
      ok: false,
      message: "These filters cannot build a full team without duplicate types. Allow duplicate Pokemon types or loosen another filter.",
      availableCount: pool.length,
    };
  }

  return {
    ok: true,
    team,
    availableCount: pool.length,
  };
}
