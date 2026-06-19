import { writeFile } from "node:fs/promises";

const POKEAPI = "https://pokeapi.co/api/v2";
const FALLBACK_MAX_ID = 1025;

const tradeOnlyIds = new Set([
  65, 68, 76, 94, 186, 199, 208, 212, 230, 233, 242, 464, 466, 467, 474, 477, 526, 534, 589, 617, 683, 685, 709, 711,
]);
const eventOnlyIds = new Set([
  151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720, 721, 801, 802, 807, 808, 809, 893,
]);
const roamingIds = new Set([243, 244, 245, 380, 381]);
const versionMap = new Map([
  ["red", "red"],
  ["blue", "blue"],
  ["yellow", "yellow"],
  ["gold", "gold"],
  ["silver", "silver"],
  ["crystal", "crystal"],
  ["ruby", "ruby"],
  ["sapphire", "sapphire"],
  ["emerald", "emerald"],
  ["firered", "fire-red"],
  ["leafgreen", "leaf-green"],
  ["diamond", "diamond"],
  ["pearl", "pearl"],
  ["platinum", "platinum"],
  ["heartgold", "heart-gold"],
  ["soulsilver", "soul-silver"],
  ["black", "black"],
  ["white", "white"],
  ["black-2", "black-2"],
  ["white-2", "white-2"],
  ["x", "x"],
  ["y", "y"],
  ["omega-ruby", "omega-ruby"],
  ["alpha-sapphire", "alpha-sapphire"],
  ["sun", "sun"],
  ["moon", "moon"],
  ["ultra-sun", "ultra-sun"],
  ["ultra-moon", "ultra-moon"],
  ["lets-go-pikachu", "lets-go-pikachu"],
  ["lets-go-eevee", "lets-go-eevee"],
  ["sword", "sword"],
  ["shield", "shield"],
  ["brilliant-diamond", "brilliant-diamond"],
  ["shining-pearl", "shining-pearl"],
  ["legends-arceus", "legends-arceus"],
  ["scarlet", "scarlet"],
  ["violet", "violet"],
  ["legends-za", "legends-za"],
]);

const manualNativeGamesById = new Map([
  [1, ["red", "blue", "fire-red", "leaf-green"]],
  [4, ["red", "blue", "fire-red", "leaf-green"]],
  [7, ["red", "blue", "fire-red", "leaf-green"]],
  [25, ["yellow", "lets-go-pikachu"]],
  [133, ["red", "blue", "yellow", "fire-red", "leaf-green", "lets-go-eevee"]],
  [138, ["red", "blue", "yellow", "fire-red", "leaf-green"]],
  [140, ["red", "blue", "yellow", "fire-red", "leaf-green"]],
  [142, ["red", "blue", "yellow", "fire-red", "leaf-green"]],
  [152, ["gold", "silver", "crystal", "emerald"]],
  [155, ["gold", "silver", "crystal", "emerald"]],
  [158, ["gold", "silver", "crystal", "emerald"]],
  [252, ["ruby", "sapphire", "emerald"]],
  [255, ["ruby", "sapphire", "emerald"]],
  [258, ["ruby", "sapphire", "emerald"]],
  [387, ["diamond", "pearl", "platinum", "brilliant-diamond", "shining-pearl"]],
  [390, ["diamond", "pearl", "platinum", "brilliant-diamond", "shining-pearl"]],
  [393, ["diamond", "pearl", "platinum", "brilliant-diamond", "shining-pearl"]],
  [495, ["black", "white", "black-2", "white-2"]],
  [498, ["black", "white", "black-2", "white-2"]],
  [501, ["black", "white", "black-2", "white-2", "legends-arceus"]],
  [650, ["x", "y"]],
  [653, ["x", "y"]],
  [656, ["x", "y"]],
  [722, ["sun", "moon", "ultra-sun", "ultra-moon", "legends-arceus"]],
  [725, ["sun", "moon", "ultra-sun", "ultra-moon"]],
  [728, ["sun", "moon", "ultra-sun", "ultra-moon"]],
  [810, ["sword", "shield"]],
  [813, ["sword", "shield"]],
  [816, ["sword", "shield"]],
  [906, ["scarlet", "violet"]],
  [909, ["scarlet", "violet"]],
  [912, ["scarlet", "violet"]],
]);
const nativeFallbackGameIds = new Set([
  "sword",
  "shield",
  "brilliant-diamond",
  "shining-pearl",
  "legends-arceus",
  "legends-za",
]);

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
}

async function fetchAllInBatches(items, mapper, batchSize = 80) {
  const results = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(mapper))));
  }

  return results;
}

function collectChainSpecies(chain, chainSpecies = []) {
  chainSpecies.push(chain.species.name);

  for (const next of chain.evolves_to) {
    collectChainSpecies(next, chainSpecies);
  }

  return chainSpecies;
}

function collectFinalSpecies(chain, finalSpecies = new Set()) {
  if (chain.evolves_to.length === 0) {
    finalSpecies.add(chain.species.name);
    return finalSpecies;
  }

  for (const next of chain.evolves_to) {
    collectFinalSpecies(next, finalSpecies);
  }

  return finalSpecies;
}

function gamesFor(id) {
  const games = [];

  if (id <= 151) {
    games.push("red", "blue", "yellow");
  }

  if (id <= 251) {
    games.push("gold", "silver", "crystal", "fire-red", "leaf-green");
  }

  if (id <= 386) {
    games.push("ruby", "sapphire", "emerald");
  }

  if (id <= 493) {
    games.push("diamond", "pearl", "platinum", "heart-gold", "soul-silver", "brilliant-diamond", "shining-pearl");
  }

  if (id <= 649) {
    games.push("black", "white", "black-2", "white-2");
  }

  if (id <= 721) {
    games.push("x", "y", "omega-ruby", "alpha-sapphire");
  }

  if (id <= 807) {
    games.push("sun", "moon", "ultra-sun", "ultra-moon");
  }

  if (id <= 151 || id === 808 || id === 809) {
    games.push("lets-go-pikachu", "lets-go-eevee");
  }

  if (id <= 898) {
    games.push("sword", "shield");
  }

  if (id <= 905) {
    games.push("legends-arceus");
  }

  if (id <= 1025) {
    games.push("scarlet", "violet");
  }

  if (id <= 1025) {
    games.push("legends-za");
  }

  return games;
}

function mergeGames(...gameLists) {
  return [...new Set(gameLists.flat())];
}

function nativeGamesFromEncounters(encounters) {
  const nativeGames = new Set();

  for (const encounter of encounters) {
    if (encounter.location_area.name.includes("altering-cave")) {
      continue;
    }

    for (const versionDetail of encounter.version_details) {
      const gameId = versionMap.get(versionDetail.version.name);

      if (gameId) {
        nativeGames.add(gameId);
      }
    }
  }

  return [...nativeGames];
}

function formatEntry(entry) {
  return `  ${JSON.stringify(entry)}`;
}

async function main() {
  const speciesCountResponse = await fetchJson(`${POKEAPI}/pokemon-species?limit=1`);
  const maxId = Math.min(speciesCountResponse.count || FALLBACK_MAX_ID, FALLBACK_MAX_ID);
  const pokemonIds = Array.from({ length: maxId }, (_, index) => index + 1);
  const speciesList = await fetchAllInBatches(
    pokemonIds,
    (id) => fetchJson(`${POKEAPI}/pokemon-species/${id}`),
  );

  const evolutionUrls = [...new Set(speciesList.map((species) => species.evolution_chain.url))];
  const evolutionChains = await fetchAllInBatches(evolutionUrls, (url) => fetchJson(url));
  const finalSpecies = new Set();
  const chainSpeciesBySpecies = new Map();

  for (const evolutionChain of evolutionChains) {
    collectFinalSpecies(evolutionChain.chain, finalSpecies);
    const chainSpecies = collectChainSpecies(evolutionChain.chain);

    for (const speciesName of chainSpecies) {
      chainSpeciesBySpecies.set(speciesName, chainSpecies);
    }
  }

  const rawEntries = await fetchAllInBatches(
    pokemonIds,
    async (id) => {
      const pokemon = await fetchJson(`${POKEAPI}/pokemon/${id}`);
      const species = speciesList[id - 1];
      const encounters = await fetchJson(`${POKEAPI}/pokemon/${id}/encounters`);
      const englishName =
        species.names.find((name) => name.language.name === "en")?.name ?? pokemon.name;

      return {
        id,
        speciesName: species.name,
        name: englishName,
        types: pokemon.types.map((slot) => slot.type.name),
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
        games: gamesFor(id),
        nativeGames: mergeGames(nativeGamesFromEncounters(encounters), manualNativeGamesById.get(id) ?? []),
        fullyEvolved: finalSpecies.has(species.name),
        eventOnly: eventOnlyIds.has(id),
        tradeOnly: tradeOnlyIds.has(id),
        roaming: roamingIds.has(id),
      };
    },
  );

  const nativeGamesBySpecies = new Map(rawEntries.map((entry) => [entry.speciesName, entry.nativeGames]));

  const entries = rawEntries.map(({ speciesName, ...entry }) => {
    const chainSpecies = chainSpeciesBySpecies.get(speciesName) ?? [speciesName];
    const nativeGames = mergeGames(
      entry.nativeGames,
      ...chainSpecies.map((chainSpeciesName) => nativeGamesBySpecies.get(chainSpeciesName) ?? []),
      entry.games.filter((gameId) => nativeFallbackGameIds.has(gameId)),
    ).filter((gameId) => entry.games.includes(gameId));

    return {
      ...entry,
      nativeGames,
    };
  });

  const output = `import type { PokemonEntry } from "@/lib/types";

export const pokemon: PokemonEntry[] = [
${entries.map(formatEntry).join(",\n")},
];
`;

  await writeFile(new URL("../data/pokemon.ts", import.meta.url), output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
