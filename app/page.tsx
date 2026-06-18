"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Copy,
  Dice5,
  Eye,
  Gamepad2,
  Search,
  X,
  Mountain,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Moon,
  Sun,
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
  const [poolSearch, setPoolSearch] = useState("");
  const [gameSearch, setGameSearch] = useState("");
  const [rollingSlots, setRollingSlots] = useState<PokemonEntry[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const rollIntervalRef = useRef<number | null>(null);
  const rollTimeoutsRef = useRef<number[]>([]);

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
      return entry.name.toLowerCase().includes(query) || dexNumber.includes(query);
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

  function clearRollTimers() {
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
    setRollingSlots(getRandomSlots(pool, filters.teamSize));

    rollIntervalRef.current = window.setInterval(() => {
      setRollingSlots(getRandomSlots(pool, filters.teamSize));
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
              <button type="button" onClick={() => setIsPoolOpen(true)} disabled={!filters.gameId}>
                <Eye size={17} />
                View pool
              </button>
              <button type="button" onClick={resetFilters}>
                Reset settings
              </button>
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

          {isRolling || (rollingSlots.length > 0 && team.length > 0) ? (
            <div className="teamGrid rollingGrid" aria-label="Rolling Pokemon silhouettes">
              {rollingSlots.map((entry, index) => {
                const revealedEntry = team[index];
                const isSlotRevealed = revealedEntry !== undefined && index < revealedCount;

                return (
                  <article
                    className={`pokemonCard rollingCard ${isSlotRevealed ? "revealedCard revealSequenceCard" : ""}`}
                    key={index}
                    style={{ ["--delay" as string]: `${index * 120}ms` }}
                  >
                    <span className="dexNumber">
                      {isSlotRevealed ? String(revealedEntry.id).padStart(3, "0") : "???"}
                    </span>
                    <img
                      src={isSlotRevealed ? revealedEntry.sprite : entry.sprite}
                      alt=""
                      className={`pokemonSprite ${isSlotRevealed ? "" : "silhouetteSprite"}`}
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
                  <article
                    className={`pokemonCard ${isRevealing ? "revealedCard" : ""}`}
                    key={entry.id}
                    style={{ ["--delay" as string]: `${index * 55}ms` }}
                  >
                    <span className="dexNumber">{String(entry.id).padStart(3, "0")}</span>
                    <img src={entry.sprite} alt="" className="pokemonSprite" />
                    <h3>{entry.name}</h3>
                    <div className="typeList">
                      {entry.types.map((type) => (
                        <span className="typeBadge" data-type={type} key={type}>
                          {typeLabels[type]}
                        </span>
                      ))}
                    </div>
                  </article>
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
              <button className="modalCloseButton" type="button" onClick={() => setIsPoolOpen(false)} aria-label="Close pool">
                <X size={24} />
              </button>
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
                <article className="poolCard" key={entry.id}>
                  <span className="poolDex">{String(entry.id).padStart(3, "0")}</span>
                  <img src={entry.sprite} alt="" />
                  <h3>{entry.name}</h3>
                  <div className="typeList">
                    {entry.types.map((type) => (
                      <span className="typeBadge compactBadge" data-type={type} key={type}>
                        {typeLabels[type]}
                      </span>
                    ))}
                  </div>
                </article>
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

type ToggleRowProps = {
  icon: React.ReactNode;
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
