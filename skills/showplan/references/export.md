# Audience exports

Showplan can export a **sanitized, shareable** HTML map for a given audience, without changing the personal `floorplan/index.html`.

## Audiences

| Id | Who | Sanitize |
|---|---|---|
| `public` | Outside the company | Most aggressive: no paths, symbols, route URLs, packages/hosts, health |
| `team` | Teammates | Medium: hide symbols/exports; health off by default |
| `serverless` | Local / trusted | Almost the full map (classic share) |
| custom | Free-text description | Base profile `team` (or `--base`) + the description for the AI rewrite |

List presets: `node <skill>/scripts/export.mjs --list`

## Flow (agent)

1. **Clarify the goal** if needed: who will open the file, what they must understand, what must stay hidden, which language.
2. **Prepare** a worksheet:
   ```
   node <skill>/scripts/export.mjs <root> --audience public --language fr --prepare
   ```
   Writes `floorplan/export-sanitize.json` (schema `showplan/export-sanitize@1`) with current labels for you to rewrite.
3. **Rewrite** every name/description/tour/flow/recent note for that audience and language. Keep keys (node ids, file paths, `METHOD /path`) unchanged.
4. **Export**:
   ```
   node <skill>/scripts/export.mjs <root> --audience public --language fr
   ```
   Writes `floorplan/<project>-public-fr-map.html` (static, no Ask bar).

Multiple languages: repeat with `--language` (and a fresh `--prepare` / sanitize file per language, or pass `--sanitize <file>` / `--out <file>`).

Custom audience:
```
node <skill>/scripts/export.mjs <root> --audience "Non-technical board members" --description "…" --language fr --prepare
```

## Recent work on exports

Include Recent work with `--include …,recent` (default for public/team). Rewrite tasks as **patch notes** for the audience in `export-sanitize.json` → `recent`.

Recent work follows the **same sanitize aggressiveness** as the rest of the map:

| Audience | Recent work |
|---|---|
| Personal map | Full timeline: commits, grouped history, **uncommitted** WIP labeled |
| `public` | No uncommitted stops; no commit SHAs unless `architecture.json` has `"openSource": true` |
| `team` | Timeline kept; SHAs stripped unless open-source |
| `serverless` | Same as personal |

- **Recent mode** (default): local / conversation work via `recent.mjs` (mark working-tree stops with `"uncommitted": true`).
- **Releases mode**: `node <skill>/scripts/releases.mjs <root>` then write `recent-work.json` with `"mode": "releases"`, `"release": "v1.2.0"`, optional `"commits": ["abc…"]`.
- **Commits mode**: only with the user's permission when there are no releases; group coherent commits into one stop when possible.

## Classic export (unchanged)

```
node floorplan/serve.mjs --export [--include flows,notes,recent,health]
```

Still available from the map’s **Export** button (Serverless / Local). Personal workflow is unchanged.
