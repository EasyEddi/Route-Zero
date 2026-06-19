"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import {
  Ban,
  Copy,
  Crown,
  Dice5,
  Dna,
  Eye,
  Gamepad2,
  Info,
  MapPin,
  Search,
  X,
  Mountain,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Moon,
  Repeat2,
  Sun,
  Tags,
  Users,
} from "lucide-react";
import { games } from "@/data/games";
import { pokemon } from "@/data/pokemon";
import { pokemonTypes } from "@/data/types";
import { getSpecialPokemonLabels } from "@/lib/pokemon-tags";
import { applyFilters, rollTeam } from "@/lib/team-generator";
import type { PokemonEntry, TeamFilters } from "@/lib/types";

const defaultFilters: TeamFilters = {
  gameId: "",
  teamSize: 6,
  bannedTypes: [],
  fullyEvolvedOnly: false,
  allowEventPokemon: false,
  allowTradePokemon: false,
  allowRoamingPokemon: false,
  allowLegendaryPokemon: false,
  allowParadoxPokemon: false,
  allowDuplicatePokemon: false,
  allowDuplicateTypes: false,
};

const typeLabels: Record<string, string> = {
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

export default function Home() {
  const [filters, setFilters] = useState<TeamFilters>(defaultFilters);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isPoolOpen, setIsPoolOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isTeamSizeOpen, setIsTeamSizeOpen] = useState(false);
  const [detailPokemon, setDetailPokemon] = useState<PokemonEntry | null>(null);
  const [tagExplorer, setTagExplorer] = useState<TagExplorer | null>(null);
  const [tagExplorerSearch, setTagExplorerSearch] = useState("");
  const [evolutionInfo, setEvolutionInfo] = useState<EvolutionInfo | null>(null);
  const [canHatchFromEgg, setCanHatchFromEgg] = useState(false);
  const [encounterRows, setEncounterRows] = useState<EncounterRow[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [poolSearch, setPoolSearch] = useState("");
  const [gameSearch, setGameSearch] = useState("");
  const [rollingSlots, setRollingSlots] = useState<PokemonEntry[]>([]);
  const [shinyCards, setShinyCards] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const rollIntervalRef = useRef<number | null>(null);
  const rollTimeoutsRef = useRef<number[]>([]);
  const rollRunRef = useRef(0);

  const selectedGame = games.find((game) => game.id === filters.gameId);
  const team = useMemo(
    () => teamIds.map((id) => pokemon.find((entry) => entry.id === id)).filter(Boolean),
    [teamIds],
  );

  const availableCount = useMemo(() => {
    return rollTeam(filters, pokemon, { dryRun: true }).availableCount;
  }, [filters]);
  const currentPool = useMemo(() => applyFilters(filters, pokemon), [filters]);
  const searchedPool = useMemo(() => {
    const query = poolSearch.trim().toLowerCase();

    if (!query) {
      return currentPool;
    }

    return currentPool.filter((entry) => {
      const dexNumber = String(entry.id).padStart(3, "0");
      return entry.name.toLowerCase().startsWith(query) || dexNumber.startsWith(query);
    });
  }, [currentPool, poolSearch]);
  const searchedGames = useMemo(() => {
    const query = gameSearch.trim().toLowerCase();

    if (!query) {
      return games;
    }

    return games.filter((game) => game.name.toLowerCase().includes(query) || game.shortName.toLowerCase().includes(query));
  }, [gameSearch]);
  const tagExplorerPool = useMemo(() => {
    if (!tagExplorer) {
      return [];
    }

    return currentPool.filter((entry) => {
      if (tagExplorer.kind === "type") {
        return entry.types.includes(tagExplorer.value);
      }

      return getAvailabilityNotes(entry, filters.gameId).includes(tagExplorer.value);
    });
  }, [currentPool, filters.gameId, tagExplorer]);
  const searchedTagExplorerPool = useMemo(() => {
    const query = tagExplorerSearch.trim().toLowerCase();

    if (!query) {
      return tagExplorerPool;
    }

    return tagExplorerPool.filter((entry) => {
      const dexNumber = String(entry.id).padStart(3, "0");
      return entry.name.toLowerCase().startsWith(query) || dexNumber.startsWith(query);
    });
  }, [tagExplorerPool, tagExplorerSearch]);
  const detailEncounterRows = useMemo(() => {
    if (!detailPokemon || !filters.gameId) {
      return [];
    }

    const specialRows = getSpecialEncounterRows(detailPokemon, filters.gameId, evolutionInfo, canHatchFromEgg);

    if (encounterRows.length > 0) {
      return mergeEncounterRows([...encounterRows, ...specialRows]);
    }

    return mergeEncounterRows(getFallbackEncounterRows(detailPokemon, filters.gameId, evolutionInfo, canHatchFromEgg));
  }, [canHatchFromEgg, detailPokemon, encounterRows, evolutionInfo, filters.gameId]);

  useEffect(() => {
    return () => {
      if (rollIntervalRef.current !== null) {
        window.clearInterval(rollIntervalRef.current);
      }

      rollTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    if (!detailPokemon || !filters.gameId) {
      setEncounterRows([]);
      setIsDetailLoading(false);
      setDetailError(null);
      return;
    }

    const controller = new AbortController();
    setIsDetailLoading(true);
    setDetailError(null);

    void fetch(`https://pokeapi.co/api/v2/pokemon/${detailPokemon.id}/encounters`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Encounter data could not be loaded.");
        }

        return response.json() as Promise<PokeApiEncounter[]>;
      })
      .then((encounters) => {
        const versionId = getPokeApiVersionId(filters.gameId);
        const rows = getEncounterRows(encounters, versionId);

        if (rows.length > 0) {
          setEncounterRows(rows);
          return null;
        }

        return fetch(
          `/api/encounters?pokemonId=${detailPokemon.id}&gameId=${filters.gameId}&name=${encodeURIComponent(
            detailPokemon.name,
          )}`,
          { signal: controller.signal },
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error("External encounter fallback could not be loaded.");
            }

            return response.json() as Promise<{ rows: EncounterRow[] }>;
          })
          .then((payload) => {
            setEncounterRows(payload.rows);
          });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setDetailError("Encounter details are unavailable right now.");
        setEncounterRows([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsDetailLoading(false);
        }
      });

    return () => controller.abort();
  }, [detailPokemon, filters.gameId]);

  useEffect(() => {
    if (!detailPokemon) {
      setEvolutionInfo(null);
      setCanHatchFromEgg(false);
      return;
    }

    const controller = new AbortController();
    setEvolutionInfo(null);
    setCanHatchFromEgg(false);

    void fetch(`https://pokeapi.co/api/v2/pokemon-species/${detailPokemon.id}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Species data could not be loaded.");
        }

        return response.json() as Promise<PokeApiSpecies>;
      })
      .then((species) => {
        if (!controller.signal.aborted) {
          setCanHatchFromEgg(canPokemonSpeciesHatchFromEgg(species));
        }

        return fetch(species.evolution_chain.url, { signal: controller.signal });
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Evolution chain could not be loaded.");
        }

        return response.json() as Promise<PokeApiEvolutionChain>;
      })
      .then((chain) => {
        if (!controller.signal.aborted) {
          setEvolutionInfo(getEvolutionInfo(chain, detailPokemon.id));
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setEvolutionInfo(null);
        setCanHatchFromEgg(false);
      });

    return () => controller.abort();
  }, [detailPokemon]);

  function clearRollTimers() {
    rollRunRef.current += 1;

    if (rollIntervalRef.current !== null) {
      window.clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }

    rollTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    rollTimeoutsRef.current = [];
  }

  function clearRolledTeam() {
    clearRollTimers();
    setTeamIds([]);
    setRollingSlots([]);
    setIsRolling(false);
    setIsRevealing(false);
    setRevealedCount(0);
    setShinyCards((current) => {
      return Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("team-")));
    });
  }

  function warmShinySprite(entry: PokemonEntry) {
    void preloadPokemonSprite(entry);
  }

  function toggleShinyCard(cardKey: string, entry: PokemonEntry) {
    if (shinyCards[cardKey]) {
      setShinyCards((current) => ({ ...current, [cardKey]: false }));
      return;
    }

    void preloadPokemonSprite(entry).then(() => {
      setShinyCards((current) => ({ ...current, [cardKey]: true }));
    });
  }

  function warmTeamShinySprites() {
    team.forEach((entry) => {
      if (entry) {
        warmShinySprite(entry);
      }
    });
  }

  function toggleTeamShinyCards() {
    const entries = team.filter((entry): entry is PokemonEntry => entry !== undefined);
    const allShiny = entries.length > 0 && entries.every((_, index) => shinyCards[`team-${index}`]);

    if (allShiny) {
      setShinyCards((current) => {
        const next = { ...current };
        entries.forEach((_, index) => {
          next[`team-${index}`] = false;
        });
        return next;
      });
      return;
    }

    void Promise.all(entries.map((entry) => preloadPokemonSprite(entry))).then(() => {
      setShinyCards((current) => {
        const next = { ...current };
        entries.forEach((_, index) => {
          next[`team-${index}`] = true;
        });
        return next;
      });
    });
  }

  function warmPoolShinySprites() {
    searchedPool.forEach((entry) => warmShinySprite(entry));
  }

  function togglePoolShinyCards() {
    const allShiny = searchedPool.length > 0 && searchedPool.every((entry) => shinyCards[`pool-${entry.id}`]);

    if (allShiny) {
      setShinyCards((current) => {
        const next = { ...current };
        searchedPool.forEach((entry) => {
          next[`pool-${entry.id}`] = false;
        });
        return next;
      });
      return;
    }

    void Promise.all(searchedPool.map((entry) => preloadPokemonSprite(entry))).then(() => {
      setShinyCards((current) => {
        const next = { ...current };
        searchedPool.forEach((entry) => {
          next[`pool-${entry.id}`] = true;
        });
        return next;
      });
    });
  }

  function openPokemonDetail(entry: PokemonEntry) {
    setDetailPokemon(entry);
  }

  function openPokemonDetailById(pokemonId: number) {
    const entry = pokemon.find((pokemonEntry) => pokemonEntry.id === pokemonId);

    if (entry) {
      openPokemonDetail(entry);
    }
  }

  function openTagExplorer(tag: TagExplorer) {
    setTagExplorer(tag);
    setTagExplorerSearch("");
  }

  function handleCardKeyDown(event: KeyboardEvent, entry: PokemonEntry) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPokemonDetail(entry);
    }
  }

  function updateFilter<Key extends keyof TeamFilters>(key: Key, value: TeamFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateDuplicatePokemon(checked: boolean) {
    setFilters((current) => ({
      ...current,
      allowDuplicatePokemon: checked,
      allowDuplicateTypes: checked ? true : current.allowDuplicateTypes,
    }));
  }

  function updateDuplicateTypes(checked: boolean) {
    setFilters((current) => ({
      ...current,
      allowDuplicateTypes: current.allowDuplicatePokemon ? true : checked,
    }));
  }

  function toggleBannedType(type: string) {
    setFilters((current) => {
      const hasType = current.bannedTypes.includes(type);
      return {
        ...current,
        bannedTypes: hasType
          ? current.bannedTypes.filter((entry) => entry !== type)
          : [...current.bannedTypes, type],
      };
    });
  }

  function selectGame(gameId: string) {
    updateFilter("gameId", gameId);
    clearRolledTeam();
    setError(null);
    setGameSearch("");
    setIsGameOpen(false);
  }

  function selectTeamSize(teamSize: number) {
    updateFilter("teamSize", teamSize);
    clearRolledTeam();
    setError(null);
    setIsTeamSizeOpen(false);
  }

  function handleRoll() {
    clearRollTimers();
    const rollRun = rollRunRef.current;

    const result = rollTeam(filters, pokemon);
    const pool = applyFilters(filters, pokemon);

    if (!result.ok) {
      setError(result.message);
      setTeamIds([]);
      setRollingSlots([]);
      setIsRolling(false);
      setIsRevealing(false);
      setRevealedCount(0);
      return;
    }

    setIsRolling(true);
    setIsRevealing(false);
    setRevealedCount(0);
    setError(null);
    setTeamIds([]);
    setRollingSlots([]);

    const animationPool = getAnimationPool(pool);

    void preloadPokemonSprites(animationPool).then(() => {
      if (rollRun !== rollRunRef.current) {
        return;
      }

      setRollingSlots(getRandomSlots(animationPool, filters.teamSize));

      rollIntervalRef.current = window.setInterval(() => {
        setRollingSlots(getRandomSlots(animationPool, filters.teamSize));
      }, 95);

      const rollTimeout = window.setTimeout(() => {
        setIsRolling(false);
        setIsRevealing(true);
        setTeamIds(result.team.map((entry) => entry.id));
        result.team.forEach((_, index) => {
          const revealTimeout = window.setTimeout(() => setRevealedCount(index + 1), index * 180);
          rollTimeoutsRef.current.push(revealTimeout);
        });
        const completeTimeout = window.setTimeout(() => {
          if (rollIntervalRef.current !== null) {
            window.clearInterval(rollIntervalRef.current);
            rollIntervalRef.current = null;
          }

          setIsRevealing(false);
        }, result.team.length * 180 + 760);
        rollTimeoutsRef.current.push(completeTimeout);
      }, 1700);
      rollTimeoutsRef.current.push(rollTimeout);
    });
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setError(null);
    clearRolledTeam();
  }

  return (
    <main className="appRoot" data-theme={theme}>
      <button
        className="themeToggle"
        type="button"
        onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
      </button>

      <section className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true" />
          <span>ROUTE ZERO</span>
        </div>
      </header>

      <section className="heroGrid">
        <section className="controlPanel" aria-labelledby="setup-title">
          <div className="intro">
            <div className="pokeballGlow" aria-hidden="true" />
            <h1 id="setup-title">Ready for your adventure?</h1>
            <p>Create a random team for your next story run.</p>
            <button className="primaryButton" type="button" onClick={handleRoll} disabled={isRolling || !filters.gameId}>
              <Dice5 size={26} className={isRolling ? "spinIcon" : undefined} />
              {isRolling ? "Rolling..." : "Roll team"}
            </button>
          </div>

          <div className="settingsPanel">
            <div className="panelHeader">
              <span>Current Settings</span>
              <Settings size={21} />
            </div>

            <button className="settingRow settingButton" type="button" onClick={() => setIsGameOpen(true)}>
              <Gamepad2 className="settingIcon" size={22} />
              <span className="settingLabel">Game</span>
              <span className="settingValue">{selectedGame?.name ?? "Select a game"}</span>
            </button>

            <button className="settingRow settingButton compact" type="button" onClick={() => setIsTeamSizeOpen(true)}>
              <Users className="settingIcon" size={22} />
              <span className="settingLabel">Team size</span>
              <span className="settingValue strongValue">{filters.teamSize}</span>
            </button>

            <ToggleRow
              icon={<ShieldCheck size={22} />}
              label="Fully evolved Pokemon only"
              description="Only final evolutions are allowed in the team pool."
              checked={filters.fullyEvolvedOnly}
              onChange={(checked) => updateFilter("fullyEvolvedOnly", checked)}
            />
            <ToggleRow
              icon={<Sparkles size={22} />}
              label="Allow event-Pokemon"
              description="Event-only Pokemon can appear when this is enabled."
              checked={filters.allowEventPokemon}
              onChange={(checked) => updateFilter("allowEventPokemon", checked)}
            />
            <ToggleRow
              icon={<RotateCcw size={22} />}
              label="Allow trade-Pokemon"
              description="Trade evolutions and Pokemon not natively available in this game can appear when this is enabled."
              checked={filters.allowTradePokemon}
              onChange={(checked) => updateFilter("allowTradePokemon", checked)}
            />
            <ToggleRow
              icon={<Mountain size={22} />}
              label="Allow roaming-Pokemon"
              description="Roaming Pokemon can appear when this is enabled."
              checked={filters.allowRoamingPokemon}
              onChange={(checked) => updateFilter("allowRoamingPokemon", checked)}
            />
            <ToggleRow
              icon={<Crown size={22} />}
              label="Allow special-Pokemon"
              description="Legendary, mythical, and similar special Pokemon can appear when this is enabled."
              checked={filters.allowLegendaryPokemon}
              onChange={(checked) => updateFilter("allowLegendaryPokemon", checked)}
            />
            <ToggleRow
              icon={<Dna size={22} />}
              label="Allow paradox-Pokemon"
              description="Ancient and future Paradox Pokemon can appear when this is enabled."
              checked={filters.allowParadoxPokemon}
              onChange={(checked) => updateFilter("allowParadoxPokemon", checked)}
            />
            <ToggleRow
              icon={<Repeat2 size={22} />}
              label="Duplicate Pokemon"
              description="The same Pokemon can appear more than once in the same team."
              checked={filters.allowDuplicatePokemon}
              onChange={updateDuplicatePokemon}
            />
            <ToggleRow
              icon={<Tags size={22} />}
              label="Duplicate Pokemon types"
              description="Multiple team members can share one or more Pokemon types."
              checked={filters.allowDuplicateTypes}
              onChange={updateDuplicateTypes}
            />

            <div className="typeBlock">
              <div className="typeBlockHeader">
                <span>
                  <Ban size={18} />
                  Banned types
                </span>
                <strong>{filters.bannedTypes.length}</strong>
              </div>
              <div className="typeGrid">
                {pokemonTypes.map((type) => (
                  <button
                    className="typeChip"
                    data-type={type}
                    data-active={filters.bannedTypes.includes(type)}
                    key={type}
                    type="button"
                    onClick={() => toggleBannedType(type)}
                  >
                    {typeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="settingsFooter">
              <span>
                {filters.gameId && selectedGame
                  ? `${availableCount} Pokemon in the pool for ${selectedGame.shortName}`
                  : "Select a game to see the Pokemon pool"}
              </span>
              <div className="settingsFooterActions">
                <button className="settingsActionButton" type="button" onClick={() => setIsPoolOpen(true)} disabled={!filters.gameId}>
                  <Eye size={18} />
                  View pool
                </button>
                <button className="settingsActionButton" type="button" onClick={resetFilters}>
                  <RotateCcw size={18} />
                  Reset settings
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="teamPanel" aria-live="polite">
          <div className="teamHeader">
            <p>{selectedGame?.name ?? "No game selected"}</p>
            <h2>Your rolled team</h2>
            <span>Good luck on your adventure!</span>
          </div>

          {error ? <div className="message error">{error}</div> : null}

          {team.length > 0 ? (
            <div className="teamTools">
              <button
                className="teamShinyButton"
                type="button"
                data-active={team.every((_, index) => shinyCards[`team-${index}`])}
                onClick={toggleTeamShinyCards}
                onFocus={warmTeamShinySprites}
                onPointerEnter={warmTeamShinySprites}
                disabled={isRolling || team.length === 0}
                aria-label="Toggle shiny artwork for the full team"
                title="Toggle full team shiny"
              >
                <Sparkles size={22} />
              </button>
            </div>
          ) : null}

          {isRolling || (rollingSlots.length > 0 && team.length > 0) ? (
            <div className="teamGrid rollingGrid" aria-label="Rolling Pokemon silhouettes">
              {rollingSlots.map((entry, index) => {
                const revealedEntry = team[index];
                const isSlotRevealed = revealedEntry !== undefined && index < revealedCount;
                const detailEntry = isSlotRevealed ? revealedEntry : undefined;
                const cardKey = `team-${index}`;
                const isShiny = Boolean(shinyCards[cardKey]);

                return (
                  <article
                    className={`pokemonCard rollingCard ${isSlotRevealed ? "revealedCard revealSequenceCard" : ""}`}
                    data-shiny={isSlotRevealed ? isShiny : undefined}
                    key={index}
                    role={detailEntry ? "button" : undefined}
                    tabIndex={detailEntry ? 0 : undefined}
                    onClick={detailEntry ? () => openPokemonDetail(detailEntry) : undefined}
                    onKeyDown={detailEntry ? (event) => handleCardKeyDown(event, detailEntry) : undefined}
                    style={{ ["--delay" as string]: `${index * 120}ms` }}
                  >
                    <span className="dexNumber">
                      {isSlotRevealed ? String(revealedEntry.id).padStart(3, "0") : "???"}
                    </span>
                    {isSlotRevealed ? <SpecialBadges entry={revealedEntry} /> : null}
                    {isSlotRevealed ? (
                      <ShinyToggle
                        active={isShiny}
                        onClick={() => toggleShinyCard(cardKey, revealedEntry)}
                        onWarmup={() => warmShinySprite(revealedEntry)}
                      />
                    ) : null}
                    <img
                      src={isSlotRevealed ? getPokemonSprite(revealedEntry, isShiny) : entry.sprite}
                      alt=""
                      className={`pokemonSprite ${isSlotRevealed ? "" : "silhouetteSprite"} ${isShiny ? "shinySprite" : ""}`}
                      data-shiny={isSlotRevealed ? isShiny : undefined}
                      key={isSlotRevealed ? `${revealedEntry.id}-${isShiny ? "shiny" : "normal"}` : "rolling-silhouette"}
                      onError={(event) => {
                        if (isShiny && isSlotRevealed) {
                          event.currentTarget.src = revealedEntry.sprite;
                        }
                      }}
                    />
                    <h3>{isSlotRevealed ? revealedEntry.name : "Rolling"}</h3>
                    {isSlotRevealed ? (
                      <div className="typeList">
                        {revealedEntry.types.map((type) => (
                          <span className="typeBadge" data-type={type} key={type}>
                            {typeLabels[type]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="slotBars" aria-hidden="true">
                        <span />
                        <span />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : null}

          {team.length === 0 && !error && !isRolling ? (
            <div className="message empty">
              <div className="miniBall" aria-hidden="true" />
              <strong>No team rolled yet</strong>
              <span>Choose your filters and start your run.</span>
            </div>
          ) : null}

          {team.length > 0 && !isRolling && !isRevealing && rollingSlots.length === 0 ? (
            <div className="teamGrid" style={{ ["--card-count" as string]: team.length }}>
              {team.map((entry, index) =>
                entry ? (
                  (() => {
                    const cardKey = `team-${index}`;
                    const isShiny = Boolean(shinyCards[cardKey]);

                    return (
                  <article
                    className={`pokemonCard ${isRevealing ? "revealedCard" : ""}`}
                    data-shiny={isShiny}
                    key={`${entry.id}-${index}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPokemonDetail(entry)}
                    onKeyDown={(event) => handleCardKeyDown(event, entry)}
                    style={{ ["--delay" as string]: `${index * 55}ms` }}
                  >
                    <span className="dexNumber">{String(entry.id).padStart(3, "0")}</span>
                    <SpecialBadges entry={entry} />
                    <ShinyToggle
                      active={isShiny}
                      onClick={() => toggleShinyCard(cardKey, entry)}
                      onWarmup={() => warmShinySprite(entry)}
                    />
                    <img
                      src={getPokemonSprite(entry, isShiny)}
                      alt=""
                      className={`pokemonSprite ${isShiny ? "shinySprite" : ""}`}
                      data-shiny={isShiny}
                      key={`${entry.id}-${isShiny ? "shiny" : "normal"}`}
                      onError={(event) => {
                        if (isShiny) {
                          event.currentTarget.src = entry.sprite;
                        }
                      }}
                    />
                    <h3>{entry.name}</h3>
                    <div className="typeList">
                      {entry.types.map((type) => (
                        <span className="typeBadge" data-type={type} key={type}>
                          {typeLabels[type]}
                        </span>
                      ))}
                    </div>
                  </article>
                    );
                  })()
                ) : null,
              )}
            </div>
          ) : null}

          {team.length > 0 ? (
            <div className="actionBar">
              <button
                className="primaryButton slim"
                type="button"
                onClick={() => navigator.clipboard?.writeText(team.map((entry) => entry?.name).join(", "))}
                disabled={isRolling}
              >
                <Copy size={21} />
                Copy team
              </button>
            </div>
          ) : null}
        </section>
      </section>

      {isPoolOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="pool-title">
          <section className="poolModal">
            <div className="poolModalHeader">
              <div>
                <p>{selectedGame?.name ?? "No game selected"}</p>
                <h2 id="pool-title">Pokemon pool</h2>
                <span>{searchedPool.length} of {currentPool.length} Pokemon shown</span>
              </div>
              <div className="poolHeaderActions">
                <button
                  className="teamShinyButton poolShinyButton"
                  type="button"
                  data-active={searchedPool.length > 0 && searchedPool.every((entry) => shinyCards[`pool-${entry.id}`])}
                  onClick={togglePoolShinyCards}
                  onFocus={warmPoolShinySprites}
                  onPointerEnter={warmPoolShinySprites}
                  disabled={searchedPool.length === 0}
                  aria-label="Toggle shiny artwork for the visible Pokemon pool"
                  title="Toggle visible pool shiny"
                >
                  <Sparkles size={20} />
                </button>
                <button className="modalCloseButton" type="button" onClick={() => setIsPoolOpen(false)} aria-label="Close pool">
                  <X size={24} />
                </button>
              </div>
            </div>

            <label className="poolSearch">
              <Search size={19} />
              <input
                type="search"
                value={poolSearch}
                onChange={(event) => setPoolSearch(event.target.value)}
                placeholder="Search Pokemon or dex number"
              />
            </label>

            <div className="poolGrid" aria-label="Filtered Pokemon pool">
              {searchedPool.map((entry) => (
                (() => {
                  const cardKey = `pool-${entry.id}`;
                  const isShiny = Boolean(shinyCards[cardKey]);

                  return (
                    <article
                      className="poolCard"
                      data-shiny={isShiny}
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openPokemonDetail(entry)}
                      onKeyDown={(event) => handleCardKeyDown(event, entry)}
                    >
                      <span className="poolDex">{String(entry.id).padStart(3, "0")}</span>
                      <SpecialBadges entry={entry} compact />
                      <ShinyToggle
                        active={isShiny}
                        onClick={() => toggleShinyCard(cardKey, entry)}
                        onWarmup={() => warmShinySprite(entry)}
                      />
                      <img
                        src={getPokemonSprite(entry, isShiny)}
                        alt=""
                        className={isShiny ? "shinySprite" : undefined}
                        data-shiny={isShiny}
                        key={`${entry.id}-${isShiny ? "shiny" : "normal"}`}
                        onError={(event) => {
                          if (isShiny) {
                            event.currentTarget.src = entry.sprite;
                          }
                        }}
                      />
                      <h3>{entry.name}</h3>
                      <div className="typeList">
                        {entry.types.map((type) => (
                          <span className="typeBadge compactBadge" data-type={type} key={type}>
                            {typeLabels[type]}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })()
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {detailPokemon ? (
        <div className="modalOverlay detailOverlay" role="dialog" aria-modal="true" aria-labelledby="pokemon-detail-title">
          <section className="poolModal pokemonDetailModal">
            <div className="poolModalHeader">
              <div>
                <p>{selectedGame?.name ?? "Pokemon details"}</p>
                <h2 id="pokemon-detail-title">{detailPokemon.name}</h2>
                <span>#{String(detailPokemon.id).padStart(3, "0")}</span>
              </div>
              <button className="modalCloseButton" type="button" onClick={() => setDetailPokemon(null)} aria-label="Close Pokemon details">
                <X size={24} />
              </button>
            </div>

            <div className="pokemonDetailBody">
              <section className="detailHero" aria-label={`${detailPokemon.name} overview`}>
                <div className="detailArtwork">
                  <img src={detailPokemon.sprite} alt="" />
                </div>
                <div className="detailSummary">
                  <span className="detailDex">#{String(detailPokemon.id).padStart(3, "0")}</span>
                  <h3>{detailPokemon.name}</h3>
                  <div className="typeList detailTypes">
                    {detailPokemon.types.map((type) => (
                      <button
                        className="typeBadge detailTagButton"
                        data-type={type}
                        key={type}
                        type="button"
                        onClick={() => openTagExplorer({ kind: "type", value: type, label: typeLabels[type] })}
                      >
                        {typeLabels[type]}
                      </button>
                    ))}
                  </div>
                  <div className="detailPills">
                    {getAvailabilityNotes(detailPokemon, filters.gameId).map((note) => (
                      <button
                        className="detailPillButton"
                        key={note}
                        type="button"
                        onClick={() => openTagExplorer({ kind: "tag", value: note, label: note })}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="detailSection" aria-labelledby="encounter-title">
                <div className="detailSectionHeader">
                  <span id="encounter-title">
                    <MapPin size={19} />
                    Gathering
                  </span>
                  <small>{selectedGame?.shortName ?? "No game"}</small>
                </div>

                {!filters.gameId ? (
                  <div className="detailNotice">Select a game first to load route and level data.</div>
                ) : isDetailLoading ? (
                  <div className="detailNotice">Loading encounters...</div>
                ) : detailError && detailEncounterRows.length === 0 ? (
                  <div className="detailNotice">{detailError}</div>
                ) : detailEncounterRows.length > 0 ? (
                  <div className="encounterList">
                    {detailError ? <div className="detailNotice compactNotice">{detailError} Showing fallback info.</div> : null}
                    {encounterRows.length === 0 ? (
                      <div className="detailNotice compactNotice">
                        No route-level wild encounter was found in PokeAPI for this game. Showing best available fallback info.
                      </div>
                    ) : null}
                    {detailEncounterRows.map((row) => {
                      const methodLink = row.methodLink;

                      return (
                        <article className="encounterRow" key={`${row.location}-${row.levels}-${row.methods}`}>
                          <div>
                            <strong>{row.location}</strong>
                            <span>
                              {row.methods}
                              {methodLink ? (
                                <>
                                  {" "}
                                  <button
                                    className="inlinePokemonLink"
                                    type="button"
                                    onClick={() => openPokemonDetailById(methodLink.id)}
                                  >
                                    {methodLink.name}
                                  </button>
                                  {row.methodSuffix ? ` ${row.methodSuffix}` : null}
                                </>
                              ) : null}
                            </span>
                          </div>
                          <div>
                            <span>lvl {row.levels}</span>
                            <small>{row.chance === null ? (row.source === "Wild" ? "varies" : row.source) : `${row.chance}%`}</small>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="detailNotice">
                    No route and level encounters found for this game. It may be a gift, evolution, trade, event, transfer,
                    or unavailable as a native encounter.
                  </div>
                )}
              </section>

              {evolutionInfo && (evolutionInfo.from || evolutionInfo.to.length > 0) ? (
                (() => {
                  const evolvesFrom = evolutionInfo.from;

                  return (
                    <section className="detailSection compactDetailSection" aria-label="Evolution path">
                      <div className="detailSectionHeader">
                        <span>Evolution path</span>
                      </div>
                      <div className="evolutionList">
                        {evolvesFrom ? (
                          <div className="evolutionRow">
                            <span>Evolves from</span>
                            <div>
                              <button type="button" onClick={() => openPokemonDetailById(evolvesFrom.id)}>
                                {evolvesFrom.name}
                              </button>
                              {evolvesFrom.method ? <small>({evolvesFrom.method})</small> : null}
                            </div>
                          </div>
                        ) : null}
                        {evolutionInfo.to.map((target) => (
                          <div className="evolutionRow" key={target.id}>
                            <span>Evolves into</span>
                            <div>
                              <button type="button" onClick={() => openPokemonDetailById(target.id)}>
                                {target.name}
                              </button>
                              {target.method ? <small>({target.method})</small> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()
              ) : null}

              <section className="detailSection compactDetailSection" aria-label="Pokemon pool notes">
                <div className="detailFact">
                  <Info size={18} />
                  <span>
                    This view uses your selected game for locations and levels, while the pool status follows the active
                    Route Zero filters.
                  </span>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {tagExplorer ? (
        <div className="modalOverlay tagExplorerOverlay" role="dialog" aria-modal="true" aria-labelledby="tag-explorer-title">
          <section className="poolModal">
            <div className="poolModalHeader">
              <div>
                <p>{selectedGame?.name ?? "Current filters"}</p>
                <h2 id="tag-explorer-title">{tagExplorer.label}</h2>
                <span>{searchedTagExplorerPool.length} of {tagExplorerPool.length} matching Pokemon shown</span>
              </div>
              <button className="modalCloseButton" type="button" onClick={() => setTagExplorer(null)} aria-label="Close tag explorer">
                <X size={24} />
              </button>
            </div>

            <label className="poolSearch">
              <Search size={19} />
              <input
                type="search"
                value={tagExplorerSearch}
                onChange={(event) => setTagExplorerSearch(event.target.value)}
                placeholder="Search Pokemon or dex number"
              />
            </label>

            <div className="poolGrid" aria-label={`${tagExplorer.label} Pokemon`}>
              {searchedTagExplorerPool.map((entry) => (
                (() => {
                  const cardKey = `tag-${tagExplorer.kind}-${tagExplorer.value}-${entry.id}`;
                  const isShiny = Boolean(shinyCards[cardKey]);

                  return (
                    <article
                      className="poolCard"
                      data-shiny={isShiny}
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setTagExplorer(null);
                        openPokemonDetail(entry);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setTagExplorer(null);
                          openPokemonDetail(entry);
                        }
                      }}
                    >
                      <span className="poolDex">{String(entry.id).padStart(3, "0")}</span>
                      <SpecialBadges entry={entry} compact />
                      <ShinyToggle
                        active={isShiny}
                        onClick={() => toggleShinyCard(cardKey, entry)}
                        onWarmup={() => warmShinySprite(entry)}
                      />
                      <img
                        src={getPokemonSprite(entry, isShiny)}
                        alt=""
                        className={isShiny ? "shinySprite" : undefined}
                        data-shiny={isShiny}
                        key={`${entry.id}-${isShiny ? "shiny" : "normal"}`}
                        onError={(event) => {
                          if (isShiny) {
                            event.currentTarget.src = entry.sprite;
                          }
                        }}
                      />
                      <h3>{entry.name}</h3>
                      <div className="typeList">
                        {entry.types.map((type) => (
                          <span className="typeBadge compactBadge" data-type={type} key={type}>
                            {typeLabels[type]}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })()
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isGameOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="game-title">
          <section className="poolModal pickerModal">
            <div className="poolModalHeader">
              <div>
                <p>Route Zero</p>
                <h2 id="game-title">Choose game</h2>
                <span>{searchedGames.length} games shown</span>
              </div>
              <button className="modalCloseButton" type="button" onClick={() => setIsGameOpen(false)} aria-label="Close game picker">
                <X size={24} />
              </button>
            </div>

            <label className="poolSearch">
              <Search size={19} />
              <input
                type="search"
                value={gameSearch}
                onChange={(event) => setGameSearch(event.target.value)}
                placeholder="Search game"
              />
            </label>

            <div className="gameGrid" aria-label="Pokemon games">
              {searchedGames.map((game, index) => (
                <button
                  className="gameCard"
                  data-active={game.id === filters.gameId}
                  key={game.id}
                  type="button"
                  onClick={() => selectGame(game.id)}
                  style={{ ["--cover-hue" as string]: `${(index * 37) % 360}deg` }}
                >
                  <span className="gameCover" aria-hidden="true">
                    {game.coverImage ? (
                      <img
                        src={game.coverImage}
                        alt=""
                        loading="lazy"
                        onError={(event) => event.currentTarget.remove()}
                      />
                    ) : null}
                    <span className="gameCoverFallback">
                      <span>PKMN</span>
                      <strong>{game.shortName}</strong>
                    </span>
                  </span>
                  <span className="gameName">{game.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isTeamSizeOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="team-size-title">
          <section className="poolModal sizeModal">
            <div className="poolModalHeader">
              <div>
                <p>Team setup</p>
                <h2 id="team-size-title">Choose team size</h2>
                <span>Pick a team size from 1 to 6.</span>
              </div>
              <button className="modalCloseButton" type="button" onClick={() => setIsTeamSizeOpen(false)} aria-label="Close team size picker">
                <X size={24} />
              </button>
            </div>

            <div className="sizeGrid" aria-label="Team size options">
              {[1, 2, 3, 4, 5, 6].map((size) => (
                <button
                  className="sizeCard"
                  data-active={size === filters.teamSize}
                  key={size}
                  type="button"
                  onClick={() => selectTeamSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
      </section>
    </main>
  );
}

function getRandomSlots(pool: PokemonEntry[], size: number) {
  return Array.from({ length: size }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function getAnimationPool(pool: PokemonEntry[]) {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(pool.length, 30));
}

function getPokemonSprite(entry: PokemonEntry, shiny: boolean) {
  if (!shiny) {
    return entry.sprite;
  }

  return entry.sprite.replace("/official-artwork/", "/official-artwork/shiny/");
}

const spritePreloadCache = new Map<string, Promise<void>>();

function preloadSprite(sprite: string) {
  const cached = spritePreloadCache.get(sprite);

  if (cached) {
    return cached;
  }

  const preload = new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = sprite;
  });

  spritePreloadCache.set(sprite, preload);
  return preload;
}

function preloadPokemonSprite(entry: PokemonEntry) {
  return preloadSprite(getPokemonSprite(entry, true));
}

function preloadPokemonSprites(entries: PokemonEntry[]) {
  return Promise.all(entries.map((entry) => preloadSprite(entry.sprite)));
}

type ShinyToggleProps = {
  active: boolean;
  onClick: () => void;
  onWarmup: () => void;
};

function ShinyToggle({ active, onClick, onWarmup }: ShinyToggleProps) {
  return (
    <button
      className="shinyToggle"
      type="button"
      data-active={active}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick();
      }}
      onFocus={onWarmup}
      onPointerEnter={onWarmup}
      aria-label={active ? "Show normal Pokemon artwork" : "Show shiny Pokemon artwork"}
      title={active ? "Show normal" : "Show shiny"}
    >
      <Sparkles size={17} />
    </button>
  );
}

type SpecialBadgesProps = {
  entry: PokemonEntry;
  compact?: boolean;
};

function SpecialBadges({ entry, compact = false }: SpecialBadgesProps) {
  const badges = getSpecialPokemonLabels(entry.id);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="specialBadges" data-compact={compact}>
      {badges.map((badge) => (
        <span data-badge={getBadgeKey(badge)} key={badge}>{badge}</span>
      ))}
    </div>
  );
}

function getBadgeKey(badge: string) {
  return badge.toLowerCase().replace(/\s+/g, "-");
}

type ToggleRowProps = {
  icon: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleRow({ icon, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <button
      className="toggleRow"
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="settingIcon" aria-hidden="true">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="switchControl" data-checked={checked} aria-hidden="true" />
    </button>
  );
}

type EncounterRow = {
  location: string;
  levels: string;
  methods: string;
  chance: number | null;
  source: string;
  methodLink?: EvolutionPokemon;
  methodSuffix?: string;
};

type TagExplorer = {
  kind: "tag" | "type";
  value: string;
  label: string;
};

type PokeApiEncounter = {
  location_area: {
    name: string;
  };
  version_details: {
    version: {
      name: string;
    };
    max_chance: number;
    encounter_details: {
      min_level: number;
      max_level: number;
      method: {
        name: string;
      };
    }[];
  }[];
};

type EvolutionPokemon = {
  id: number;
  name: string;
  method?: string;
};

type EvolutionInfo = {
  from: EvolutionPokemon | null;
  to: EvolutionPokemon[];
};

type PokeApiSpecies = {
  evolution_chain: {
    url: string;
  };
  egg_groups: {
    name: string;
  }[];
};

type PokeApiEvolutionChain = {
  chain: PokeApiEvolutionNode;
};

type PokeApiEvolutionNode = {
  species: {
    name: string;
    url: string;
  };
  evolution_details: PokeApiEvolutionDetail[];
  evolves_to: PokeApiEvolutionNode[];
};

type PokeApiEvolutionDetail = {
  trigger?: {
    name: string;
  };
  item?: {
    name: string;
  } | null;
  held_item?: {
    name: string;
  } | null;
  known_move_type?: {
    name: string;
  } | null;
  location?: {
    name: string;
  } | null;
  min_happiness?: number | null;
  min_level?: number | null;
  time_of_day?: string;
};

const pokeApiVersionMap: Record<string, string> = {
  "fire-red": "firered",
  "leaf-green": "leafgreen",
  "heart-gold": "heartgold",
  "soul-silver": "soulsilver",
  "black-2": "black-2",
  "white-2": "white-2",
  "omega-ruby": "omega-ruby",
  "alpha-sapphire": "alpha-sapphire",
  "ultra-sun": "ultra-sun",
  "ultra-moon": "ultra-moon",
  "lets-go-pikachu": "lets-go-pikachu",
  "lets-go-eevee": "lets-go-eevee",
  "brilliant-diamond": "brilliant-diamond",
  "shining-pearl": "shining-pearl",
  "legends-arceus": "legends-arceus",
  "legends-za": "legends-za",
};

const starterFallbacks: Record<string, Record<number, { location: string; levels: string; methods: string }>> = {
  red: {
    1: { location: "Professor Oak's Lab", levels: "5", methods: "Starter choice in Pallet Town." },
    4: { location: "Professor Oak's Lab", levels: "5", methods: "Starter choice in Pallet Town." },
    7: { location: "Professor Oak's Lab", levels: "5", methods: "Starter choice in Pallet Town." },
  },
  blue: {
    1: { location: "Professor Oak's Lab", levels: "5", methods: "Starter choice in Pallet Town." },
    4: { location: "Professor Oak's Lab", levels: "5", methods: "Starter choice in Pallet Town." },
    7: { location: "Professor Oak's Lab", levels: "5", methods: "Starter choice in Pallet Town." },
  },
  yellow: {
    25: { location: "Professor Oak's Lab", levels: "5", methods: "Starter Pokemon in Pallet Town." },
    1: { location: "Cerulean City", levels: "10", methods: "Gift Pokemon after meeting friendship/story requirements." },
    4: { location: "Route 24", levels: "10", methods: "Gift Pokemon from a trainer on Route 24." },
    7: { location: "Vermilion City", levels: "10", methods: "Gift Pokemon from Officer Jenny." },
  },
  gold: createStarterSet([152, 155, 158], "Professor Elm's Lab", "5", "Starter choice in New Bark Town."),
  silver: createStarterSet([152, 155, 158], "Professor Elm's Lab", "5", "Starter choice in New Bark Town."),
  crystal: createStarterSet([152, 155, 158], "Professor Elm's Lab", "5", "Starter choice in New Bark Town."),
  ruby: createStarterSet([252, 255, 258], "Route 101", "5", "Starter choice after helping Professor Birch."),
  sapphire: createStarterSet([252, 255, 258], "Route 101", "5", "Starter choice after helping Professor Birch."),
  emerald: createStarterSet([252, 255, 258], "Route 101", "5", "Starter choice after helping Professor Birch."),
  "fire-red": createStarterSet([1, 4, 7], "Professor Oak's Lab", "5", "Starter choice in Pallet Town."),
  "leaf-green": createStarterSet([1, 4, 7], "Professor Oak's Lab", "5", "Starter choice in Pallet Town."),
  diamond: createStarterSet([387, 390, 393], "Lake Verity", "5", "Starter choice during the Lake Verity event."),
  pearl: createStarterSet([387, 390, 393], "Lake Verity", "5", "Starter choice during the Lake Verity event."),
  platinum: createStarterSet([387, 390, 393], "Route 201", "5", "Starter choice from Professor Rowan."),
  "heart-gold": {
    ...createStarterSet([152, 155, 158], "Professor Elm's Lab", "5", "Starter choice in New Bark Town."),
    ...createStarterSet([1, 4, 7], "Professor Oak's Lab", "5", "Kanto starter gift after the late-game requirement."),
  },
  "soul-silver": {
    ...createStarterSet([152, 155, 158], "Professor Elm's Lab", "5", "Starter choice in New Bark Town."),
    ...createStarterSet([1, 4, 7], "Professor Oak's Lab", "5", "Kanto starter gift after the late-game requirement."),
  },
  black: createStarterSet([495, 498, 501], "Nuvema Town", "5", "Starter gift from Professor Juniper."),
  white: createStarterSet([495, 498, 501], "Nuvema Town", "5", "Starter gift from Professor Juniper."),
  "black-2": createStarterSet([495, 498, 501], "Aspertia City", "5", "Starter gift from Bianca."),
  "white-2": createStarterSet([495, 498, 501], "Aspertia City", "5", "Starter gift from Bianca."),
  x: {
    ...createStarterSet([650, 653, 656], "Aquacorde Town", "5", "Starter choice from your friends."),
    ...createStarterSet([1, 4, 7], "Lumiose City", "10", "Kanto starter gift from Professor Sycamore."),
  },
  y: {
    ...createStarterSet([650, 653, 656], "Aquacorde Town", "5", "Starter choice from your friends."),
    ...createStarterSet([1, 4, 7], "Lumiose City", "10", "Kanto starter gift from Professor Sycamore."),
  },
  "omega-ruby": createStarterSet([252, 255, 258], "Route 101", "5", "Starter choice after helping Professor Birch."),
  "alpha-sapphire": createStarterSet([252, 255, 258], "Route 101", "5", "Starter choice after helping Professor Birch."),
  sun: createStarterSet([722, 725, 728], "Iki Town", "5", "Starter choice in Melemele Island's opening story."),
  moon: createStarterSet([722, 725, 728], "Iki Town", "5", "Starter choice in Melemele Island's opening story."),
  "ultra-sun": createStarterSet([722, 725, 728], "Route 1", "5", "Starter choice during the opening story."),
  "ultra-moon": createStarterSet([722, 725, 728], "Route 1", "5", "Starter choice during the opening story."),
  "lets-go-pikachu": {
    25: { location: "Professor Oak's Lab", levels: "5", methods: "Partner Pokemon in Pallet Town." },
    1: { location: "Cerulean City", levels: "12", methods: "Gift Pokemon after catching enough Pokemon." },
    4: { location: "Route 24", levels: "14", methods: "Gift Pokemon from a trainer north of Cerulean City." },
    7: { location: "Vermilion City", levels: "16", methods: "Gift Pokemon from Officer Jenny." },
  },
  "lets-go-eevee": {
    133: { location: "Professor Oak's Lab", levels: "5", methods: "Partner Pokemon in Pallet Town." },
    1: { location: "Cerulean City", levels: "12", methods: "Gift Pokemon after catching enough Pokemon." },
    4: { location: "Route 24", levels: "14", methods: "Gift Pokemon from a trainer north of Cerulean City." },
    7: { location: "Vermilion City", levels: "16", methods: "Gift Pokemon from Officer Jenny." },
  },
  sword: createStarterSet([810, 813, 816], "Postwick", "5", "Starter gift from Leon."),
  shield: createStarterSet([810, 813, 816], "Postwick", "5", "Starter gift from Leon."),
  "brilliant-diamond": createStarterSet([387, 390, 393], "Lake Verity", "5", "Starter choice during the Lake Verity event."),
  "shining-pearl": createStarterSet([387, 390, 393], "Lake Verity", "5", "Starter choice during the Lake Verity event."),
  "legends-arceus": {
    722: { location: "Galaxy Team Headquarters", levels: "5", methods: "Starter gift from Professor Laventon." },
    155: { location: "Galaxy Team Headquarters", levels: "5", methods: "Starter gift from Professor Laventon." },
    501: { location: "Galaxy Team Headquarters", levels: "5", methods: "Starter gift from Professor Laventon." },
  },
  scarlet: createStarterSet([906, 909, 912], "Cabo Poco", "5", "Starter gift from Director Clavell."),
  violet: createStarterSet([906, 909, 912], "Cabo Poco", "5", "Starter gift from Director Clavell."),
};

const fossilPokemonIds = new Set([138, 140, 142, 345, 347, 408, 410, 564, 566, 696, 698, 880, 881, 882, 883]);

const supplementalEncounterFallbacks: Record<string, Record<number, Omit<EncounterRow, "chance">[]>> = {
  scarlet: {
    361: [
      {
        location: "Dalizapa Passage, Glaseado Mountain",
        levels: "15-39",
        methods: "Catch in the snowy cave and mountain encounter areas.",
        source: "Wild",
      },
    ],
  },
  violet: {
    361: [
      {
        location: "Dalizapa Passage, Glaseado Mountain",
        levels: "15-39",
        methods: "Catch in the snowy cave and mountain encounter areas.",
        source: "Wild",
      },
    ],
  },
};

const staticPokemonIds = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 638, 639, 640, 641, 642, 643,
  644, 645, 646, 647, 648, 649, 716, 717, 718, 719, 720, 721, 772, 773, 785, 786, 787, 788, 789, 790, 791,
  792, 800, 801, 802, 807, 808, 809, 888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 905, 1001, 1002,
  1003, 1004, 1007, 1008, 1009, 1010, 1014, 1015, 1016, 1017, 1024,
]);

function createStarterSet(ids: number[], location: string, levels: string, methods: string) {
  return Object.fromEntries(ids.map((id) => [id, { location, levels, methods }]));
}

function getPokeApiVersionId(gameId: string) {
  return pokeApiVersionMap[gameId] ?? gameId;
}

function getStarterFallback(pokemonId: number, gameId: string) {
  const fallback = starterFallbacks[gameId]?.[pokemonId];

  if (!fallback) {
    return null;
  }

  return createFallbackRow({
    ...fallback,
    source: fallback.methods.includes("Starter") || fallback.methods.includes("Partner") ? "Starter" : "Gift",
  });
}

function getFossilFallback(pokemonId: number, gameId: string) {
  if (!fossilPokemonIds.has(pokemonId)) {
    return null;
  }

  const restorationLocation = getFossilRestorationLocation(gameId);

  return createFallbackRow({
    location: restorationLocation,
    levels: "varies",
    methods: "Revive from a fossil item. Fossil availability depends on version and side content.",
    source: "Fossil",
  });
}

function getFossilRestorationLocation(gameId: string) {
  const locations: Record<string, string> = {
    red: "Cinnabar Lab",
    blue: "Cinnabar Lab",
    yellow: "Cinnabar Lab",
    "fire-red": "Cinnabar Lab",
    "leaf-green": "Cinnabar Lab",
    ruby: "Devon Corporation",
    sapphire: "Devon Corporation",
    emerald: "Devon Corporation",
    diamond: "Oreburgh Mining Museum",
    pearl: "Oreburgh Mining Museum",
    platinum: "Oreburgh Mining Museum",
    "heart-gold": "Pewter Museum of Science",
    "soul-silver": "Pewter Museum of Science",
    black: "Nacrene Museum",
    white: "Nacrene Museum",
    "black-2": "Nacrene Museum",
    "white-2": "Nacrene Museum",
    x: "Ambrette Town Fossil Lab",
    y: "Ambrette Town Fossil Lab",
    "omega-ruby": "Devon Corporation",
    "alpha-sapphire": "Devon Corporation",
    sun: "Route 8 Fossil Restoration Center",
    moon: "Route 8 Fossil Restoration Center",
    "ultra-sun": "Route 8 Fossil Restoration Center",
    "ultra-moon": "Route 8 Fossil Restoration Center",
    sword: "Fossil restoration on Route 6",
    shield: "Fossil restoration on Route 6",
  };

  return locations[gameId] ?? "Fossil restoration";
}

function getEncounterRows(encounters: PokeApiEncounter[], versionId: string): EncounterRow[] {
  const rows: EncounterRow[] = [];

  encounters.forEach((encounter) => {
    const versionDetail = encounter.version_details.find((detail) => detail.version.name === versionId);

    if (!versionDetail) {
      return;
    }

    const levels = getLevelText(versionDetail.encounter_details);
    const methods = [...new Set(versionDetail.encounter_details.map((detail) => describePokeApiMethod(detail.method.name)))];

    rows.push({
      location: formatEncounterLocation(encounter.location_area.name.replace(/-area$/, "")),
      levels,
      methods: methods.length > 0 ? methods.join(" ") : "Special encounter in this area.",
      chance: versionDetail.max_chance,
      source: "Wild",
    });
  });

  return summarizePokeApiEncounterRows(rows).sort((first, second) => first.location.localeCompare(second.location));
}

function getFallbackEncounterRows(
  entry: PokemonEntry,
  gameId: string,
  evolutionInfo: EvolutionInfo | null,
  canHatchFromEgg: boolean,
): EncounterRow[] {
  const starterRow = getStarterFallback(entry.id, gameId);

  if (starterRow) {
    return [starterRow];
  }

  const fossilRow = getFossilFallback(entry.id, gameId);

  if (fossilRow && entry.nativeGames.includes(gameId)) {
    return [fossilRow];
  }

  if (entry.eventOnly) {
    return [
      createFallbackRow({
        location: "Event distribution",
        levels: "varies",
        methods: "Event-only Pokemon. Usually not found as a normal in-game route encounter.",
        source: "Event",
      }),
    ];
  }

  if (entry.tradeOnly) {
    return [
      createFallbackRow({
        location: "Trade",
        levels: "varies",
        methods: "Obtain through a trade requirement for this game.",
        source: "Trade",
      }),
    ];
  }

  if (!entry.nativeGames.includes(gameId) && entry.games.includes(gameId)) {
    return [
      createFallbackRow({
        location: "Transfer",
        levels: "varies",
        methods: "Not native to this game. Bring it in through transfer compatibility.",
        source: "Transfer",
      }),
    ];
  }

  if (!entry.games.includes(gameId)) {
    return [
      createFallbackRow({
        location: "Unavailable in this game",
        levels: "-",
        methods: "This Pokemon is outside the selected game's available pool.",
        source: "Unavailable",
      }),
    ];
  }

  if (entry.roaming) {
    return [
      createFallbackRow({
        location: "Roaming encounter",
        levels: "varies",
        methods: "Roams across routes after the story trigger for this game.",
        source: "Roaming",
      }),
    ];
  }

  if (staticPokemonIds.has(entry.id)) {
    return [
      createFallbackRow({
        location: "Static encounter",
        levels: "varies",
        methods: "One-time overworld encounter for this game.",
        source: "Static",
      }),
    ];
  }

  if (evolutionInfo?.from) {
    return [
      createFallbackRow({
        location: "Evolution",
        levels: "varies",
        methods: "Evolve from",
        methodLink: evolutionInfo.from,
        methodSuffix: evolutionInfo.from.method ? `(${evolutionInfo.from.method})` : undefined,
        source: "Evolution",
      }),
    ];
  }

  const supplementalRows = supplementalEncounterFallbacks[gameId]?.[entry.id];

  if (supplementalRows) {
    return supplementalRows.map(createFallbackRow);
  }

  if (canShowEggRow(entry, gameId, evolutionInfo, canHatchFromEgg)) {
    return [
      getEggEncounterRow(),
    ];
  }

  if (entry.nativeGames.includes(gameId)) {
    return [
      createFallbackRow({
        location: "Wild encounter",
        levels: "varies",
        methods: "Native wild encounter. Detailed route data is not available yet.",
        source: "Wild",
      }),
    ];
  }

  return [
    createFallbackRow({
      location: entry.fullyEvolved ? "Evolution" : "Special encounter",
      levels: "varies",
      methods: entry.fullyEvolved
        ? "Usually obtained by evolving an earlier Pokemon in the same evolutionary line."
        : "Detailed source data is not available for this game.",
      source: entry.fullyEvolved ? "Evolution" : "Special",
    }),
  ];
}

function getSpecialEncounterRows(
  entry: PokemonEntry,
  gameId: string,
  evolutionInfo: EvolutionInfo | null,
  canHatchFromEgg: boolean,
) {
  if (!entry.games.includes(gameId)) {
    return [];
  }

  const rows: EncounterRow[] = [];
  const starterRow = getStarterFallback(entry.id, gameId);
  const fossilRow = getFossilFallback(entry.id, gameId);
  const supplementalRows = supplementalEncounterFallbacks[gameId]?.[entry.id];

  if (starterRow) {
    rows.push(starterRow);
  }

  if (fossilRow && entry.nativeGames.includes(gameId)) {
    rows.push(fossilRow);
  }

  if (entry.eventOnly) {
    rows.push(
      createFallbackRow({
        location: "Event distribution",
        levels: "varies",
        methods: "Event-only Pokemon. Usually not found as a normal in-game route encounter.",
        source: "Event",
      }),
    );
  }

  if (entry.tradeOnly) {
    rows.push(
      createFallbackRow({
        location: "Trade",
        levels: "varies",
        methods: "Obtain through a trade requirement for this game.",
        source: "Trade",
      }),
    );
  }

  if (entry.roaming) {
    rows.push(
      createFallbackRow({
        location: "Roaming encounter",
        levels: "varies",
        methods: "Roams across routes after the story trigger for this game.",
        source: "Roaming",
      }),
    );
  }

  if (staticPokemonIds.has(entry.id)) {
    rows.push(
      createFallbackRow({
        location: "Static encounter",
        levels: "varies",
        methods: "One-time overworld encounter for this game.",
        source: "Static",
      }),
    );
  }

  if (evolutionInfo?.from) {
    rows.push(
      createFallbackRow({
        location: "Evolution",
        levels: "varies",
        methods: "Evolve from",
        methodLink: evolutionInfo.from,
        methodSuffix: evolutionInfo.from.method ? `(${evolutionInfo.from.method})` : undefined,
        source: "Evolution",
      }),
    );
  }

  if (supplementalRows) {
    rows.push(...supplementalRows.map(createFallbackRow));
  }

  if (canShowEggRow(entry, gameId, evolutionInfo, canHatchFromEgg)) {
    rows.push(getEggEncounterRow());
  }

  return rows;
}

function mergeEncounterRows(rows: EncounterRow[]) {
  return rows.filter(
    (row, index, all) =>
      all.findIndex(
        (item) =>
          item.location === row.location &&
          item.levels === row.levels &&
          item.methods === row.methods &&
          item.source === row.source &&
          item.methodLink?.id === row.methodLink?.id,
      ) === index,
  );
}

function getEggEncounterRow() {
  return createFallbackRow({
    location: "Egg",
    levels: "varies",
    methods: "Obtain by hatching an egg from this Pokemon's evolution line.",
    source: "Egg",
  });
}

function canShowEggRow(
  entry: PokemonEntry,
  gameId: string,
  evolutionInfo: EvolutionInfo | null,
  canHatchFromEgg: boolean,
) {
  return (
    canHatchFromEgg &&
    entry.nativeGames.includes(gameId) &&
    isBreedingGame(gameId) &&
    !evolutionInfo?.from
  );
}

function canPokemonSpeciesHatchFromEgg(species: PokeApiSpecies) {
  return species.egg_groups.some((group) => group.name !== "no-eggs" && group.name !== "ditto");
}

function isBreedingGame(gameId: string) {
  const gamesWithoutBreeding = new Set(["red", "blue", "yellow", "lets-go-pikachu", "lets-go-eevee", "legends-arceus", "legends-za"]);
  return !gamesWithoutBreeding.has(gameId);
}

function createFallbackRow(row: Omit<EncounterRow, "chance"> & { chance?: number | null }): EncounterRow {
  return {
    ...row,
    chance: row.chance ?? null,
  };
}

function getLevelText(details: PokeApiEncounter["version_details"][number]["encounter_details"]) {
  const levelRanges = details
    .filter((detail) => detail.min_level > 0 || detail.max_level > 0)
    .map((detail) => {
      if (detail.min_level === detail.max_level) {
        return String(detail.min_level);
      }

      return `${detail.min_level}-${detail.max_level}`;
    });

  const uniqueRanges = [...new Set(levelRanges)];
  return uniqueRanges.length > 0 ? uniqueRanges.join(", ") : "varies";
}

function summarizePokeApiEncounterRows(rows: EncounterRow[]) {
  const grouped = new Map<string, EncounterRow>();

  rows.forEach((row) => {
    const normalized = normalizeRepeatedEncounterLocation(row.location);
    const key = [normalized.location, row.levels, row.methods, row.chance ?? "any", row.source].join("|");
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...row,
        location: normalized.location,
        methods: normalized.note ? `${row.methods} ${normalized.note}` : row.methods,
      });
      return;
    }

    if (normalized.area && !existing.methods.includes(normalized.area)) {
      existing.methods = `${existing.methods.replace(/\.$/, "")}, ${normalized.area}.`;
    }
  });

  return [...grouped.values()];
}

function normalizeRepeatedEncounterLocation(location: string) {
  const safariMatch = location.match(/^(.*Safari Zone)\s+(.+)$/i);

  if (!safariMatch) {
    return { location, area: null, note: null };
  }

  const area = safariMatch[2];
  return {
    location: safariMatch[1],
    area,
    note: `Listed Safari Zone areas: ${area}.`,
  };
}

function formatEncounterLocation(location: string) {
  return formatLabel(location)
    .replace(/\bb(\d+)f\b/gi, (_match, floor: string) => `basement ${getOrdinal(Number(floor))} floor`)
    .replace(/\b(\d+)f\b/gi, (_match, floor: string) => `${getOrdinal(Number(floor))} floor`);
}

function getOrdinal(value: number) {
  const suffix = value % 10 === 1 && value % 100 !== 11 ? "st" : value % 10 === 2 && value % 100 !== 12 ? "nd" : value % 10 === 3 && value % 100 !== 13 ? "rd" : "th";
  return `${value}${suffix}`;
}

function describePokeApiMethod(method: string) {
  const normalized = method.toLowerCase();

  if (normalized === "walk") {
    return "Encounter while walking through the listed wild area.";
  }

  if (normalized === "surf") {
    return "Encounter while surfing on water.";
  }

  if (normalized === "old-rod") {
    return "Fish here with the Old Rod.";
  }

  if (normalized === "good-rod") {
    return "Fish here with the Good Rod.";
  }

  if (normalized === "super-rod") {
    return "Fish here with the Super Rod.";
  }

  if (normalized === "rock-smash") {
    return "Break rocks in this area.";
  }

  if (normalized === "headbutt") {
    return "Use Headbutt on trees in this area.";
  }

  if (normalized === "dark-grass") {
    return "Encounter while walking through dark grass.";
  }

  if (normalized === "grass-spots") {
    return "Encounter in shaking grass spots.";
  }

  if (normalized === "cave-spots") {
    return "Encounter in dust clouds inside caves.";
  }

  if (normalized === "bridge-spots") {
    return "Encounter in moving spots on bridges.";
  }

  if (normalized === "super-rod-spots") {
    return "Fish at rippling water spots with the Super Rod.";
  }

  if (normalized === "gift") {
    return "Receive it as a gift in this area.";
  }

  return `Use ${formatLabel(method).toLowerCase()} in this area.`;
}

function getEvolutionInfo(chain: PokeApiEvolutionChain, pokemonId: number): EvolutionInfo {
  const match = findEvolutionNode(chain.chain, pokemonId, null);

  if (!match) {
    return {
      from: null,
      to: [],
    };
  }

  return {
    from: match.parent ? nodeToEvolutionPokemon(match.parent, match.node.evolution_details[0]) : null,
    to: match.node.evolves_to.map((node) => nodeToEvolutionPokemon(node, node.evolution_details[0])),
  };
}

function findEvolutionNode(
  node: PokeApiEvolutionNode,
  pokemonId: number,
  parent: PokeApiEvolutionNode | null,
): { node: PokeApiEvolutionNode; parent: PokeApiEvolutionNode | null } | null {
  if (getSpeciesId(node.species.url) === pokemonId) {
    return { node, parent };
  }

  for (const child of node.evolves_to) {
    const match = findEvolutionNode(child, pokemonId, node);

    if (match) {
      return match;
    }
  }

  return null;
}

function nodeToEvolutionPokemon(node: PokeApiEvolutionNode, detail?: PokeApiEvolutionDetail): EvolutionPokemon {
  const id = getSpeciesId(node.species.url);
  const localEntry = pokemon.find((entry) => entry.id === id);

  return {
    id,
    name: localEntry?.name ?? formatSpeciesName(node.species.name),
    method: detail ? getEvolutionMethodText(detail) : undefined,
  };
}

function getSpeciesId(url: string) {
  const match = url.match(/\/pokemon-species\/(\d+)\//);
  return match ? Number(match[1]) : 0;
}

function getEvolutionMethodText(detail: PokeApiEvolutionDetail) {
  const parts = [];

  if (detail.min_level) {
    parts.push(`lvl ${detail.min_level}`);
  }

  if (detail.item) {
    parts.push(formatLabel(detail.item.name));
  }

  if (detail.held_item) {
    parts.push(`holding ${formatLabel(detail.held_item.name)}`);
  }

  if (detail.known_move_type) {
    parts.push(`${formatLabel(detail.known_move_type.name)} move`);
  }

  if (detail.min_happiness) {
    parts.push(`friendship ${detail.min_happiness}+`);
  }

  if (detail.location) {
    parts.push(formatLabel(detail.location.name));
  }

  if (detail.time_of_day) {
    parts.push(detail.time_of_day);
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return detail.trigger?.name ? formatLabel(detail.trigger.name) : "special method";
}

function formatSpeciesName(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLabel(value: string) {
  return value
    .split("-")
    .filter((part) => part !== "area")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAvailabilityNotes(entry: PokemonEntry, gameId: string) {
  const notes = [];

  if (gameId && entry.nativeGames.includes(gameId)) {
    notes.push("Native");
  } else if (gameId && entry.games.includes(gameId)) {
    notes.push("Trade or transfer");
  } else if (gameId) {
    notes.push("Outside native pool");
  } else {
    notes.push("No game selected");
  }

  if (entry.fullyEvolved) {
    notes.push("Fully evolved");
  }

  if (entry.tradeOnly) {
    notes.push("trade-only");
  }

  if (entry.eventOnly) {
    notes.push("event-only");
  }

  if (entry.roaming) {
    notes.push("roaming");
  }

  notes.push(...getSpecialPokemonLabels(entry.id));

  return notes;
}
