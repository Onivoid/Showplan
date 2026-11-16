#!/usr/bin/env node
// Historical "Recent work" source: GitHub Releases (preferred) or git tags.
// Read-only facts for the agent to turn into recent-work.json (mode: releases).
// usage: node releases.mjs [root] [--limit 10] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { git, mapDir, parseArgs, printJson, readJsonFile, unattendedMode } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2));
unattendedMode(args);
const root = path.resolve(args._[0] || '.');
const dir = mapDir(root);
const SCHEMA = 'showplan/releases-result@1';
const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));

const graphFile = path.join(dir, 'graph.json');
if (!fs.existsSync(graphFile)) {
  if (args.json) await printJson({ schema: SCHEMA, ok: false, errors: ['No floorplan/graph.json. Run build.mjs first.'] }, 1);
  console.error('✗ No floorplan/graph.json. Run build.mjs first.');
  process.exit(1);
}
const G = readJsonFile(graphFile);

const run = (cmd, argv, cwd) => {
  try {
    return execFileSync(cmd, argv, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const parseRemote = (url) => {
  if (!url) return null;
  const m = /github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i.exec(url.replace(/https?:\/\//, ''));
  if (m) return { host: 'github.com', owner: m[1], repo: m[2] };
  return null;
};

const releases = [];
const L = [];
L.push(`RELEASES for ${G.project.name} (up to ${limit} per repo)`);

for (const r of G.meta.repos || []) {
  const abs = path.join(root, r.path);
  const remote = r.remote || git(abs, ['config', '--get', 'remote.origin.url']) || '';
  const gh = parseRemote(remote);
  const repoReleases = [];

  if (gh && run('gh', ['--version'], abs)) {
    const raw = run('gh', ['release', 'list', '--repo', `${gh.owner}/${gh.repo}`, '--limit', String(limit), '--json', 'tagName,name,publishedAt,url,isDraft,isPrerelease'], abs);
    if (raw) {
      try {
        for (const rel of JSON.parse(raw)) {
          if (rel.isDraft) continue;
          let body = '';
          const detail = run('gh', ['release', 'view', rel.tagName, '--repo', `${gh.owner}/${gh.repo}`, '--json', 'body'], abs);
          if (detail) try { body = JSON.parse(detail).body || ''; } catch {}
          repoReleases.push({
            tag: rel.tagName,
            title: rel.name || rel.tagName,
            publishedAt: rel.publishedAt || null,
            url: rel.url || `https://github.com/${gh.owner}/${gh.repo}/releases/tag/${rel.tagName}`,
            prerelease: !!rel.isPrerelease,
            body: String(body).slice(0, 4000),
            source: 'github-release',
          });
        }
      } catch {}
    }
  }

  if (!repoReleases.length) {
    // fallback: annotated / lightweight tags, newest first
    const tags = (git(abs, ['tag', '--sort=-creatordate']) || '').split('\n').filter(Boolean).slice(0, limit);
    for (const tag of tags) {
      const when = git(abs, ['log', '-1', '--format=%cI', tag]) || null;
      const subject = git(abs, ['log', '-1', '--format=%s', tag]) || tag;
      repoReleases.push({
        tag,
        title: subject,
        publishedAt: when,
        url: gh ? `https://github.com/${gh.owner}/${gh.repo}/releases/tag/${encodeURIComponent(tag)}` : null,
        prerelease: false,
        body: '',
        source: 'git-tag',
      });
    }
  }

  releases.push({
    repo: r.path,
    name: r.name,
    remote: remote && !/:(?:[^/@]+)@/.test(remote) ? remote : (gh ? `https://github.com/${gh.owner}/${gh.repo}.git` : null),
    github: gh,
    releases: repoReleases,
  });

  L.push('', `REPO  ${r.path}${gh ? `  (${gh.owner}/${gh.repo})` : ''}`);
  if (!repoReleases.length) L.push('  (no releases or tags found)');
  for (const rel of repoReleases) {
    L.push(`  ${rel.tag}  ${rel.title}${rel.publishedAt ? `  · ${rel.publishedAt.slice(0, 10)}` : ''}${rel.source === 'git-tag' ? '  [tag]' : ''}`);
    if (rel.body) L.push(`    ${rel.body.split('\n').filter(Boolean)[0].slice(0, 120)}`);
  }
}

L.push('', 'NEXT');
L.push('  To mark historical work on the map, write floorplan/recent-work.json from one or more releases:');
L.push('  each task can set "release": "<tag>" and optional "commits": ["abc1234", …]; item notes stay patch-note style.');
L.push('  Prefer GitHub release notes over raw commits. Then run build.mjs.');

const result = {
  schema: SCHEMA,
  ok: true,
  project: G.project.name,
  limit,
  repos: releases,
  text: L.join('\n'),
};
if (args.json) await printJson(result, 0);
console.log(L.join('\n'));
process.exit(0);
