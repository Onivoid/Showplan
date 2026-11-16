// Audience sanitize + export.mjs: Public strips paths/symbols; personal map stays untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { shopApp, run, writeJson, readJson, cleanup, SKILL, lib } from './helpers.mjs';

const dataOf = (html) => JSON.parse(/<script>window\.FLOORPLAN = (.*?);<\/script>/s.exec(html)[1]);

test('resolveAudience presets and custom descriptions', async () => {
  const { resolveAudience, listAudiences } = await lib('audience.mjs');
  assert.equal(listAudiences().length, 3);
  assert.equal(resolveAudience('public').profile.hidePaths, true);
  assert.equal(resolveAudience('team').profile.hideSymbols, true);
  assert.equal(resolveAudience('serverless').profile.allowHealth, true);
  const custom = resolveAudience('Board members who hate jargon', { base: 'public' });
  assert.equal(custom.id, 'custom');
  assert.equal(custom.profile.hidePaths, true);
  assert.match(custom.description, /Board members/);
});

test('structural public sanitize hides paths and packages; overlay rewrites labels', async () => {
  const { sanitizeForExport } = await lib('sanitize-export.mjs');
  const graph = {
    meta: { root: '/tmp/x', repos: [{ path: '.', name: 'x', remote: 'https://x' }], language: 'en' },
    project: { name: 'Shop', summary: 'Uses Postgres and Stripe.' },
    nodes: [{ id: 'api', label: 'API', kind: 'service', summary: 'Talks to Postgres.', packages: ['pg'], hosts: ['api.stripe.com'], paths: ['api/**'] }],
    files: [{ p: 'api/server.js', n: 'api', name: 'Server', d: 'Express entry', s: [['boot', 'fn', 1, 0, '']], note: 'secret note' }],
    routes: [{ f: 'api/server.js', m: 'POST', p: '/api/orders', name: 'Create order', d: 'Creates an order', h: 'create' }],
    flows: [{ id: 'buy', title: 'Buy', description: '', steps: [{ ref: 'n:api', note: 'Hits Postgres' }] }],
    tour: [{ ref: 'n:api', title: 'API', note: 'Postgres' }],
    recent: { tasks: [{ title: 'Orders', request: '', summary: 'Added Stripe checkout' }], items: [{ id: 'f:api/server.js', task: 0, change: 'changed', note: 'Stripe webhook' }] },
    health: { issues: [{ id: 'x', title: 'open' }], summary: { high: 1, medium: 0, low: 0 } },
  };
  const { graph: out } = sanitizeForExport(graph, {
    audience: 'public',
    language: 'fr',
    overlay: {
      project: { summary: 'Boutique en ligne avec paiements.' },
      nodes: { api: { label: 'Serveur principal', summary: 'Traite les commandes.' } },
      recent: { tasks: [{ title: 'Commandes', summary: 'Paiements en ligne' }], items: [{ id: 'f:api/server.js', task: 0, change: 'changed', note: 'Nouveau paiement' }] },
    },
  });
  assert.equal(out.project.summary, 'Boutique en ligne avec paiements.');
  assert.equal(out.nodes[0].label, 'Serveur principal');
  assert.deepEqual(out.nodes[0].packages, []);
  assert.equal(out.nodes[0].paths.length, 0);
  assert.equal(out.files[0].p, 'part:api');
  assert.equal(out.files[0].s, undefined);
  assert.equal(out.files[0].note, undefined);
  assert.equal(out.routes[0].p, '/…');
  assert.equal(out.health, undefined);
  assert.equal(out.meta.root, null);
  assert.equal(out.meta.exported.audience, 'public');
  assert.equal(out.meta.language, 'fr');
  assert.equal(out.recent.tasks[0].title, 'Commandes');
});

test('export.mjs writes audience HTML without modifying the personal map', () => {
  const root = shopApp();
  try {
    run('scan.mjs', root);
    run('build.mjs', root, '--no-claude-md');
    const before = fs.readFileSync(path.join(root, 'floorplan', 'index.html'), 'utf8');
    const exportJs = path.join(SKILL, 'scripts', 'export.mjs');
    const out = execFileSync(process.execPath, [exportJs, root, '--audience', 'public', '--language', 'en', '--allow-empty-sanitize'], { encoding: 'utf8' });
    assert.match(out, /Exported audience map/);
    const after = fs.readFileSync(path.join(root, 'floorplan', 'index.html'), 'utf8');
    assert.equal(after, before, 'personal index.html must stay unchanged');
    const files = fs.readdirSync(path.join(root, 'floorplan')).filter((f) => f.endsWith('-map.html'));
    assert.ok(files.some((f) => f.includes('public')));
    const html = fs.readFileSync(path.join(root, 'floorplan', files.find((f) => f.includes('public'))), 'utf8');
    const g = dataOf(html);
    assert.equal(g.meta.exported.audience, 'public');
    assert.ok(g.files.every((f) => !f.p.includes('/') || f.p.startsWith('part:')));
    assert.ok(fs.existsSync(path.join(root, 'floorplan', 'audience.mjs')));
    assert.ok(fs.existsSync(path.join(root, 'floorplan', 'sanitize-export.mjs')));
  } finally { cleanup(root); }
});

test('export --prepare writes a worksheet the agent can fill', () => {
  const root = shopApp();
  try {
    run('scan.mjs', root);
    run('build.mjs', root, '--no-claude-md');
    const exportJs = path.join(SKILL, 'scripts', 'export.mjs');
    execFileSync(process.execPath, [exportJs, root, '--audience', 'team', '--language', 'fr', '--prepare'], { encoding: 'utf8' });
    const ws = readJson(path.join(root, 'floorplan', 'export-sanitize.json'));
    assert.equal(ws.$schema, 'showplan/export-sanitize@1');
    assert.equal(ws.audience, 'team');
    assert.equal(ws.language, 'fr');
    assert.ok(ws.nodes);
    assert.ok(ws.files);
  } finally { cleanup(root); }
});

test('recent-work commits and release pass through the build', () => {
  const root = shopApp();
  try {
    writeJson(path.join(root, 'floorplan', 'recent-work.json'), {
      tasks: [{
        title: 'v1 launch',
        request: '',
        summary: 'First release',
        mode: 'releases',
        release: 'v1.0.0',
        commits: ['abc1234ffff'],
        items: [{ ref: 'shop-api/server.js', change: 'changed', note: 'Boot path', commits: ['abc1234ffff'], release: 'v1.0.0' }],
      }],
    });
    run('scan.mjs', root);
    run('build.mjs', root, '--no-claude-md');
    const g = readJson(path.join(root, 'floorplan', 'graph.json'));
    assert.equal(g.recent.tasks[0].release, 'v1.0.0');
    assert.equal(g.recent.tasks[0].mode, 'releases');
    assert.equal(g.recent.showCommits, true);
    assert.deepEqual(g.recent.tasks[0].commits, ['abc1234ffff']);
    assert.deepEqual(g.recent.items[0].commits, ['abc1234ffff']);
  } finally { cleanup(root); }
});

test('build strips em dashes from map prose (voice / humanizer safety net)', () => {
  const root = shopApp();
  try {
    writeJson(path.join(root, 'floorplan', 'architecture.json'), {
      ...readJson(path.join(root, 'floorplan', 'architecture.json')),
      project: { name: 'Shop', summary: 'Sells gifts — and ships them.' },
    });
    writeJson(path.join(root, 'floorplan', 'recent-work.json'), {
      tasks: [{
        title: 'Ship',
        request: '',
        summary: 'Added tracking — with email.',
        items: [{ ref: 'shop-api/server.js', change: 'changed', note: 'Sends the link – when ready.' }],
      }],
    });
    run('scan.mjs', root);
    run('build.mjs', root, '--no-claude-md');
    const g = readJson(path.join(root, 'floorplan', 'graph.json'));
    assert.ok(!/[—–]/.test(g.project.summary), g.project.summary);
    assert.match(g.project.summary, /Sells gifts, and ships them\./);
    assert.ok(!/[—–]/.test(g.recent.tasks[0].summary));
    assert.ok(!/[—–]/.test(g.recent.items[0].note));
    assert.match(g.recent.items[0].note, /Sends the link - when ready\./);
  } finally { cleanup(root); }
});

test('personal recent keeps commits; public sanitize strips them and uncommitted', async () => {
  const { sanitizeForExport } = await lib('sanitize-export.mjs');
  const recent = {
    showCommits: true,
    tasks: [
      { title: 'WIP refunds', summary: 'Local edits', uncommitted: true, commits: ['deadbeef'] },
      { title: 'Ship v1', summary: 'Released', mode: 'releases', release: 'v1.0.0', commits: ['abc1234ffff'] },
    ],
    items: [
      { id: 'f:a.js', task: 0, change: 'changed', note: 'draft', uncommitted: true, commits: ['deadbeef'] },
      { id: 'f:b.js', task: 1, change: 'changed', note: 'shipped', commits: ['abc1234ffff'] },
    ],
  };
  const base = {
    meta: { root: '/tmp/x', repos: [], language: 'en' },
    project: { name: 'Shop', summary: '' },
    nodes: [], files: [], routes: [], flows: [], tour: [],
    recent,
  };
  const personalish = sanitizeForExport(base, { audience: 'serverless' }).graph.recent;
  assert.equal(personalish.showCommits, true);
  assert.equal(personalish.tasks.length, 2);
  assert.deepEqual(personalish.tasks[1].commits, ['abc1234ffff']);

  const pub = sanitizeForExport(base, { audience: 'public' }).graph.recent;
  assert.equal(pub.showCommits, false);
  assert.equal(pub.tasks.length, 1);
  assert.equal(pub.tasks[0].title, 'Ship v1');
  assert.equal(pub.tasks[0].commits, undefined);
  assert.equal(pub.items.length, 1);
  assert.equal(pub.items[0].task, 0);
  assert.equal(pub.items[0].commits, undefined);

  const open = sanitizeForExport({ ...base, meta: { ...base.meta, openSource: true } }, { audience: 'public' }).graph.recent;
  assert.equal(open.showCommits, true);
  assert.equal(open.tasks.length, 1, 'public still drops uncommitted even when open-source');
  assert.deepEqual(open.tasks[0].commits, ['abc1234ffff']);
});
