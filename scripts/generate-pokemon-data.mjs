import { writeFile } from "node:fs/promises";

const POKEAPI = "https://pokeapi.co/api/v2";
const MAX_ID = 386;

const tradeOnlyIds = new Set([65, 68, 76, 94, 186, 199, 208, 212, 230, 233, 242]);
const eventOnlyIds = new Set([151, 251, 385, 386]);
const roamingIds = new Set([243, 244, 245, 380, 381]);

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
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

  return games;
}

function formatEntry(entry) {
  return `  ${JSON.stringify(entry)}`;
}

async function main() {
  const speciesList = await Promise.all(
    Array.from({ length: MAX_ID }, (_, index) => fetchJson(`${POKEAPI}/pokemon-species/${index + 1}`)),
  );

  const evolutionUrls = [...new Set(speciesList.map((species) => species.evolution_chain.url))];
  const evolutionChains = await Promise.all(evolutionUrls.map((url) => fetchJson(url)));
  const finalSpecies = new Set();

  for (const evolutionChain of evolutionChains) {
    collectFinalSpecies(evolutionChain.chain, finalSpecies);
  }

  const entries = await Promise.all(
    Array.from({ length: MAX_ID }, async (_, index) => {
      const id = index + 1;
      const pokemon = await fetchJson(`${POKEAPI}/pokemon/${id}`);
      const species = speciesList[index];
      const englishName =
        species.names.find((name) => name.language.name === "en")?.name ?? pokemon.name;

      return {
        id,
        name: englishName,
        types: pokemon.types.map((slot) => slot.type.name),
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
        games: gamesFor(id),
        fullyEvolved: finalSpecies.has(species.name),
        eventOnly: eventOnlyIds.has(id),
        tradeOnly: tradeOnlyIds.has(id),
        roaming: roamingIds.has(id),
      };
    }),
  );

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
