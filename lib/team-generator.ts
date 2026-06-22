import type { PokemonEntry, TeamFilters } from "./types";
import { getTeamSynergyScore } from "./team-analysis";
import { isParadoxPokemon, isSpecialPokemon } from "./pokemon-tags";

type RollOptions = {
  dryRun?: boolean;
  lockedPokemonIds?: number[];
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

    if (filters.battleReadyTeam && !pokemon.fullyEvolved) {
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

    if (!filters.allowLegendaryPokemon && isSpecialPokemon(pokemon.id)) {
      return false;
    }

    if (!filters.allowParadoxPokemon && isParadoxPokemon(pokemon.id)) {
      return false;
    }

    return true;
  });
}

function hasDuplicateType(entry: PokemonEntry, usedTypes: Set<string>) {
  return entry.types.some((type) => usedTypes.has(type));
}

function getLockedEntries(pool: PokemonEntry[], lockedPokemonIds: number[]) {
  return lockedPokemonIds
    .map((id) => pool.find((entry) => entry.id === id))
    .filter((entry): entry is PokemonEntry => Boolean(entry));
}

function buildTeamWithRules(filters: TeamFilters, pool: PokemonEntry[], lockedEntries: PokemonEntry[] = []) {
  const allowDuplicatePokemon = filters.battleReadyTeam ? false : filters.allowDuplicatePokemon;
  const allowDuplicateTypes = filters.battleReadyTeam ? false : filters.allowDuplicateTypes;

  if (lockedEntries.length > filters.teamSize) {
    return null;
  }

  if (!allowDuplicatePokemon) {
    const uniqueLockedIds = new Set(lockedEntries.map((entry) => entry.id));

    if (uniqueLockedIds.size !== lockedEntries.length) {
      return null;
    }
  }

  if (!allowDuplicateTypes) {
    const usedTypes = new Set<string>();

    for (const entry of lockedEntries) {
      if (hasDuplicateType(entry, usedTypes)) {
        return null;
      }

      entry.types.forEach((type) => usedTypes.add(type));
    }
  }

  if (allowDuplicatePokemon && allowDuplicateTypes) {
    return [
      ...lockedEntries,
      ...Array.from({ length: filters.teamSize - lockedEntries.length }, () => pool[Math.floor(Math.random() * pool.length)]),
    ];
  }

  if (allowDuplicateTypes) {
    const usedLockedIds = new Set(lockedEntries.map((entry) => entry.id));
    const candidates = allowDuplicatePokemon ? pool : pool.filter((entry) => !usedLockedIds.has(entry.id));
    const team = [...lockedEntries, ...shuffleEntries(candidates).slice(0, filters.teamSize - lockedEntries.length)];
    return team.length === filters.teamSize ? team : null;
  }

  const selected: PokemonEntry[] = [...lockedEntries];
  const usedIds = new Set<number>(lockedEntries.map((entry) => entry.id));
  const usedTypes = new Set<string>(lockedEntries.flatMap((entry) => entry.types));
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
      if (!allowDuplicatePokemon && usedIds.has(entry.id)) {
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

function buildBattleReadyTeam(filters: TeamFilters, pool: PokemonEntry[], lockedEntries: PokemonEntry[]) {
  let bestTeam: PokemonEntry[] | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const team = buildTeamWithRules(filters, pool, lockedEntries);

    if (!team) {
      continue;
    }

    const score = getTeamSynergyScore(team);

    if (score > bestScore) {
      bestTeam = team;
      bestScore = score;
    }
  }

  return bestTeam;
}

export function rollTeam(
  filters: TeamFilters,
  entries: PokemonEntry[],
  options: RollOptions = {},
): RollResult {
  const pool = applyFilters(filters, entries);
  const lockedPokemonIds = options.lockedPokemonIds ?? [];
  const lockedEntries = getLockedEntries(pool, lockedPokemonIds);

  if (options.dryRun) {
    return {
      ok: true,
      team: [],
      availableCount: pool.length,
    };
  }

  if (lockedPokemonIds.length > filters.teamSize) {
    return {
      ok: false,
      message: `You locked ${lockedPokemonIds.length} Pokemon, but the selected team size is ${filters.teamSize}.`,
      availableCount: pool.length,
    };
  }

  if (lockedEntries.length !== lockedPokemonIds.length) {
    return {
      ok: false,
      message: "One or more locked Pokemon are not available with the current game and filters.",
      availableCount: pool.length,
    };
  }

  const allowDuplicatePokemon = filters.battleReadyTeam ? false : filters.allowDuplicatePokemon;

  if (pool.length === 0 || (!allowDuplicatePokemon && pool.length < filters.teamSize)) {
    return {
      ok: false,
      message: `Only ${pool.length} Pokemon match these filters. You need at least ${filters.teamSize} for this team.`,
      availableCount: pool.length,
    };
  }

  const team = filters.battleReadyTeam
    ? buildBattleReadyTeam(filters, pool, lockedEntries)
    : buildTeamWithRules(filters, pool, lockedEntries);

  if (!team) {
    return {
      ok: false,
      message: filters.battleReadyTeam
        ? "Battle-ready mode needs enough fully evolved Pokemon without duplicate types. Loosen another filter or unlock a conflicting Pokemon."
        : "These filters cannot build a full team without duplicate types. Allow duplicate Pokemon types or loosen another filter.",
      availableCount: pool.length,
    };
  }

  return {
    ok: true,
    team,
    availableCount: pool.length,
  };
}
