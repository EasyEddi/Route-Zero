"use client";

import { useMemo, useState } from "react";
import { games } from "@/data/games";
import { pokemon } from "@/data/pokemon";
import { pokemonTypes } from "@/data/types";
import { rollTeam } from "@/lib/team-generator";
import type { TeamFilters } from "@/lib/types";

const defaultFilters: TeamFilters = {
  gameId: "fire-red",
  allowedTypes: [],
  ignoreNotFullyEvolved: true,
  ignoreEventOnly: true,
  ignoreTradeOnly: true,
  ignoreRoaming: true,
};

const typeLabels: Record<string, string> = {
  bug: "Kaefer",
  dark: "Unlicht",
  dragon: "Drache",
  electric: "Elektro",
  fairy: "Fee",
  fighting: "Kampf",
  fire: "Feuer",
  flying: "Flug",
  ghost: "Geist",
  grass: "Pflanze",
  ground: "Boden",
  ice: "Eis",
  normal: "Normal",
  poison: "Gift",
  psychic: "Psycho",
  rock: "Gestein",
  steel: "Stahl",
  water: "Wasser",
};

export default function Home() {
  const [filters, setFilters] = useState<TeamFilters>(defaultFilters);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  function toggleType(type: string) {
    setFilters((current) => {
      const hasType = current.allowedTypes.includes(type);
      return {
        ...current,
        allowedTypes: hasType
          ? current.allowedTypes.filter((entry) => entry !== type)
          : [...current.allowedTypes, type],
      };
    });
  }

  function handleRoll() {
    const result = rollTeam(filters, pokemon);

    if (!result.ok) {
      setError(result.message);
      setTeamIds([]);
      return;
    }

    setError(null);
    setTeamIds(result.team.map((entry) => entry.id));
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setError(null);
    setTeamIds([]);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true" />
          <span>ROUTE ZERO</span>
        </div>
        <button className="iconButton" aria-label="Menue">
          <span />
          <span />
          <span />
        </button>
      </header>

      <section className="heroGrid">
        <section className="controlPanel" aria-labelledby="setup-title">
          <div className="intro">
            <div className="pokeballGlow" aria-hidden="true" />
            <h1 id="setup-title">Bereit fuer dein Abenteuer?</h1>
            <p>Erstelle ein zufaelliges Team fuer deinen naechsten Story Run.</p>
            <button className="primaryButton" type="button" onClick={handleRoll}>
              <span className="diceIcon" aria-hidden="true">◇</span>
              Team rollen
            </button>
          </div>

          <div className="settingsPanel">
            <div className="panelHeader">
              <span>Aktuelle Einstellungen</span>
              <span className="gear" aria-hidden="true">⚙</span>
            </div>

            <label className="settingRow">
              <span className="settingIcon" aria-hidden="true">▣</span>
              <span className="settingLabel">Spiel</span>
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
              <span className="settingIcon" aria-hidden="true">●●</span>
              <span className="settingLabel">Teamgroesse</span>
              <strong>6</strong>
            </div>

            <ToggleRow
              label="Vollentwickelte Pokemon"
              description="Nicht vollentwickelte Pokemon werden ausgeschlossen"
              checked={filters.ignoreNotFullyEvolved}
              onChange={(checked) => updateFilter("ignoreNotFullyEvolved", checked)}
            />
            <ToggleRow
              label="Event-Pokemon"
              description="Pokemon, die nur ueber Events erhaeltlich sind, sind ausgeschlossen"
              checked={filters.ignoreEventOnly}
              onChange={(checked) => updateFilter("ignoreEventOnly", checked)}
            />
            <ToggleRow
              label="Trade-Pokemon"
              description="Pokemon, die nur durch Tausch erhaeltlich sind, sind ausgeschlossen"
              checked={filters.ignoreTradeOnly}
              onChange={(checked) => updateFilter("ignoreTradeOnly", checked)}
            />
            <ToggleRow
              label="Roaming-Pokemon"
              description="Roaming Pokemon sind ausgeschlossen"
              checked={filters.ignoreRoaming}
              onChange={(checked) => updateFilter("ignoreRoaming", checked)}
            />

            <div className="typeBlock">
              <div className="typeBlockHeader">
                <span>Typfilter</span>
                <strong>{filters.allowedTypes.length}</strong>
              </div>
              <div className="typeGrid">
                {pokemonTypes.map((type) => (
                  <button
                    className="typeChip"
                    data-type={type}
                    data-active={filters.allowedTypes.includes(type)}
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                  >
                    {typeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="settingsFooter">
              <span>{availableCount} Pokemon im Pool fuer {selectedGame.shortName}</span>
              <button type="button" onClick={resetFilters}>
                Zuruecksetzen
              </button>
            </div>
          </div>
        </section>

        <section className="teamPanel" aria-live="polite">
          <div className="teamHeader">
            <p>{selectedGame.name}</p>
            <h2>Dein gerolltes Team</h2>
            <span>Viel Erfolg auf deinem Abenteuer!</span>
          </div>

          {error ? <div className="message error">{error}</div> : null}

          {team.length === 0 && !error ? (
            <div className="message empty">
              <div className="miniBall" aria-hidden="true" />
              <strong>Noch kein Team gerollt</strong>
              <span>Waehle deine Filter und starte deinen Run.</span>
            </div>
          ) : null}

          {team.length > 0 ? (
            <div className="teamGrid">
              {team.map((entry) =>
                entry ? (
                  <article className="pokemonCard" key={entry.id}>
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
            <button className="secondaryButton" type="button" onClick={handleRoll}>
              Nochmal rollen
            </button>
            <button
              className="primaryButton slim"
              type="button"
              onClick={() => navigator.clipboard?.writeText(team.map((entry) => entry?.name).join(", "))}
              disabled={team.length === 0}
            >
              Team kopieren
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="toggleRow">
      <span className="settingIcon" aria-hidden="true">⊘</span>
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
