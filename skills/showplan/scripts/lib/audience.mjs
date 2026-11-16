// Export audiences: who the shared map is for. Each preset sets how aggressive the structural
// sanitize is; a free-text description (custom or override) is what the agent uses to rewrite names.
// Presets stay stable; custom audiences reuse a base profile (default: team) plus their description.

export const AUDIENCE_PRESETS = {
  public: {
    id: 'public',
    label: 'Public',
    description:
      'People outside the company: prospects, a public docs site, a conference talk. High-level only. ' +
      'No file paths, function names, route URLs, package names or security findings. Prefer everyday words ' +
      '(database, payments, email) over product names (Postgres, Stripe, SendGrid) unless the product is the story.',
    profile: {
      includeDefault: ['flows', 'recent'],
      hidePaths: true,
      hideSymbols: true,
      hidePackagesHosts: true,
      hideRouteUrls: true,
      hideRepos: true,
      hideHealth: true,
      hideNotes: true,
      allowHealth: false,
    },
  },
  team: {
    id: 'team',
    label: 'Team',
    description:
      'Teammates and collaborators who know the product but should not need every implementation detail. ' +
      'Keep architecture, flows and connections clear. Soften low-level jargon; file paths may stay. ' +
      'Hide function/export lists and the health check unless explicitly requested.',
    profile: {
      includeDefault: ['flows', 'notes', 'recent'],
      hidePaths: false,
      hideSymbols: true,
      hidePackagesHosts: false,
      hideRouteUrls: false,
      hideRepos: false,
      hideHealth: true,
      hideNotes: false,
      allowHealth: false,
    },
  },
  serverless: {
    id: 'serverless',
    label: 'Serverless / Local',
    description:
      'Local or private use: almost the full map. Same detail as a personal Showplan, suitable for sharing ' +
      'inside a trusted environment. Health check only when asked.',
    profile: {
      includeDefault: ['flows', 'notes', 'recent'],
      hidePaths: false,
      hideSymbols: false,
      hidePackagesHosts: false,
      hideRouteUrls: false,
      hideRepos: false,
      hideHealth: false,
      hideNotes: false,
      allowHealth: true,
    },
  },
};

/** Known product names → everyday words (English). The agent should translate for other languages. */
export const TECH_PLAIN = {
  Postgres: 'Database',
  PostgreSQL: 'Database',
  MySQL: 'Database',
  MongoDB: 'Database',
  Redis: 'Cache',
  Stripe: 'Payments',
  SendGrid: 'Email',
  Resend: 'Email',
  Mailgun: 'Email',
  Twilio: 'Messaging',
  Supabase: 'Backend service',
  Firebase: 'Backend service',
  S3: 'File storage',
  'Amazon S3': 'File storage',
  GCS: 'File storage',
  Cloudflare: 'CDN',
  Vercel: 'Hosting',
  Netlify: 'Hosting',
  Docker: 'Containers',
  Kubernetes: 'Containers',
  Kafka: 'Event stream',
  RabbitMQ: 'Message queue',
  SQS: 'Message queue',
  Elasticsearch: 'Search',
  OpenSearch: 'Search',
};

export function listAudiences() {
  return Object.values(AUDIENCE_PRESETS).map(({ id, label, description }) => ({ id, label, description }));
}

/**
 * Resolve an audience id or a custom description.
 * @param {string} audience - preset id, or free text for a custom audience
 * @param {{ base?: string, description?: string }} [opts]
 */
export function resolveAudience(audience, opts = {}) {
  const id = String(audience || '').trim().toLowerCase();
  const preset = AUDIENCE_PRESETS[id];
  if (preset && !opts.description) {
    return {
      id: preset.id,
      label: preset.label,
      description: preset.description,
      custom: false,
      profile: { ...preset.profile },
    };
  }
  const baseId = preset ? preset.id : (AUDIENCE_PRESETS[opts.base]?.id || 'team');
  const base = AUDIENCE_PRESETS[baseId];
  const description = String(opts.description || (preset ? '' : audience) || base.description).trim();
  return {
    id: preset ? preset.id : 'custom',
    label: preset ? preset.label : 'Custom',
    description: description || base.description,
    custom: !preset || !!opts.description,
    profile: { ...base.profile },
  };
}
