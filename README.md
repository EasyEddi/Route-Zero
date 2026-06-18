# Route Zero

Route Zero is a Pokemon story-run team generator. Pick a game, tune the filters, roll a team, and inspect the exact Pokemon pool used by the generator.

Live app: https://route-zero-ten.vercel.app

## Features

- Chronological Pokemon game selector
- Random team rolling with animated silhouette reveal
- Adjustable team size from 1 to 6
- Filters for:
  - fully evolved Pokemon only
  - event Pokemon
  - trade-only and non-native Pokemon
  - roaming Pokemon
  - banned types
- Searchable pool preview with sprites, dex numbers, names, and type badges
- Copy rolled team names to clipboard

## Tech Stack

- Next.js
- React
- TypeScript
- Vercel
- Local generated Pokemon data based on PokeAPI

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Data

Pokemon data is stored locally in `data/pokemon.ts`.

The generator script is:

```bash
node scripts/generate-pokemon-data.mjs
```

The app uses generated base data plus curated rules for availability filters. Some game-specific story-run availability still needs manual review over time.
