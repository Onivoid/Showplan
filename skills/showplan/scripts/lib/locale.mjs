// Map UI chrome + language helpers. Health body text is localized in health-i18n.mjs.
// English is the default. French ships built-in. Other languages: merge floorplan/locale.json (ui + optional health).

export function normalizeLang(tag) {
  if (!tag || typeof tag !== 'string') return 'en';
  const t = tag.trim().toLowerCase().replace('_', '-');
  if (!t) return 'en';
  const base = t.split('-')[0];
  return base || 'en';
}

const EN = {
  health: 'Health',
  healthCheck: 'Health check',
  designReview: 'Design review',
  review: 'Review',
  whatWasChecked: 'What was checked',
  showOnMap: 'Show on map',
  fixWith: 'Fix with',
  resolveWith: 'Resolve with',
  resolveOnMap: 'Resolve on the map',
  copyPrompt: 'Copy prompt',
  notAProblem: 'Not a problem',
  notAProblemQ: 'Not a problem?',
  markNotAProblem: 'Mark as not a problem',
  showAgain: 'Show again',
  markedAsNotAProblem: 'Marked as not a problem',
  fixTheseFirst: 'Fix these first',
  worthFixingSoon: 'Worth fixing soon',
  goodToTidy: 'Good to tidy up',
  important: 'important',
  worthFixing: 'worth fixing',
  minor: 'minor',
  nothingUrgent: 'Nothing urgent',
  noProblems: 'No problems found',
  thingsNeedAttention: '{n} thing needs attention',
  thingsNeedAttentionPlural: '{n} things need attention',
  recentWork: 'Recent work',
  startHere: 'Start here',
  screens: 'Screens',
  export: 'Export',
  showTechnicalDetail: 'Show technical detail',
  usedBy: 'Used by',
  uses: 'Uses',
  dependsOn: 'Depends on',
  inside: 'Inside',
  new: 'New',
  changed: 'Changed',
  youAsked: 'You asked:',
  fromReleases: 'From releases',
  fromCommits: 'From commits',
  fromRecent: 'Recent',
  uncommitted: 'Uncommitted',
  uncommittedHint: 'Local changes, not committed yet',
  release: 'Release',
  commits: 'Commits',
  timeline: 'Timeline',
  timelineHint: 'Grouped changes over time. Open a stop to see the cards on the map.',
  openTimeline: 'Open timeline',
  showCards: 'Show',
  updated: 'Updated',
  back: 'Back',
  nothingLeft: 'Nothing left to look at',
  quickCheckHealth: 'We looked for keys left in the code or sent to the browser, data and parts of your app anyone on the internet can reach (Supabase tables, Firebase rules, Stripe webhooks, endpoints), leftover files and files too big to edit safely. It’s a quick check, not a security audit.',
  quickCheckPlan: 'We checked the plan for parts anyone on the internet could use, decisions the PRD leaves open, and pieces nothing connects to. Settling these now is cheaper than after it’s built.',
  calmEmpty: 'Nothing stood out. This is a quick automatic check, not a full security review.',
  calmEmptyPlan: 'Nothing stood out. This is a quick automatic check, not a full design review.',
  copyPasteHint: 'Copy this request and paste it into {app}, opened in your project folder. It explains what to change and asks before anything risky.',
  kindContains: 'Contains',
  kindImport: 'Uses',
  kindHttp: 'Web requests',
  kindCall: 'Calls',
  kindRpc: 'Calls',
  kindEvent: 'Events',
  kindQueue: 'Background jobs',
  kindData: 'Reads & writes data',
  kindConfig: 'Settings',
  kindTechContains: 'Contains',
  kindTechImport: 'Imports',
  kindTechHttp: 'HTTP',
  kindTechCall: 'Calls',
  kindTechRpc: 'RPC',
  kindTechEvent: 'Events',
  kindTechQueue: 'Queues',
  kindTechData: 'Data',
  kindTechConfig: 'Config',
};

const FR = {
  health: 'Santé',
  healthCheck: 'Contrôle santé',
  designReview: 'Revue du plan',
  review: 'Revue',
  whatWasChecked: 'Ce qui a été vérifié',
  showOnMap: 'Voir sur la carte',
  fixWith: 'Corriger avec',
  resolveWith: 'Régler avec',
  resolveOnMap: 'Régler sur la carte',
  copyPrompt: 'Copier la demande',
  notAProblem: 'Pas un problème',
  notAProblemQ: 'Pas un problème ?',
  markNotAProblem: 'Marquer comme pas un problème',
  showAgain: 'Réafficher',
  markedAsNotAProblem: 'Marqué comme pas un problème',
  fixTheseFirst: 'À traiter en premier',
  worthFixingSoon: 'À corriger bientôt',
  goodToTidy: 'Bon à ranger',
  important: 'important',
  worthFixing: 'à corriger',
  minor: 'mineur',
  nothingUrgent: 'Rien d’urgent',
  noProblems: 'Aucun problème trouvé',
  thingsNeedAttention: '{n} point demande attention',
  thingsNeedAttentionPlural: '{n} points demandent attention',
  recentWork: 'Travail récent',
  startHere: 'Par ici',
  screens: 'Écrans',
  export: 'Exporter',
  showTechnicalDetail: 'Afficher le détail technique',
  usedBy: 'Utilisé par',
  uses: 'Utilise',
  dependsOn: 'Dépend de',
  inside: 'Dans',
  new: 'Nouveau',
  changed: 'Modifié',
  youAsked: 'Tu as demandé :',
  fromReleases: 'Depuis les releases',
  fromCommits: 'Depuis les commits',
  fromRecent: 'Récent',
  uncommitted: 'Non commité',
  uncommittedHint: 'Changements locaux, pas encore commités',
  release: 'Release',
  commits: 'Commits',
  timeline: 'Chronologie',
  timelineHint: 'Changements regroupés dans le temps. Ouvre une étape pour voir les cartes.',
  openTimeline: 'Ouvrir la chronologie',
  showCards: 'Voir',
  updated: 'Mis à jour',
  back: 'Retour',
  nothingLeft: 'Plus rien à regarder',
  quickCheckHealth: 'On a cherché des clés laissées dans le code ou envoyées au navigateur, des données et morceaux d’app joignables par n’importe qui (tables Supabase, règles Firebase, webhooks Stripe, endpoints), des fichiers orphelins et des fichiers trop gros pour être édités sans risque. C’est un contrôle rapide, pas un audit de sécurité.',
  quickCheckPlan: 'On a regardé le plan pour les parties joignables depuis internet, les décisions que le PRD laisse ouvertes, et les pièces reliées à rien. Mieux vaut trancher maintenant qu’après construction.',
  calmEmpty: 'Rien n’a sauté aux yeux. C’est un contrôle automatique rapide, pas une revue de sécurité complète.',
  calmEmptyPlan: 'Rien n’a sauté aux yeux. C’est un contrôle automatique rapide, pas une revue de conception complète.',
  copyPasteHint: 'Copie cette demande et colle-la dans {app}, ouvert sur le dossier du projet. Elle explique quoi changer et demande avant tout risque.',
  kindContains: 'Contient',
  kindImport: 'Utilise',
  kindHttp: 'Requêtes web',
  kindCall: 'Appelle',
  kindRpc: 'Appelle',
  kindEvent: 'Événements',
  kindQueue: 'Tâches de fond',
  kindData: 'Lit et écrit des données',
  kindConfig: 'Réglages',
  kindTechContains: 'Contient',
  kindTechImport: 'Imports',
  kindTechHttp: 'HTTP',
  kindTechCall: 'Appels',
  kindTechRpc: 'RPC',
  kindTechEvent: 'Événements',
  kindTechQueue: 'Files',
  kindTechData: 'Données',
  kindTechConfig: 'Config',
};

const CATALOGS = { en: EN, fr: FR };

export function uiCatalog(language) {
  const lang = normalizeLang(language);
  return { ...(CATALOGS[lang] || EN) };
}

export function mergeLocaleOverlay(base, overlay) {
  if (!overlay || typeof overlay !== 'object') return base;
  const ui = overlay.ui && typeof overlay.ui === 'object' ? overlay.ui : overlay;
  return { ...base, ...Object.fromEntries(Object.entries(ui).filter(([, v]) => typeof v === 'string')) };
}

export function formatUi(str, vars = {}) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function hasBuiltInLocale(language) {
  return !!CATALOGS[normalizeLang(language)];
}
