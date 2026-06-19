const legendaryPokemonIds = new Set([
  144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382, 383, 384, 480, 481,
  482, 483, 484, 485, 486, 487, 488, 638, 639, 640, 641, 642, 643, 644, 645, 646, 716, 717, 718,
  772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 800, 888, 889, 890, 891, 892, 894, 895, 896,
  897, 898, 905, 1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010, 1014, 1015, 1016, 1017, 1020,
  1021, 1022, 1023, 1024,
]);

const mythicalPokemonIds = new Set([
  151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720, 721, 801, 802, 807,
  808, 809, 893, 1025,
]);

const ultraBeastPokemonIds = new Set([
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
]);

const paradoxPokemonIds = new Set([
  984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1009, 1010, 1020, 1021,
  1022, 1023,
]);

export function isLegendaryPokemon(pokemonId: number) {
  return legendaryPokemonIds.has(pokemonId);
}

export function isMythicalPokemon(pokemonId: number) {
  return mythicalPokemonIds.has(pokemonId);
}

export function isUltraBeastPokemon(pokemonId: number) {
  return ultraBeastPokemonIds.has(pokemonId);
}

export function isParadoxPokemon(pokemonId: number) {
  return paradoxPokemonIds.has(pokemonId);
}

export function isSpecialPokemon(pokemonId: number) {
  return isLegendaryPokemon(pokemonId) || isMythicalPokemon(pokemonId) || isUltraBeastPokemon(pokemonId);
}

export function getSpecialPokemonLabels(pokemonId: number) {
  const labels = [];

  if (isLegendaryPokemon(pokemonId)) {
    labels.push("Legendary");
  }

  if (isMythicalPokemon(pokemonId)) {
    labels.push("Mythical");
  }

  if (isUltraBeastPokemon(pokemonId)) {
    labels.push("Ultra Beast");
  }

  if (isParadoxPokemon(pokemonId)) {
    labels.push("Paradox");
  }

  return labels;
}
