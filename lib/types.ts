export type PokemonEntry = {
  id: number;
  name: string;
  types: string[];
  sprite: string;
  games: string[];
  fullyEvolved: boolean;
  eventOnly: boolean;
  tradeOnly: boolean;
  roaming: boolean;
};

export type GameEntry = {
  id: string;
  name: string;
  shortName: string;
};

export type TeamFilters = {
  gameId: string;
  allowedTypes: string[];
  ignoreNotFullyEvolved: boolean;
  ignoreEventOnly: boolean;
  ignoreTradeOnly: boolean;
  ignoreRoaming: boolean;
};
