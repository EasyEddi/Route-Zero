import { NextResponse } from "next/server";

type ExternalEncounterRow = {
  location: string;
  levels: string;
  methods: string;
  chance: null;
  source: string;
};

type SerebiiGameConfig = {
  dexPath: string;
  classes: string[];
  detailAnchor?: string;
  locationTableClasses?: string[];
};

const serebiiGameConfigs: Record<string, SerebiiGameConfig> = {
  x: { dexPath: "pokedex-xy", classes: ["foox"], detailAnchor: "x" },
  y: { dexPath: "pokedex-xy", classes: ["fooy"], detailAnchor: "y" },
  "omega-ruby": { dexPath: "pokedex-xy", classes: ["ruby"], detailAnchor: "or" },
  "alpha-sapphire": { dexPath: "pokedex-xy", classes: ["sapphire"], detailAnchor: "as" },
  sun: { dexPath: "pokedex-sm", classes: ["foosun"], detailAnchor: "sun" },
  moon: { dexPath: "pokedex-sm", classes: ["foomoon"], detailAnchor: "moon" },
  "ultra-sun": { dexPath: "pokedex-sm", classes: ["foousun"], detailAnchor: "ultrasun" },
  "ultra-moon": { dexPath: "pokedex-sm", classes: ["fooumoon"], detailAnchor: "ultramoon" },
  "lets-go-pikachu": { dexPath: "pokedex-sm", classes: ["foopika", "foopikachu"] },
  "lets-go-eevee": { dexPath: "pokedex-sm", classes: ["fooeevee"] },
  sword: { dexPath: "pokedex-swsh", classes: ["foox"], locationTableClasses: ["lgpika"] },
  shield: { dexPath: "pokedex-swsh", classes: ["fooy"], locationTableClasses: ["lgeevee"] },
  "brilliant-diamond": { dexPath: "pokedex-swsh", classes: ["diamond"], detailAnchor: "bd" },
  "shining-pearl": { dexPath: "pokedex-swsh", classes: ["pearl"], detailAnchor: "sp" },
  "legends-arceus": { dexPath: "pokedex-swsh", classes: ["fooeevee"] },
  scarlet: { dexPath: "pokedex-sv", classes: ["scarlet"] },
  violet: { dexPath: "pokedex-sv", classes: ["violet"] },
};

const cacheRevalidateSeconds = 60 * 60 * 24 * 7;

export const revalidate = 604800;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pokemonId = Number(searchParams.get("pokemonId"));
  const gameId = searchParams.get("gameId") ?? "";
  const pokemonName = searchParams.get("name") ?? "";

  if (!Number.isInteger(pokemonId) || pokemonId <= 0 || !pokemonName || !serebiiGameConfigs[gameId]) {
    return NextResponse.json({ rows: [] });
  }

  try {
    const rows = await getSerebiiEncounterRows(pokemonId, pokemonName, gameId);
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}

async function getSerebiiEncounterRows(pokemonId: number, pokemonName: string, gameId: string): Promise<ExternalEncounterRow[]> {
  const config = serebiiGameConfigs[gameId];
  const dexHtml = await fetchText(`https://www.serebii.net/${config.dexPath}/${pokemonId}.shtml`);
  const locations = getSerebiiLocationLinks(dexHtml, config.classes);

  if (locations.length === 0) {
    return getSerebiiDetailedLocationRows(config, pokemonId);
  }

  const rows = await Promise.all(
    locations.map(async (location) => {
      const levels = await getSerebiiLocationLevels(location.href, pokemonId, pokemonName, config);

      if (!levels) {
        return null;
      }

      return {
        location: location.name,
        levels,
        methods: "Wild encounter from Serebii Pokearth spawn data.",
        chance: null,
        source: "Wild",
      };
    }),
  );

  const parsedRows = rows.filter((row): row is ExternalEncounterRow => Boolean(row));

  if (parsedRows.length > 0) {
    return parsedRows;
  }

  return getSerebiiDetailedLocationRows(config, pokemonId);
}

function getSerebiiLocationLinks(html: string, gameClasses: string[]) {
  const rowMatches = gameClasses.flatMap((gameClass) => [
    ...html.matchAll(
      new RegExp(`<td class="${gameClass}"[^>]*>[\\s\\S]*?<\\/td>\\s*<td class="fooinfo"[^>]*>([\\s\\S]*?)<\\/td>`, "gi"),
    ),
  ]);

  const links = rowMatches.flatMap((rowMatch) =>
    [...rowMatch[1].matchAll(/<a href="(\/pokearth\/[^"]+)">([\s\S]*?)<\/a>/g)].map((match) => ({
      href: `https://www.serebii.net${match[1]}`,
      name: decodeHtml(match[2]),
    })),
  );

  return links.filter((link, index, all) => all.findIndex((item) => item.href === link.href) === index);
}

async function getSerebiiLocationLevels(
  locationUrl: string,
  pokemonId: number,
  pokemonName: string,
  config: SerebiiGameConfig,
) {
  const locationHtml = await fetchText(locationUrl);
  const tableIds = getPokemonTableIds(locationHtml, pokemonId);

  if (tableIds.length === 0) {
    return getPokemonLevelFromSpawnTable(locationHtml, pokemonName, config.locationTableClasses);
  }

  const locationBase = locationUrl.replace(/\/[^/]+$/, "");
  const levelRanges = await Promise.all(
    tableIds.slice(0, 80).map(async (tableId) => {
      const tableHtml = await fetchText(`${locationBase}/spawntable/${tableId}.txt`);
      return getPokemonLevelFromSpawnTable(tableHtml, pokemonName, config.locationTableClasses);
    }),
  );
  const parsedLevels = levelRanges.flatMap((range) => parseLevelRange(range));

  if (parsedLevels.length === 0) {
    return null;
  }

  const min = Math.min(...parsedLevels);
  const max = Math.max(...parsedLevels);

  return min === max ? String(min) : `${min}-${max}`;
}

function getPokemonTableIds(html: string, pokemonId: number) {
  const matches = [...html.matchAll(new RegExp(`\\b${pokemonId}\\d*:\\s*\\{\\s*tableIDs:\\s*\\[([^\\]]+)\\]`, "g"))];
  const ids = matches.flatMap((match) =>
    match[1]
      .split(",")
      .map((part) => Number(part.trim()))
      .filter(Number.isInteger),
  );

  return [...new Set(ids)];
}

function getPokemonLevelFromSpawnTable(html: string, pokemonName: string, sectionClasses?: string[]) {
  const groups = sectionClasses
    ? html
        .split(/<table/i)
        .filter((group) => sectionClasses.some((sectionClass) => group.includes(`class="${sectionClass}"`)))
        .map((group) => `<table${group}`)
    : html.split(/<tr>\s*<\/tr>/i);
  const normalizedName = normalizePokemonName(pokemonName);

  for (const group of groups) {
    const names = [...group.matchAll(/class="name">([^<]+)<\/td>/g)].map((match) => decodeHtml(match[1]));
    const index = names.findIndex((name) => normalizePokemonName(name) === normalizedName);

    if (index === -1) {
      continue;
    }

    const levels = [...group.matchAll(/<b>Level<\/b><br\s*\/?>\s*([^<]+?)\s*<\/td>/g)].map((match) =>
      decodeHtml(match[1]).replace(/\s+/g, " ").trim(),
    );
    const directLevels = [...group.matchAll(/class="level"[^>]*>\s*([^<]+?)\s*<\/td>/g)].map((match) =>
      decodeHtml(match[1]).replace(/\s+/g, " ").trim(),
    );

    const level = levels[index] ?? directLevels[index] ?? null;
    return level ? normalizeLevelText(level) : null;
  }

  return null;
}

async function getSerebiiDetailedLocationRows(config: SerebiiGameConfig, pokemonId: number): Promise<ExternalEncounterRow[]> {
  if (!config.detailAnchor) {
    return [];
  }

  const html = await fetchText(`https://www.serebii.net/${config.dexPath}/location/${pokemonId}.shtml`);
  const anchorIndex = html.search(new RegExp(`<a name="${config.detailAnchor}"`, "i"));

  if (anchorIndex === -1) {
    return [];
  }

  const nextSectionIndex = html.slice(anchorIndex + 1).search(/<table class="dextable"><tr >\s*<td class="fooevo"/i);
  const section =
    nextSectionIndex === -1 ? html.slice(anchorIndex) : html.slice(anchorIndex, anchorIndex + 1 + nextSectionIndex);
  const rows = [...section.matchAll(/<a href="\/pokearth\/[^"]+">([\s\S]*?)<\/a>[\s\S]*?<td class="fooinfo">Lv\.\s*([^<]+)<\/td>/g)]
    .map((match) => ({
      location: decodeHtml(match[1]),
      levels: normalizeLevelText(match[2]),
      methods: "Wild encounter from Serebii location details.",
      chance: null,
      source: "Wild",
    }))
    .filter((row) => row.levels);

  return rows.filter((row, index, all) => all.findIndex((item) => item.location === row.location && item.levels === row.levels) === index);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Route Zero encounter fallback",
    },
    next: { revalidate: cacheRevalidateSeconds },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.text();
}

function parseLevelRange(levels: string | null) {
  if (!levels) {
    return [];
  }

  return [...levels.matchAll(/\d+/g)].map((match) => Number(match[0])).filter(Number.isFinite);
}

function normalizeLevelText(levels: string) {
  return decodeHtml(levels)
    .replace(/^Lv\.\s*/i, "")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePokemonName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function decodeHtml(value: string) {
  return value
    .replace(/&eacute;/g, "e")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .trim();
}
