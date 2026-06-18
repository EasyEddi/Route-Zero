"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import {
  Ban,
  Copy,
  Dice5,
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
        setEncounterRows(getEncounterRows(encounters, versionId));
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

  function handleCardKeyDown(event: KeyboardEvent, entry: PokemonEntry) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPokemonDetail(entry);
    }
  }

  function updateFilter<Key extends keyof TeamFilters>(key: Key, value: TeamFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
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
              icon={<Repeat2 size={22} />}
              label="Duplicate Pokemon"
              description="The same Pokemon can appear more than once in the same team."
              checked={filters.allowDuplicatePokemon}
              onChange={(checked) => updateFilter("allowDuplicatePokemon", checked)}
            />
            <ToggleRow
              icon={<Tags size={22} />}
              label="Duplicate Pokemon types"
              description="Multiple team members can share one or more Pokemon types."
              checked={filters.allowDuplicateTypes}
              onChange={(checked) => updateFilter("allowDuplicateTypes", checked)}
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
                <span>#{String(detailPokemon.id).padStart(3, "0")} detailed route info</span>
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
                      <span className="typeBadge" data-type={type} key={type}>
                        {typeLabels[type]}
                      </span>
                    ))}
                  </div>
                  <div className="detailPills">
                    {getAvailabilityNotes(detailPokemon, filters.gameId).map((note) => (
                      <span key={note}>{note}</span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="detailSection" aria-labelledby="encounter-title">
                <div className="detailSectionHeader">
                  <span id="encounter-title">
                    <MapPin size={19} />
                    Encounter data
                  </span>
                  <small>{selectedGame?.shortName ?? "No game"}</small>
                </div>

                {!filters.gameId ? (
                  <div className="detailNotice">Select a game first to load route and level data.</div>
                ) : isDetailLoading ? (
                  <div className="detailNotice">Loading encounters...</div>
                ) : detailError ? (
                  <div className="detailNotice">{detailError}</div>
                ) : encounterRows.length > 0 ? (
                  <div className="encounterList">
                    {encounterRows.map((row) => (
                      <article className="encounterRow" key={`${row.location}-${row.levels}-${row.methods}`}>
                        <div>
                          <strong>{row.location}</strong>
                          <span>{row.methods}</span>
                        </div>
                        <div>
                          <span>Lv. {row.levels}</span>
                          <small>{row.chance}%</small>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="detailNotice">
                    No route and level encounters found for this game. It may be a gift, evolution, trade, event, transfer,
                    or unavailable as a native encounter.
                  </div>
                )}
              </section>

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
  chance: number;
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

function getPokeApiVersionId(gameId: string) {
  return pokeApiVersionMap[gameId] ?? gameId;
}

function getEncounterRows(encounters: PokeApiEncounter[], versionId: string): EncounterRow[] {
  return encounters
    .map((encounter) => {
      const versionDetail = encounter.version_details.find((detail) => detail.version.name === versionId);

      if (!versionDetail) {
        return null;
      }

      const levels = getLevelText(versionDetail.encounter_details);
      const methods = [
        ...new Set(versionDetail.encounter_details.map((detail) => formatLabel(detail.method.name))),
      ];

      return {
        location: formatLabel(encounter.location_area.name.replace(/-area$/, "")),
        levels,
        methods: methods.length > 0 ? methods.join(", ") : "Special encounter",
        chance: versionDetail.max_chance,
      };
    })
    .filter((row): row is EncounterRow => row !== null)
    .sort((first, second) => first.location.localeCompare(second.location));
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
  return uniqueRanges.length > 0 ? uniqueRanges.join(", ") : "unknown";
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
    notes.push("Native in this game");
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
    notes.push("Trade flag");
  }

  if (entry.eventOnly) {
    notes.push("Event flag");
  }

  if (entry.roaming) {
    notes.push("Roaming flag");
  }

  return notes;
}
