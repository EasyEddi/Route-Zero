import type { PokemonEntry } from "./types";

export type TeamAnalysis = {
  synergy: number;
  weaknesses: string[];
  strengths: string[];
};

const typeNames: Record<string, string> = {
  bug: "Bug",
  dark: "Dark",
  dragon: "Dragon",
  electric: "Electric",
  fairy: "Fairy",
  fighting: "Fighting",
  fire: "Fire",
  flying: "Flying",
  ghost: "Ghost",
  grass: "Grass",
  ground: "Ground",
  ice: "Ice",
  normal: "Normal",
  poison: "Poison",
  psychic: "Psychic",
  rock: "Rock",
  steel: "Steel",
  water: "Water",
};

const superEffective: Record<string, string[]> = {
  normal: [],
  fire: ["grass", "ice", "bug", "steel"],
  water: ["fire", "ground", "rock"],
  electric: ["water", "flying"],
  grass: ["water", "ground", "rock"],
  ice: ["grass", "ground", "flying", "dragon"],
  fighting: ["normal", "ice", "rock", "dark", "steel"],
  poison: ["grass", "fairy"],
  ground: ["fire", "electric", "poison", "rock", "steel"],
  flying: ["grass", "fighting", "bug"],
  psychic: ["fighting", "poison"],
  bug: ["grass", "psychic", "dark"],
  rock: ["fire", "ice", "flying", "bug"],
  ghost: ["psychic", "ghost"],
  dragon: ["dragon"],
  dark: ["psychic", "ghost"],
  steel: ["ice", "rock", "fairy"],
  fairy: ["fighting", "dragon", "dark"],
};

const notVeryEffective: Record<string, string[]> = {
  normal: ["rock", "steel"],
  fire: ["fire", "water", "rock", "dragon"],
  water: ["water", "grass", "dragon"],
  electric: ["electric", "grass", "dragon"],
  grass: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"],
  ice: ["fire", "water", "ice", "steel"],
  fighting: ["poison", "flying", "psychic", "bug", "fairy"],
  poison: ["poison", "ground", "rock", "ghost"],
  ground: ["grass", "bug"],
  flying: ["electric", "rock", "steel"],
  psychic: ["psychic", "steel"],
  bug: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"],
  rock: ["fighting", "ground", "steel"],
  ghost: ["dark"],
  dragon: ["steel"],
  dark: ["fighting", "dark", "fairy"],
  steel: ["fire", "water", "electric", "steel"],
  fairy: ["fire", "poison", "steel"],
};

const noEffect: Record<string, string[]> = {
  normal: ["ghost"],
  electric: ["ground"],
  fighting: ["ghost"],
  poison: ["steel"],
  ground: ["flying"],
  psychic: ["dark"],
  ghost: ["normal"],
  dragon: ["fairy"],
};

function typeEffectiveness(attackingType: string, defendingTypes: string[]) {
  return defendingTypes.reduce((multiplier, defendingType) => {
    if (noEffect[attackingType]?.includes(defendingType)) {
      return multiplier * 0;
    }

    if (superEffective[attackingType]?.includes(defendingType)) {
      return multiplier * 2;
    }

    if (notVeryEffective[attackingType]?.includes(defendingType)) {
      return multiplier * 0.5;
    }

    return multiplier;
  }, 1);
}

function formatTypes(types: string[]) {
  return types.map((type) => typeNames[type] ?? type).slice(0, 5);
}

export function analyzeTeam(entries: PokemonEntry[]): TeamAnalysis {
  if (entries.length === 0) {
    return {
      synergy: 0,
      weaknesses: [],
      strengths: [],
    };
  }

  const allTypes = Object.keys(typeNames);
  const uniqueTeamTypes = new Set(entries.flatMap((entry) => entry.types));
  const duplicateTypePenalty = entries.flatMap((entry) => entry.types).length - uniqueTeamTypes.size;

  const defensiveRows = allTypes.map((attackingType) => {
    const multipliers = entries.map((entry) => typeEffectiveness(attackingType, entry.types));
    const weakCount = multipliers.filter((value) => value > 1).length;
    const resistCount = multipliers.filter((value) => value < 1).length;
    const average = multipliers.reduce((sum, value) => sum + value, 0) / entries.length;

    return {
      type: attackingType,
      average,
      weakCount,
      resistCount,
    };
  });

  const weaknesses = defensiveRows
    .filter((row) => row.weakCount > row.resistCount && row.average >= 1.15)
    .sort((a, b) => b.average - a.average || b.weakCount - a.weakCount)
    .map((row) => row.type);

  const offensiveCoverage = allTypes.filter((defendingType) => {
    return [...uniqueTeamTypes].some((attackingType) => typeEffectiveness(attackingType, [defendingType]) > 1);
  });

  const severeWeaknessPenalty = weaknesses.length * 7;
  const typeDiversityScore = Math.min(30, uniqueTeamTypes.size * 4);
  const coverageScore = Math.round((offensiveCoverage.length / allTypes.length) * 42);
  const defensiveScore = Math.max(0, 28 - severeWeaknessPenalty - duplicateTypePenalty * 4);
  const fullTeamBonus = entries.length >= 6 ? 0 : -8;
  const synergy = Math.max(0, Math.min(100, typeDiversityScore + coverageScore + defensiveScore + fullTeamBonus));

  return {
    synergy,
    weaknesses: formatTypes(weaknesses),
    strengths: formatTypes(offensiveCoverage),
  };
}

export function getTeamSynergyScore(entries: PokemonEntry[]) {
  return analyzeTeam(entries).synergy;
}
