# MyArah

Malaysia-first navigation project. The previous prototype has been intentionally archived so the new application can be designed and implemented cleanly.

## Status

**Redesign foundation only.** The current `main` branch has no active map, routing, search, traffic, location tracking or navigation logic. The page is a temporary, accessible holding screen, **not** the finished product.

## Current files

```text
MyArah/
├── .gitignore
├── README.md
├── index.html
└── src/
    └── styles/
        ├── tokens.css       # Shared color, typography and spacing tokens
        ├── base.css         # Base styles, accessibility and resets
        └── shell.css        # Temporary holding-screen layout
```

The app is a static site that can be edited from an iPhone through GitHub. There is no build requirement yet; the root `index.html` can be served directly via GitHub Pages.

## Planned code organization

Create folders as features are implemented rather than committing empty placeholders:

- `src/components/` — small reusable UI components.
- `src/features/map/` — map initialization, camera, layers, and markers.
- `src/features/search/` — destination search and result UI.
- `src/features/navigation/` — routes, guidance, ETA, rerouting.
- `src/features/traffic/` — traffic data adapters and overlay.
- `src/services/` — provider clients and network boundaries.
- `src/utils/` — focused shared utilities.
- `src/styles/` — shared design tokens and global styles.
- `public/` — static assets when required.

Prefer small ES modules and feature-owned files. Keep provider credentials out of the browser repository. Implement real geographic data integrations separately from UI prototypes; never label mock data as live.

## Restore the old prototype

The full pre-redesign code is preserved in branch [`archive/pre-revamp-2026-11-07`](../../tree/archive/pre-revamp-2026-11-07), from commit `82862a90c3137e226922a39688791c4dc9e56c76`. The commit history also remains available on `main`.

The old `cloudflare-worker/worker.js` source was removed from the new `main` tree along with the rest of the old code. Removing a source file **does not** automatically stop an independently deployed Cloudflare Worker or delete its secrets/configuration; those must be managed separately if needed.

## Next step

Define the new design system, navigation architecture, map provider and initial UI before adding production functionality.
