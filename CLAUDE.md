# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev server at http://localhost:3000 (training hub at /training)
npm run build    # Production build (rm -rf .next first if the build cache misbehaves)
npm run lint     # ESLint (eslint-config-next core-web-vitals + typescript)
```

There is no test framework.

## What this app is

A memory-athlete training app ("anti-gravity" / WordVault) built on Next.js App Router (Next 16, React 19, TypeScript strict). It hosts ~25 standalone memory drills (digits, cards, names, memory palaces, etc.) plus an analytics dashboard. Styling is inline `style={{}}` objects and CSS variables defined in `src/app/globals.css` — there is no Tailwind, despite Tailwind-looking strings like `'from-blue-600 to-indigo-600'` in the games array (those are consumed as data).

## Architecture

**Each game is a self-contained client page.** Every drill lives at `src/app/training/<game>/page.tsx` (older ones at `src/app/digits`, `src/app/words`), marked `"use client"`, holding all of its state, game logic, word lists, and UI in one file — some run to ~3000 lines (e.g. `image-vault`). There is almost no shared game logic; shared pieces are limited to `src/components/` (Header, FullscreenWrapper, RealMap) and the data layer.

**`src/lib/firebase.ts` is the entire persistence layer.** All Firestore access (game results, card/palace attempt stats, training sessions, favorites, Image Vault data, landmarks) goes through this one file. Two patterns it enforces:
- **Firebase is optional.** Every function checks `firebaseConfig.apiKey` and degrades gracefully (returns `[]`/`null`/`false`, logs a warning). Games must remain fully playable with no `.env.local`.
- **Queries avoid composite indexes.** Reads fetch a whole collection (single `orderBy` or single `where`), then sort/filter in memory (time filters via `getCalendarCutoff`). Keep new queries in this style rather than adding Firestore indexes.

There is no authentication — everything is keyed to the hardcoded `USER_ID = 'default_user'`.

**`src/data/` holds the static mnemonic systems** (major system 00–99, card PAO, digit PAO, image/face/name banks, Dhaka landmarks, quotes). The training hub (`src/app/training/page.tsx`) bootstraps the PAO/major-system data into Firestore on load if the user's `image_vault` doc is empty; users can then edit their copies via the Image Vault game. The legacy words feature (`useWords` hook) uses localStorage only, not Firebase.

**Adding a new game** (per QUICK_START.md):
1. Create `src/app/training/<game-name>/page.tsx`
2. Add an entry to the `games` array in `src/app/training/page.tsx`
3. Add the game's type string to the `GameResult` union in `src/lib/firebase.ts`, and call `saveGameResult` when a round ends
4. Update the filters in `src/app/analytics/page.tsx`

## Environment

Firebase config comes from `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local` (see QUICK_START.md). `src/app/training/page.tsx` duplicates the Firebase init from `src/lib/firebase.ts` — prefer importing from the lib in new code.

## Repo notes

- The root-level uppercase `.md` files (TRAINING_IMPLEMENTATION.md, IMAGE_VAULT_*.md, etc.) are historical feature/design notes, not current instructions; QUICK_START.md is the most useful overview.
- `public/faces/` (50 local face photos) and `public/images/sequence/` (500 images, indexed by `src/data/imageBank.ts`) are game assets; `scripts/download-images.js` fetched them.
- `RealMap.tsx` loads Leaflet from a CDN via `next/script` for the map-based drills (urban-locus-tracer).
