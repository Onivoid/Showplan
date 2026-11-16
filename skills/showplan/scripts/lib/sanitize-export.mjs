// Structural sanitize of a Showplan graph for a shareable export, plus an optional AI overlay
// (export-sanitize.json) that rewrites names/descriptions for the audience and language.
import { TECH_PLAIN, resolveAudience } from './audience.mjs';

const EXPORT_PARTS = ['flows', 'notes', 'recent', 'health'];

const plainTech = (s) => {
  if (typeof s !== 'string' || !s) return s;
  let out = s;
  for (const [tech, plain] of Object.entries(TECH_PLAIN)) {
    out = out.replace(new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), plain);
  }
  return out;
};

const applyPlain = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return obj;
  const next = { ...obj };
  for (const k of keys) if (typeof next[k] === 'string') next[k] = plainTech(next[k]);
  return next;
};

/**
 * Merge an AI sanitize overlay onto a graph (names/descriptions only; structure stays).
 * Overlay shape: showplan/export-sanitize@1
 */
export function applySanitizeOverlay(graph, overlay) {
  if (!overlay || typeof overlay !== 'object') return graph;
  const g = structuredClone(graph);
  if (overlay.project && typeof overlay.project === 'object') {
    g.project = {
      ...g.project,
      ...(overlay.project.name ? { name: String(overlay.project.name) } : {}),
      ...(overlay.project.summary != null ? { summary: String(overlay.project.summary) } : {}),
    };
  }
  const nodesById = overlay.nodes && typeof overlay.nodes === 'object' ? overlay.nodes : {};
  g.nodes = (g.nodes || []).map((n) => {
    const o = nodesById[n.id];
    if (!o) return n;
    return {
      ...n,
      ...(o.label != null ? { label: String(o.label) } : {}),
      ...(o.summary != null ? { summary: String(o.summary) } : {}),
      ...(o.details != null ? { details: String(o.details) } : {}),
    };
  });
  const filesByPath = overlay.files && typeof overlay.files === 'object' ? overlay.files : {};
  g.files = (g.files || []).map((f) => {
    const o = filesByPath[f.p] || filesByPath[f.path];
    if (!o) return f;
    return {
      ...f,
      ...(o.name != null ? { name: String(o.name) } : {}),
      ...(o.description != null || o.d != null ? { d: String(o.description ?? o.d) } : {}),
    };
  });
  const routesByKey = overlay.routes && typeof overlay.routes === 'object' ? overlay.routes : {};
  g.routes = (g.routes || []).map((r) => {
    const key = `${r.m} ${r.p}`;
    const o = routesByKey[key] || routesByKey[r.p];
    if (!o) return r;
    return {
      ...r,
      ...(o.name != null ? { name: String(o.name) } : {}),
      ...(o.description != null || o.d != null ? { d: String(o.description ?? o.d) } : {}),
    };
  });
  if (Array.isArray(overlay.flows) || (overlay.flows && typeof overlay.flows === 'object')) {
    const byId = Array.isArray(overlay.flows)
      ? Object.fromEntries(overlay.flows.filter((f) => f?.id).map((f) => [f.id, f]))
      : overlay.flows;
    g.flows = (g.flows || []).map((f) => {
      const o = byId[f.id];
      if (!o) return f;
      const steps = Array.isArray(o.steps)
        ? f.steps.map((s, i) => (o.steps[i]?.note != null ? { ...s, note: String(o.steps[i].note) } : s))
        : f.steps;
      return {
        ...f,
        ...(o.title != null ? { title: String(o.title) } : {}),
        ...(o.description != null ? { description: String(o.description) } : {}),
        steps,
      };
    });
  }
  if (Array.isArray(overlay.tour) && Array.isArray(g.tour)) {
    g.tour = g.tour.map((t, i) => {
      const o = overlay.tour[i];
      if (!o) return t;
      return {
        ...t,
        ...(o.title != null ? { title: String(o.title) } : {}),
        ...(o.note != null ? { note: String(o.note) } : {}),
      };
    });
  }
  if (overlay.recent && typeof overlay.recent === 'object') {
    g.recent = {
      ...(g.recent || {}),
      ...(overlay.recent.updatedAt ? { updatedAt: overlay.recent.updatedAt } : {}),
      ...(Array.isArray(overlay.recent.tasks) ? { tasks: overlay.recent.tasks } : {}),
      ...(Array.isArray(overlay.recent.items) ? { items: overlay.recent.items } : g.recent?.items),
    };
  }
  return g;
}

/**
 * Structural sanitize for an audience profile (after optional overlay).
 * Does not rewrite prose beyond TECH_PLAIN when generalizeTech is true.
 */
export function structuralSanitize(graph, audience, { include, generalizeTech = true } = {}) {
  const resolved = typeof audience === 'string' ? resolveAudience(audience) : audience;
  const profile = resolved.profile;
  const on = EXPORT_PARTS.filter((p) => {
    if (p === 'health' && (profile.hideHealth || !profile.allowHealth)) return include?.includes('health') && profile.allowHealth;
    if (p === 'notes' && profile.hideNotes) return false;
    return (include || profile.includeDefault).includes(p);
  });

  let g = structuredClone(graph);
  if (generalizeTech && (profile.hidePackagesHosts || resolved.id === 'public')) {
    g.project = applyPlain(g.project, ['name', 'summary']);
    g.nodes = (g.nodes || []).map((n) => applyPlain(n, ['label', 'summary', 'details']));
    g.files = (g.files || []).map((f) => applyPlain(f, ['name', 'd', 'doc']));
    g.routes = (g.routes || []).map((r) => applyPlain(r, ['name', 'd', 'doc']));
    g.flows = (g.flows || []).map((f) => ({
      ...applyPlain(f, ['title', 'description']),
      steps: (f.steps || []).map((s) => applyPlain(s, ['note'])),
    }));
    g.tour = (g.tour || []).map((t) => applyPlain(t, ['title', 'note']));
    if (g.recent?.tasks) {
      g.recent = {
        ...g.recent,
        tasks: g.recent.tasks.map((t) => applyPlain(t, ['title', 'request', 'summary', 'status'])),
        items: (g.recent.items || []).map((it) => applyPlain(it, ['note'])),
      };
    }
  }

  g.nodes = (g.nodes || []).map((n) => {
    const next = { ...n };
    if (profile.hidePackagesHosts) {
      next.packages = [];
      next.hosts = [];
    }
    if (profile.hidePaths) next.paths = [];
    return next;
  });

  g.files = (g.files || []).map((f) => {
    const next = { ...f };
    if (profile.hideSymbols) {
      delete next.s;
      delete next.h;
      delete next.sig;
    }
    if (profile.hideRepos) delete next.doc;
    if (profile.hidePaths) {
      // keep a stable id for layout; show a generic path under the card
      next.p = next.n ? `part:${next.n}` : 'file';
      delete next.r;
    }
    if (profile.hideNotes || !on.includes('notes')) {
      delete next.note;
      delete next.tags;
    }
    return next;
  });

  g.routes = (g.routes || []).map((r) => {
    const next = { ...r };
    if (profile.hideRepos) delete next.doc;
    if (profile.hideRouteUrls) {
      next.p = '/…';
      delete next.h;
    }
    return next;
  });

  g.flows = on.includes('flows') ? g.flows || [] : [];
  g.tour = on.includes('flows') ? g.tour || [] : [];
  if (!on.includes('recent')) delete g.recent;
  if (!on.includes('health') || profile.hideHealth) delete g.health;

  // screens / health often leak paths; drop screens on public
  if (profile.hidePaths) delete g.screens;

  g.meta = {
    ...(g.meta || {}),
    root: null,
    repos: (g.meta?.repos || []).map(({ remote, ...r }) => r),
    exported: {
      at: new Date().toISOString(),
      include: on,
      audience: resolved.id,
      audienceLabel: resolved.label,
      audienceDescription: resolved.description,
      language: g.meta?.language || null,
      custom: !!resolved.custom,
    },
  };
  if (g.meta.language) g.meta.exported.language = g.meta.language;

  return { graph: g, include: on, audience: resolved };
}

/**
 * Full pipeline: overlay (optional) then structural sanitize.
 */
export function sanitizeForExport(graph, {
  audience = 'team',
  audienceDescription,
  base,
  language,
  include,
  overlay,
  generalizeTech = true,
} = {}) {
  const resolved = resolveAudience(audience, { description: audienceDescription, base });
  let g = overlay ? applySanitizeOverlay(graph, overlay) : structuredClone(graph);
  if (language) g.meta = { ...(g.meta || {}), language };
  return structuralSanitize(g, resolved, { include, generalizeTech });
}

export { EXPORT_PARTS };
