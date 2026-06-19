import { NextResponse } from "next/server";

type ExternalEncounterRow = {
  location: string;
  levels: string;
  methods: string;
  chance: null;
  source: string;
};

const serebiiGameClasses: Record<string, string> = {
  scarlet: "scarlet",
  violet: "violet",
};

const cacheRevalidateSeconds = 60 * 60 * 24 * 7;

export const revalidate = 604800;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pokemonId = Number(searchParams.get("pokemonId"));
  const gameId = searchParams.get("gameId") ?? "";
  const pokemonName = searchParams.get("name") ?? "";

  if (!Number.isInteger(pokemonId) || pokemonId <= 0 || !pokemonName || !serebiiGameClasses[gameId]) {
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
  const dexHtml = await fetchText(`https://www.serebii.net/pokedex-sv/${pokemonId}.shtml`);
  const locations = getSerebiiLocationLinks(dexHtml, gameId);

  if (locations.length === 0) {
    return [];
  }

  const rows = await Promise.all(
    locations.map(async (location) => {
      const levels = await getSerebiiLocationLevels(location.href, pokemonId, pokemonName);

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

  return rows.filter((row): row is ExternalEncounterRow => Boolean(row));
}

function getSerebiiLocationLinks(html: string, gameId: string) {
  const gameClass = serebiiGameClasses[gameId];
  const rowMatch = html.match(
    new RegExp(`<td class="${gameClass}"[^>]*>.*?<\\/td>\\s*<td class="fooinfo"[^>]*>([\\s\\S]*?)<\\/td>`, "i"),
  );

  if (!rowMatch) {
    return [];
  }

  const links = [...rowMatch[1].matchAll(/<a href="(\/pokearth\/[^"]+)">([^<]+)<\/a>/g)].map((match) => ({
    href: `https://www.serebii.net${match[1]}`,
    name: decodeHtml(match[2]),
  }));

  return links.filter((link, index, all) => all.findIndex((item) => item.href === link.href) === index);
}

async function getSerebiiLocationLevels(locationUrl: string, pokemonId: number, pokemonName: string) {
  const locationHtml = await fetchText(locationUrl);
  const tableIds = getPokemonTableIds(locationHtml, pokemonId);

  if (tableIds.length === 0) {
    return null;
  }

  const locationBase = locationUrl.replace(/\/[^/]+$/, "");
  const levelRanges = await Promise.all(
    tableIds.slice(0, 80).map(async (tableId) => {
      const tableHtml = await fetchText(`${locationBase}/spawntable/${tableId}.txt`);
      return getPokemonLevelFromSpawnTable(tableHtml, pokemonName);
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

function getPokemonLevelFromSpawnTable(html: string, pokemonName: string) {
  const groups = html.split(/<tr>\s*<\/tr>/i);
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

    return levels[index] ?? null;
  }

  return null;
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
