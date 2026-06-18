"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Copy,
  Dice5,
  Gamepad2,
  Menu,
  Mountain,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { games } from "@/data/games";
import { pokemon } from "@/data/pokemon";
import { pokemonTypes } from "@/data/types";
import { applyFilters, rollTeam } from "@/lib/team-generator";
import type { PokemonEntry, TeamFilters } from "@/lib/types";

const defaultFilters: TeamFilters = {
  gameId: "fire-red",
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
  const [rollingSlots, setRollingSlots] = useState<PokemonEntry[]>([]);

  const selectedGame = games.find((game) => game.id === filters.gameId) ?? games[0];
  const team = useMemo(
    () => teamIds.map((id) => pokemon.find((entry) => entry.id === id)).filter(Boolean),
    [teamIds],
  );

  const availableCount = useMemo(() => {
    return rollTeam(filters, pokemon, { dryRun: true }).availableCount;
  }, [filters]);

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

  function changeTeamSize(direction: number) {
    setFilters((current) => ({
      ...current,
      teamSize: Math.min(12, Math.max(1, current.teamSize + direction)),
    }));
  }

  function handleRoll() {
    const result = rollTeam(filters, pokemon);
    const pool = applyFilters(filters, pokemon);

    if (!result.ok) {
      setError(result.message);
      setTeamIds([]);
      setRollingSlots([]);
      setIsRolling(false);
      return;
    }

    setIsRolling(true);
    setError(null);
    setTeamIds([]);
    setRollingSlots(getRandomSlots(pool, filters.teamSize));

    const interval = window.setInterval(() => {
      setRollingSlots(getRandomSlots(pool, filters.teamSize));
    }, 95);

    window.setTimeout(() => {
      window.clearInterval(interval);
      setIsRolling(false);
      setRollingSlots([]);
      setTeamIds(result.team.map((entry) => entry.id));
    }, 1700);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setError(null);
    setTeamIds([]);
    setRollingSlots([]);
    setIsRolling(false);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true" />
          <span>ROUTE ZERO</span>
        </div>
        <button className="iconButton" aria-label="Menu">
          <Menu size={25} />
        </button>
      </header>

      <section className="heroGrid">
        <section className="controlPanel" aria-labelledby="setup-title">
          <div className="intro">
            <div className="pokeballGlow" aria-hidden="true" />
            <h1 id="setup-title">Ready for your adventure?</h1>
            <p>Create a random team plan for your next story run.</p>
            <button className="primaryButton" type="button" onClick={handleRoll} disabled={isRolling}>
              <Dice5 size={26} className={isRolling ? "spinIcon" : undefined} />
              {isRolling ? "Rolling..." : "Roll team"}
            </button>
          </div>

          <div className="settingsPanel">
            <div className="panelHeader">
              <span>Current Settings</span>
              <Settings size={21} />
            </div>

            <label className="settingRow">
              <Gamepad2 className="settingIcon" size={22} />
              <span className="settingLabel">Game</span>
              <select
                value={filters.gameId}
                onChange={(event) => updateFilter("gameId", event.target.value)}
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="settingRow compact">
              <Users className="settingIcon" size={22} />
              <span className="settingLabel">Team size</span>
              <div className="stepper" aria-label="Team size">
                <button type="button" onClick={() => changeTeamSize(-1)} aria-label="Decrease team size">
                  -
                </button>
                <strong>{filters.teamSize}</strong>
                <button type="button" onClick={() => changeTeamSize(1)} aria-label="Increase team size">
                  +
                </button>
              </div>
            </div>

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
              description="Trade-only evolutions can appear when this is enabled."
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
              <span>{availableCount} Pokemon in the pool for {selectedGame.shortName}</span>
              <button type="button" onClick={resetFilters}>
                Reset settings
              </button>
            </div>
          </div>
        </section>

        <section className="teamPanel" aria-live="polite">
          <div className="teamHeader">
            <p>{selectedGame.name}</p>
            <h2>Your rolled team</h2>
            <span>Good luck on your adventure!</span>
          </div>

          {error ? <div className="message error">{error}</div> : null}

          {isRolling ? (
            <div className="teamGrid rollingGrid" aria-label="Rolling Pokemon silhouettes">
              {rollingSlots.map((entry, index) => (
                <article
                  className="pokemonCard rollingCard"
                  key={index}
                  style={{ ["--delay" as string]: `${index * 120}ms` }}
                >
                  <span className="dexNumber">???</span>
                  <img src={entry.sprite} alt="" className="pokemonSprite silhouetteSprite" />
                  <h3>Rolling</h3>
                  <div className="slotBars" aria-hidden="true">
                    <span />
                    <span />
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {team.length === 0 && !error && !isRolling ? (
            <div className="message empty">
              <div className="miniBall" aria-hidden="true" />
              <strong>No team rolled yet</strong>
              <span>Choose your filters and start your run.</span>
            </div>
          ) : null}

          {team.length > 0 && !isRolling ? (
            <div className="teamGrid" style={{ ["--card-count" as string]: team.length }}>
              {team.map((entry, index) =>
                entry ? (
                  <article className="pokemonCard" key={entry.id} style={{ ["--delay" as string]: `${index * 55}ms` }}>
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

          <div className="actionBar">
            <button className="secondaryButton" type="button" onClick={handleRoll} disabled={isRolling}>
              <RotateCcw size={21} />
              Roll again
            </button>
            <button
              className="primaryButton slim"
              type="button"
              onClick={() => navigator.clipboard?.writeText(team.map((entry) => entry?.name).join(", "))}
              disabled={team.length === 0 || isRolling}
            >
              <Copy size={21} />
              Copy team
            </button>
          </div>
        </section>
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
    <label className="toggleRow">
      <span className="settingIcon" aria-hidden="true">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
