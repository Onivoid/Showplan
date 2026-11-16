#!/usr/bin/env node
// Audience export: build a sanitized, shareable HTML map for Public / Team / Serverless / custom.
// Personal map (floorplan/index.html) is left untouched. The AI writes export-sanitize.json for
// audience-aware wording; this script applies it and the structural sanitize.
//
// usage:
//   node export.mjs <root> --audience public|team|serverless|<custom text>
//        [--language fr] [--description "..."] [--base team]
//        [--include flows,notes,recent,health] [--sanitize <file>] [--out <file>]
//        [--prepare] [--json]
// --prepare writes a worksheet JSON the agent fills as export-sanitize.json (no HTML yet).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapDir, parseArgs, printJson, readJsonFile, unattendedMode } from './lib/common.mjs';
import { listAudiences, resolveAudience } from './lib/audience.mjs';
import { sanitizeForExport, EXPORT_PARTS } from './lib/sanitize-export.mjs';
import { scriptJson, withPolicy } from '../assets/page-safety.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
unattendedMode(args);
const root = path.resolve(args._[0] || '.');
const dir = mapDir(root);
const SCHEMA = 'showplan/export-result@1';
const WORKSHEET_SCHEMA = 'showplan/export-sanitize@1';

const fail = async (msg, extra = {}) => {
  if (args.json) await printJson({ schema: SCHEMA, ok: false, errors: [msg], ...extra }, 1);
  console.error('✗ ' + msg);
  process.exit(1);
};

if (args.list) {
  const list = listAudiences();
  if (args.json) await printJson({ schema: 'showplan/audiences@1', audiences: list }, 0);
  for (const a of list) console.log(`${a.id.padEnd(12)} ${a.label}\n  ${a.description}\n`);
  process.exit(0);
}

const indexHtml = path.join(dir, 'index.html');
const graphFile = path.join(dir, 'graph.json');
if (!fs.existsSync(indexHtml) || !fs.existsSync(graphFile)) {
  await fail('No map here (floorplan/index.html + graph.json). Build a Showplan first.');
}

const audienceArg = args.audience || args.a || 'team';
const audience = resolveAudience(audienceArg, {
  description: args.description || args.desc,
  base: args.base,
});
const language = args.language || args.lang || null;
const include = args.include
  ? String(args.include).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : audience.profile.includeDefault;
const sanitizePath = args.sanitize
  ? path.resolve(root, args.sanitize)
  : path.join(dir, 'export-sanitize.json');

const graph = readJsonFile(graphFile);

if (args.prepare) {
  const worksheet = {
    $schema: WORKSHEET_SCHEMA,
    audience: audience.id,
    audienceLabel: audience.label,
    audienceDescription: audience.description,
    language: language || graph.meta?.language || null,
    instructions: [
      'Rewrite names and descriptions for this audience and language.',
      'Keep every node id, file path key and route key unchanged — only change the wording.',
      'For public: everyday words, no file paths in prose, generalize product names unless they are the story.',
      'Recent work (if present): rewrite as short patch notes for that audience; drop secrets and internal jargon.',
      'Do not invent architecture. Only reword what is already on the map.',
    ],
    project: { name: graph.project?.name || '', summary: graph.project?.summary || '' },
    nodes: Object.fromEntries((graph.nodes || []).filter((n) => n.id !== 'unassigned').map((n) => [n.id, { label: n.label, summary: n.summary || '' }])),
    files: Object.fromEntries((graph.files || []).slice(0, 400).map((f) => [f.p, { name: f.name, description: f.d || '' }])),
    routes: Object.fromEntries((graph.routes || []).slice(0, 400).map((r) => [`${r.m} ${r.p}`, { name: r.name, description: r.d || '' }])),
    flows: (graph.flows || []).map((f) => ({
      id: f.id, title: f.title, description: f.description || '',
      steps: (f.steps || []).map((s) => ({ note: s.note || '' })),
    })),
    tour: (graph.tour || []).map((t) => ({ title: t.title || '', note: t.note || '' })),
    recent: graph.recent
      ? {
          tasks: (graph.recent.tasks || []).map((t) => ({
            title: t.title, request: t.request || '', summary: t.summary || '',
            ...(t.release ? { release: t.release } : {}),
            ...(Array.isArray(t.commits) ? { commits: t.commits } : {}),
          })),
          items: (graph.recent.items || []).map((it) => ({
            id: it.id, change: it.change, note: it.note || '',
            ...(Array.isArray(it.commits) ? { commits: it.commits } : {}),
            ...(it.release ? { release: it.release } : {}),
          })),
        }
      : { tasks: [], items: [] },
  };
  fs.mkdirSync(path.dirname(sanitizePath), { recursive: true });
  // prepare writes the template the agent will edit; keep the name export-sanitize.json by default
  const outPrepare = args.out ? path.resolve(root, args.out) : sanitizePath;
  fs.writeFileSync(outPrepare, JSON.stringify(worksheet, null, 2) + '\n');
  if (args.json) {
    await printJson({
      schema: SCHEMA, ok: true, prepare: true, audience, language, worksheet: outPrepare,
      next: `Edit ${path.relative(root, outPrepare) || outPrepare}, then run export.mjs without --prepare`,
    }, 0);
  }
  console.log(`Wrote export worksheet to ${outPrepare}`);
  console.log(`Audience: ${audience.label} (${audience.id})`);
  console.log(`Language: ${language || graph.meta?.language || '(map default / detect from user)'}`);
  console.log('Fill in rewritten names/descriptions for the audience, then re-run without --prepare.');
  process.exit(0);
}

let overlay = null;
if (fs.existsSync(sanitizePath)) {
  try { overlay = readJsonFile(sanitizePath); }
  catch (e) { await fail(`Could not read ${sanitizePath}: ${e.message}`); }
} else if (audience.id === 'public' && !args['allow-empty-sanitize']) {
  console.log(`! No ${path.relative(root, sanitizePath) || 'export-sanitize.json'} yet.`);
  console.log('  For a strong Public export, run with --prepare, let the agent fill it, then export again.');
  console.log('  Continuing with structural sanitize only (TECH_PLAIN fallbacks).');
}

const { graph: outGraph, include: on, audience: resolved } = sanitizeForExport(graph, {
  audience: audienceArg,
  audienceDescription: args.description || args.desc,
  base: args.base,
  language,
  include,
  overlay,
});

// Inject into the built index.html the same way serve.mjs --export does
const html = fs.readFileSync(indexHtml, 'utf8');
const DATA_START = '<script>window.FLOORPLAN = ';
const a = html.indexOf(DATA_START), b = html.indexOf(';</script>', a);
if (a < 0 || b < 0) await fail('This map HTML is too old to export. Rebuild with build.mjs first.');
const json = scriptJson(outGraph);
const exportedHtml = withPolicy(html.slice(0, a + DATA_START.length) + json + html.slice(b), 'export');
const slug = String(outGraph.project?.name || 'showplan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'showplan';
const langPart = language ? `-${String(language).toLowerCase()}` : '';
const audPart = resolved.id === 'custom' ? '-custom' : `-${resolved.id}`;
const defaultName = `${slug}${audPart}${langPart}-map.html`;
const outFile = path.resolve(args.out && !String(args.out).startsWith('--') ? path.resolve(root, args.out) : path.join(dir, defaultName));
fs.writeFileSync(outFile, exportedHtml);

const result = {
  schema: SCHEMA,
  ok: true,
  file: outFile,
  audience: resolved,
  language: language || outGraph.meta?.language || null,
  include: on,
  overlay: overlay ? sanitizePath : null,
  parts: EXPORT_PARTS,
};
if (args.json) await printJson(result, 0);
console.log(`Exported audience map to ${outFile}`);
console.log(`Audience: ${resolved.label} — ${resolved.description.slice(0, 120)}${resolved.description.length > 120 ? '…' : ''}`);
console.log(`Includes: ${on.join(', ') || '(map only)'}`);
console.log(`Language: ${result.language || '(unchanged)'}`);
console.log('Personal map (floorplan/index.html) was not modified.');
process.exit(0);
