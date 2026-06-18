export type PokemonEntry = {
  id: number;
  name: string;
  types: string[];
  sprite: string;
  games: string[];
  nativeGames: string[];
  fullyEvolved: boolean;
  eventOnly: boolean;
  tradeOnly: boolean;
  roaming: boolean;
};

export type GameEntry = {
  id: string;
  name: string;
  shortName: string;
  coverImage?: string;
};

export type TeamFilters = {
  gameId: string;
  teamSize: number;
  bannedTypes: string[];
  fullyEvolvedOnly: boolean;
  allowEventPokemon: boolean;
  allowTradePokemon: boolean;
  allowRoamingPokemon: boolean;
};
