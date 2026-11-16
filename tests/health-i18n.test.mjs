// Health + UI follow architecture.json language (French built-in).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { shopApp, run, writeJson, readJson, cleanup, lib } from './helpers.mjs';

test('applyHealthLocale translates secret titles to French', async () => {
  const { applyHealthLocale } = await lib('health-i18n.mjs');
  const health = {
    summary: { high: 1, medium: 0, low: 0 },
    issues: [{
      id: 'secret:api/.env',
      kind: 'secret',
      severity: 'high',
      title: 'A secret key is written into .env',
      detail: 'api/.env contains a password. Anyone who can see the code can use it to get into the services they unlock as you. Treat it as leaked: move it out of the code and replace it with a new one.',
      fix: 'Security fix: hard-coded secrets. Do not print, echo or repeat any secret value.',
      locations: [{ file: 'api/.env', line: 2 }],
      items: [],
      notes: {},
    }],
    checked: [{ check: 'secrets', label: 'Secrets in code', checked: true, text: 'read 3 files' }],
  };
  const fr = applyHealthLocale(health, 'fr');
  assert.match(fr.issues[0].title, /clé secrète|écrit/i);
  assert.match(fr.issues[0].fix, /Correction sécurité/i);
  assert.equal(fr.checked[0].label, 'Secrets dans le code');
  const en = applyHealthLocale(health, 'en');
  assert.equal(en.issues[0].title, health.issues[0].title);
});

test('build with language fr localizes Health and sets meta.ui', () => {
  const root = shopApp();
  try {
    run('scan.mjs', root);
    writeJson(path.join(root, 'floorplan', 'architecture.json'), {
      project: { name: 'Shop', summary: 'Boutique de test.' },
      language: 'fr',
      audience: 'everyone',
      nodes: [
        { id: 'api', label: 'Serveur', kind: 'service', summary: 'API boutique.', paths: ['shop-api/**'] },
        { id: 'web', label: 'Site', kind: 'ui', summary: 'Front boutique.', paths: ['shop-web/**'] },
      ],
    });
    run('build.mjs', root, '--no-claude-md');
    const g = readJson(path.join(root, 'floorplan', 'graph.json'));
    assert.equal(g.meta.language, 'fr');
    assert.equal(g.meta.ui.health, 'Santé');
    assert.equal(g.meta.ui.whatWasChecked, 'Ce qui a été vérifié');
    if (g.health?.issues?.length) {
      const titles = g.health.issues.map((i) => i.title).join('\n');
      assert.doesNotMatch(titles, /\bAnyone\b/);
      assert.doesNotMatch(titles, /\bA secret key is written\b/);
    }
    if (g.health?.checked?.length) {
      assert.ok(g.health.checked.every((c) => !/^Endpoint sign-in$/.test(c.label)));
    }
  } finally { cleanup(root); }
});
