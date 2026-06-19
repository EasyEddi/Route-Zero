import { NextResponse } from "next/server";

type ExternalEncounterRow = {
  location: string;
  levels: string;
  methods: string;
  chance: number | null;
  source: string;
};

type EncounterDetail = {
  levels: string;
  chance: number | null;
  method: string;
};

type SerebiiGameConfig = {
  dexPath: string;
  classes: string[];
  detailAnchor?: string;
  locationTableClasses?: string[];
};

type VeekunCsvRow = Record<string, string>;

type VeekunData = {
  versionIdByIdentifier: Map<string, number>;
  encounters: VeekunCsvRow[];
  slotById: Map<number, VeekunCsvRow>;
  methodIdentifierById: Map<number, string>;
  locationAreaById: Map<number, VeekunCsvRow>;
  locationNameById: Map<number, string>;
  areaNameById: Map<number, string>;
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

const veekunVersionIdentifierMap: Record<string, string> = {
  red: "red",
  blue: "blue",
  yellow: "yellow",
  gold: "gold",
  silver: "silver",
  crystal: "crystal",
  ruby: "ruby",
  sapphire: "sapphire",
  emerald: "emerald",
  "fire-red": "firered",
  "leaf-green": "leafgreen",
  diamond: "diamond",
  pearl: "pearl",
  platinum: "platinum",
  "heart-gold": "heartgold",
  "soul-silver": "soulsilver",
  black: "black",
  white: "white",
  "black-2": "black-2",
  "white-2": "white-2",
  x: "x",
  y: "y",
  "omega-ruby": "omega-ruby",
  "alpha-sapphire": "alpha-sapphire",
  sun: "sun",
  moon: "moon",
  "ultra-sun": "ultra-sun",
  "ultra-moon": "ultra-moon",
  "lets-go-pikachu": "lets-go-pikachu",
  "lets-go-eevee": "lets-go-eevee",
  sword: "sword",
  shield: "shield",
};

const pokemonDbGameClassMap: Record<string, string[]> = {
  red: ["red"],
  blue: ["blue"],
  yellow: ["yellow"],
  gold: ["gold"],
  silver: ["silver"],
  crystal: ["crystal"],
  ruby: ["ruby"],
  sapphire: ["sapphire"],
  emerald: ["emerald"],
  "fire-red": ["firered"],
  "leaf-green": ["leafgreen"],
  diamond: ["diamond"],
  pearl: ["pearl"],
  platinum: ["platinum"],
  "heart-gold": ["heartgold"],
  "soul-silver": ["soulsilver"],
  black: ["black"],
  white: ["white"],
  "black-2": ["black-2"],
  "white-2": ["white-2"],
  x: ["x"],
  y: ["y"],
  "omega-ruby": ["omega-ruby"],
  "alpha-sapphire": ["alpha-sapphire"],
  sun: ["sun"],
  moon: ["moon"],
  "ultra-sun": ["ultra-sun"],
  "ultra-moon": ["ultra-moon"],
  "lets-go-pikachu": ["lets-go-pikachu"],
  "lets-go-eevee": ["lets-go-eevee"],
  sword: ["sword"],
  shield: ["shield"],
  "brilliant-diamond": ["brilliant-diamond"],
  "shining-pearl": ["shining-pearl"],
  "legends-arceus": ["legends-arceus"],
  scarlet: ["scarlet"],
  violet: ["violet"],
};

const cacheRevalidateSeconds = 60 * 60 * 24 * 7;
const veekunCsvBaseUrl = "https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv";
let veekunDataPromise: Promise<VeekunData> | null = null;

export const revalidate = 604800;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pokemonId = Number(searchParams.get("pokemonId"));
  const gameId = searchParams.get("gameId") ?? "";
  const pokemonName = searchParams.get("name") ?? "";

  if (
    !Number.isInteger(pokemonId) ||
    pokemonId <= 0 ||
    !pokemonName ||
    (!serebiiGameConfigs[gameId] && !veekunVersionIdentifierMap[gameId] && !pokemonDbGameClassMap[gameId])
  ) {
    return NextResponse.json({ rows: [] });
  }

  try {
    const rows = await getExternalEncounterRows(pokemonId, pokemonName, gameId);
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}

async function getExternalEncounterRows(pokemonId: number, pokemonName: string, gameId: string) {
  const serebiiRows = serebiiGameConfigs[gameId]
    ? await getSerebiiEncounterRows(pokemonId, pokemonName, gameId).catch(() => [])
    : [];

  if (serebiiRows.length > 0) {
    return serebiiRows;
  }

  const veekunRows = await getVeekunEncounterRows(pokemonId, gameId).catch(() => []);

  if (veekunRows.length > 0) {
    return veekunRows;
  }

  return getPokemonDbEncounterRows(pokemonName, gameId).catch(() => []);
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
      const details = await getSerebiiLocationDetails(location.href, pokemonId, pokemonName, config);

      if (details.length === 0) {
        return null;
      }

      return details.map((detail) => ({
        location: location.name,
        levels: detail.levels,
        methods: detail.method,
        chance: detail.chance,
        source: "Wild",
      }));
    }),
  );

  const parsedRows = summarizeEncounterRows(rows.flat().filter((row): row is ExternalEncounterRow => Boolean(row)));

  if (parsedRows.length > 0) {
    return parsedRows;
  }

  return getSerebiiDetailedLocationRows(config, pokemonId);
}

async function getVeekunEncounterRows(pokemonId: number, gameId: string): Promise<ExternalEncounterRow[]> {
  const versionIdentifier = veekunVersionIdentifierMap[gameId];

  if (!versionIdentifier) {
    return [];
  }

  const data = await getVeekunData();
  const versionId = data.versionIdByIdentifier.get(versionIdentifier);

  if (!versionId) {
    return [];
  }

  const rows = data.encounters.flatMap((encounter) => {
    if (Number(encounter.version_id) !== versionId || Number(encounter.pokemon_id) !== pokemonId) {
      return [];
    }

    const slot = data.slotById.get(Number(encounter.encounter_slot_id));
    const area = data.locationAreaById.get(Number(encounter.location_area_id));

    if (!slot || !area) {
      return [];
    }

    const methodIdentifier = data.methodIdentifierById.get(Number(slot.encounter_method_id)) ?? "";

    return [
      {
        location: getVeekunLocationName(data, area),
        levels: getVeekunLevelText(encounter.min_level, encounter.max_level),
        methods: describeMethod(methodIdentifier),
        chance: parseChance(slot.rarity),
        source: getVeekunSource(methodIdentifier),
      },
    ];
  });

  return summarizeEncounterRows(rows);
}

async function getVeekunData(): Promise<VeekunData> {
  if (!veekunDataPromise) {
    veekunDataPromise = loadVeekunData();
  }

  return veekunDataPromise;
}

async function loadVeekunData(): Promise<VeekunData> {
  const [
    versions,
    encounters,
    encounterSlots,
    encounterMethods,
    locationAreas,
    locationNames,
    locationAreaProse,
  ] = await Promise.all([
    fetchVeekunCsv("versions.csv"),
    fetchVeekunCsv("encounters.csv"),
    fetchVeekunCsv("encounter_slots.csv"),
    fetchVeekunCsv("encounter_methods.csv"),
    fetchVeekunCsv("location_areas.csv"),
    fetchVeekunCsv("location_names.csv"),
    fetchVeekunCsv("location_area_prose.csv"),
  ]);

  return {
    versionIdByIdentifier: new Map(versions.map((row) => [row.identifier, Number(row.id)])),
    encounters,
    slotById: new Map(encounterSlots.map((row) => [Number(row.id), row])),
    methodIdentifierById: new Map(encounterMethods.map((row) => [Number(row.id), row.identifier])),
    locationAreaById: new Map(locationAreas.map((row) => [Number(row.id), row])),
    locationNameById: new Map(
      locationNames.filter((row) => row.local_language_id === "9").map((row) => [Number(row.location_id), row.name]),
    ),
    areaNameById: new Map(
      locationAreaProse
        .filter((row) => row.local_language_id === "9" && row.name)
        .map((row) => [Number(row.location_area_id), row.name]),
    ),
  };
}

async function fetchVeekunCsv(fileName: string) {
  return parseCsv(await fetchText(`${veekunCsvBaseUrl}/${fileName}`));
}

function getVeekunLocationName(data: VeekunData, area: VeekunCsvRow) {
  const locationId = Number(area.location_id);
  const locationName = data.locationNameById.get(locationId) ?? formatIdentifier(area.identifier);
  const areaName = data.areaNameById.get(Number(area.id)) ?? formatIdentifier(area.identifier);

  if (!areaName || areaName.toLowerCase() === locationName.toLowerCase()) {
    return locationName;
  }

  return `${locationName} - ${formatLocationArea(areaName)}`;
}

function getVeekunLevelText(minLevel: string, maxLevel: string) {
  const min = Number(minLevel);
  const max = Number(maxLevel);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return "varies";
  }

  return min === max ? String(min) : `${min}-${max}`;
}

function getVeekunSource(methodIdentifier: string) {
  if (methodIdentifier === "gift-egg") {
    return "Egg";
  }

  if (methodIdentifier === "gift") {
    return "Gift";
  }

  return "Wild";
}

async function getPokemonDbEncounterRows(pokemonName: string, gameId: string): Promise<ExternalEncounterRow[]> {
  const gameClasses = pokemonDbGameClassMap[gameId];

  if (!gameClasses) {
    return [];
  }

  const html = await fetchText(`https://pokemondb.net/pokedex/${getPokemonDbSlug(pokemonName)}`);
  const locationsSection = getPokemonDbLocationsSection(html);

  if (!locationsSection) {
    return [];
  }

  const rows = [...locationsSection.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const rowHtml = match[1];
    const headerHtml = rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? "";
    const cellHtml = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "";

    if (!gameClasses.some((gameClass) => new RegExp(`class="[^"]*\\b${escapeRegExp(gameClass)}\\b`, "i").test(headerHtml))) {
      return [];
    }

    const locations = getPokemonDbLocations(cellHtml);

    if (locations.length === 0) {
      return [];
    }

    return locations.map((location) => ({
      location,
      levels: "varies",
      methods: "Listed as an in-game location by Pokemon Database. Exact encounter slots vary by area or subtable.",
      chance: null,
      source: "Wild",
    }));
  });

  return summarizeEncounterRows(rows);
}

function getPokemonDbLocationsSection(html: string) {
  const headingIndex = html.search(/<h2[^>]*>\s*Where to find/i);

  if (headingIndex === -1) {
    return null;
  }

  const sectionStart = html.slice(headingIndex);
  const tableMatch = sectionStart.match(/<table class="vitals-table">([\s\S]*?)<\/table>/i);
  return tableMatch?.[1] ?? null;
}

function getPokemonDbLocations(cellHtml: string) {
  const text = normalizeCellText(cellHtml).toLowerCase();

  if (
    !text ||
    text.includes("trade/migrate") ||
    text.includes("not available") ||
    text.includes("location data not yet available")
  ) {
    return [];
  }

  const linkedLocations = [...cellHtml.matchAll(/<a [^>]*href="\/location\/[^"]+"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => normalizeCellText(match[1]))
    .filter(Boolean);

  if (linkedLocations.length > 0) {
    return linkedLocations;
  }

  const plainLocation = normalizeCellText(cellHtml);
  return plainLocation ? [plainLocation] : [];
}

function getPokemonDbSlug(pokemonName: string) {
  return pokemonName
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

async function getSerebiiLocationDetails(
  locationUrl: string,
  pokemonId: number,
  pokemonName: string,
  config: SerebiiGameConfig,
) {
  const locationHtml = await fetchText(locationUrl);
  const tableIds = getPokemonTableIds(locationHtml, pokemonId);

  if (tableIds.length === 0) {
    return getPokemonEncounterDetailsFromTables(locationHtml, pokemonName, config.locationTableClasses);
  }

  const locationBase = locationUrl.replace(/\/[^/]+$/, "");
  const details = await Promise.all(
    tableIds.slice(0, 80).map(async (tableId) => {
      const tableHtml = await fetchText(`${locationBase}/spawntable/${tableId}.txt`);
      return getPokemonEncounterDetailsFromTables(tableHtml, pokemonName, config.locationTableClasses);
    }),
  );
  const flattenedDetails = details.flat();
  const parsedLevels = flattenedDetails.flatMap((detail) => parseLevelRange(detail.levels));

  if (parsedLevels.length === 0) {
    return flattenedDetails;
  }

  const min = Math.min(...parsedLevels);
  const max = Math.max(...parsedLevels);
  const chance = getBestChance(flattenedDetails.map((detail) => detail.chance));
  const methods = [...new Set(flattenedDetails.map((detail) => detail.method))];

  return [
    {
      levels: min === max ? String(min) : `${min}-${max}`,
      chance,
      method: methods.length === 1 ? methods[0] : "Catch in this area's listed wild encounter tables.",
    },
  ];
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

function getPokemonEncounterDetailsFromTables(html: string, pokemonName: string, sectionClasses?: string[]): EncounterDetail[] {
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

    const method = getSerebiiMethodText(group);
    const levels = [...group.matchAll(/<b>Level<\/b><br\s*\/?>\s*([^<]+?)\s*<\/td>/g)].map((match) =>
      decodeHtml(match[1]).replace(/\s+/g, " ").trim(),
    );
    const directLevels = [...group.matchAll(/class="level"[^>]*>\s*([^<]+?)\s*<\/td>/g)].map((match) =>
      decodeHtml(match[1]).replace(/\s+/g, " ").trim(),
    );
    const rates = [...group.matchAll(/class="rate"[^>]*>\s*([^<]+?)\s*<\/td>/g)].map((match) => parseChance(match[1]));

    const level = levels[index] ?? directLevels[index] ?? null;
    if (!level) {
      continue;
    }

    return [
      {
        levels: normalizeLevelText(level),
        chance: rates[index] ?? null,
        method,
      },
    ];
  }

  return [];
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
  const rows = getDetailedRowsFromLocationSection(section)
    .filter((row) => row.levels);

  return summarizeEncounterRows(rows);
}

function getDetailedRowsFromLocationSection(section: string): ExternalEncounterRow[] {
  const tables = section
    .split(/<table class="dextable"/i)
    .slice(1)
    .map((table) => `<table class="dextable"${table}`);
  const parseTargets = tables.length > 0 ? tables : [section];

  return parseTargets.flatMap((table) => {
    const headers = [...table.matchAll(/class="lochead"[^>]*>([\s\S]*?)<\/td>/g)].map((match) =>
      normalizeCellText(match[1]).toLowerCase(),
    );
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);

    return rows.flatMap((rowHtml) => {
      const cells = [...rowHtml.matchAll(/class="fooinfo"[^>]*>([\s\S]*?)<\/td>/g)].map((match) => normalizeCellText(match[1]));

      if (cells.length < 2) {
        return [];
      }

      const location = getCellValue(headers, cells, "location") ?? cells[0];
      const method = getCellValue(headers, cells, "method");
      const time = getCellValue(headers, cells, "time");
      const rarity = getCellValue(headers, cells, "rarity");
      const area =
        getCellValue(headers, cells, "grass patch") ??
        getCellValue(headers, cells, "area") ??
        getCellValue(headers, cells, "details");
      const level = getCellValue(headers, cells, "level") ?? cells[cells.length - 1];

      if (!location || !level || !/\d/.test(level)) {
        return [];
      }

      return [
        {
          location,
          levels: normalizeLevelText(level),
          methods: describeSerebiiDetailedMethod(method, time, area),
          chance: parseChance(rarity),
          source: "Wild",
        },
      ];
    });
  });
}

function getCellValue(headers: string[], cells: string[], label: string) {
  const index = headers.findIndex((header) => header.includes(label));
  return index === -1 ? null : cells[index] ?? null;
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

function summarizeEncounterRows(rows: ExternalEncounterRow[]) {
  const grouped = new Map<string, ExternalEncounterRow>();

  rows.forEach((row) => {
    const location = normalizeEncounterLocation(row.location);
    const baseMethod = getBaseMethodText(row.methods);
    const key = [location, row.levels, baseMethod, row.source].join("|");
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...row, location, methods: row.methods });
      return;
    }

    existing.methods = mergeMethodText(existing.methods, row.methods);
    existing.location = location;
    existing.chance = getBestChance([existing.chance, row.chance]);
  });

  return [...grouped.values()].filter(
    (row, index, all) =>
      all.findIndex(
        (item) =>
          item.location === row.location &&
          item.levels === row.levels &&
          item.methods === row.methods &&
          item.chance === row.chance &&
          item.source === row.source,
      ) === index,
  );
}

function getBaseMethodText(method: string) {
  return method.replace(/\s+Available during [^.]+\./gi, "").trim();
}

function mergeMethodText(existing: string, incoming: string) {
  const base = getBaseMethodText(existing);
  const times = [...existing.matchAll(/Available during ([^.]+)\./gi), ...incoming.matchAll(/Available during ([^.]+)\./gi)].map(
    (match) => match[1].toLowerCase(),
  );
  const uniqueTimes = [...new Set(times)];

  if (uniqueTimes.length === 0) {
    return existing;
  }

  return `${base} Available during ${uniqueTimes.join(" or ")}.`;
}

function normalizeEncounterLocation(location: string) {
  return location
    .replace(/\s+\d+\s+(East|West|North|South)$/i, "")
    .replace(/\s+Middle$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getBestChance(chances: (number | null)[]) {
  const numericChances = chances.filter((chance): chance is number => typeof chance === "number");
  return numericChances.length > 0 ? Math.max(...numericChances) : null;
}

function getSerebiiMethodText(html: string) {
  const titleMatch =
    html.match(/<a name="[^"]+">\s*<h4>([\s\S]*?)<\/h4>\s*<\/a>/i) ??
    html.match(/<a name="[^"]+">([\s\S]*?)<\/a>/i);
  const title = titleMatch ? normalizeCellText(titleMatch[1]) : "";
  return describeMethod(title);
}

function describeSerebiiDetailedMethod(method: string | null, time: string | null, area: string | null) {
  const parts = [describeMethod(method ?? "Wild encounter")];

  if (time && !/^all day$/i.test(time)) {
    parts.push(`Available during ${time.toLowerCase()}.`);
  }

  if (area && !/^all areas$/i.test(area)) {
    parts.push(`Specific area: ${area}.`);
  }

  return parts.join(" ");
}

function describeMethod(method: string) {
  const normalized = method
    .replace(/-/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("gift egg")) {
    return "Receive this Pokemon as an egg from an in-game NPC or event source.";
  }

  if (lower.includes("gift")) {
    return "Receive this Pokemon directly from an in-game NPC or event source.";
  }

  if (lower.includes("super rod")) {
    return "Fish here with the Super Rod.";
  }

  if (lower.includes("good rod")) {
    return "Fish here with the Good Rod.";
  }

  if (lower.includes("old rod")) {
    return "Fish here with the Old Rod.";
  }

  if (lower.includes("surf")) {
    return "Encounter while surfing on water.";
  }

  if (lower.includes("rock smash")) {
    return "Break cracked rocks in this area to encounter it.";
  }

  if (lower.includes("headbutt")) {
    return "Use Headbutt on trees in this area to encounter it.";
  }

  if (lower.includes("dark grass")) {
    return "Encounter while walking through dark grass in this area.";
  }

  if (lower.includes("grass spots")) {
    return "Encounter in rustling grass spots in this area.";
  }

  if (lower.includes("cave spots")) {
    return "Encounter in dust cloud spots inside this cave.";
  }

  if (lower.includes("bridge spots")) {
    return "Encounter in shadow spots on this bridge.";
  }

  if (lower.includes("yellow flowers") || lower.includes("purple flowers") || lower.includes("red flowers")) {
    return `Encounter while walking through ${lower} in this area.`;
  }

  if (lower.includes("rough terrain")) {
    return "Encounter while moving through rough terrain in this area.";
  }

  if (lower.includes("grass") || lower.includes("walk")) {
    return "Encounter while walking through grass or the listed wild area.";
  }

  if (lower.includes("curry")) {
    return "Can appear after making curry in camp.";
  }

  if (lower.includes("overworld")) {
    return "Visible overworld encounter in this area.";
  }

  if (lower.includes("wild pok")) {
    return "Catch as a wild Pokemon in this area.";
  }

  if (normalized) {
    return `Use ${normalized.toLowerCase()} in this area.`;
  }

  return "Catch in this area's listed wild encounter table.";
}

function parseChance(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = decodeHtml(value).match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCellText(value: string) {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(text: string): VeekunCsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(value);
      value = "";
      continue;
    }

    value += char;
  }

  values.push(value);
  return values;
}

function formatIdentifier(value: string) {
  return value
    .replace(/--/g, "-")
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^\d+f$/i.test(part)) {
        return part.toUpperCase();
      }

      if (/^b\d+f$/i.test(part)) {
        return part.toUpperCase();
      }

      if (part === "ss") {
        return "S.S.";
      }

      if (part === "mt") {
        return "Mt.";
      }

      if (part === "pokemon" || part === "poke") {
        return "Pokemon";
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function formatLocationArea(value: string) {
  return value
    .replace(/\b1F\b/g, "1st floor")
    .replace(/\b2F\b/g, "2nd floor")
    .replace(/\b3F\b/g, "3rd floor")
    .replace(/\b([4-9])F\b/g, "$1th floor")
    .replace(/\bB1F\b/g, "basement 1")
    .replace(/\bB2F\b/g, "basement 2")
    .replace(/\bB3F\b/g, "basement 3")
    .replace(/\bB4F\b/g, "basement 4")
    .replace(/\bB5F\b/g, "basement 5");
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
    .replace(/Pok�mon/g, "Pokemon")
    .replace(/<[^>]+>/g, "")
    .trim();
}
