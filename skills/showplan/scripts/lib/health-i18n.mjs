// Localize graph.health (titles, details, fix prompts, notes, "what was checked") for the map language.
// English stays as produced by health.mjs. French ships built-in. Other languages: floorplan/locale.json → health.
import { normalizeLang } from './locale.mjs';

const fileOf = (issue) => issue.locations?.[0]?.file?.split('/').pop() || issue.locations?.[0]?.file || '';
const pathOf = (issue) => issue.locations?.[0]?.file || '';
const nLoc = (issue) => issue.locations?.length || 0;
const basename = (p) => (p || '').split('/').pop() || p || '';

const CHECKED_FR = {
  endpoints: 'Connexion aux endpoints',
  supabase: 'Règles des tables Supabase',
  firebase: 'Règles Firebase',
  stripe: 'Webhooks Stripe',
  secrets: 'Secrets dans le code',
};

function translateCheckedFr(c) {
  const label = CHECKED_FR[c.check] || c.label;
  let text = c.text;
  // common patterns from whatWasChecked
  text = text
    .replace(/^checked (\d+) of the (\d+) endpoints found \((.+)\)$/i, (_, a, b, rest) =>
      `${a} endpoints vérifiés sur ${b} trouvés (${rest
        .replace(/the others are set up in a way Showplan can’t check yet, or belong to scripts and tests/i, 'les autres sont montés d’une façon que Showplan ne peut pas encore vérifier, ou appartiennent à des scripts et tests')
      })`)
    .replace(/^checked (\d+) endpoint(s)?$/i, (_, n) => `${n} endpoint${n === '1' ? '' : 's'} vérifié${n === '1' ? '' : 's'}`)
    .replace(/^not checked: (\d+) endpoint(s)? found, but set up in a way Showplan can’t check for a login yet$/i, (_, n) =>
      `non vérifié : ${n} endpoint${n === '1' ? '' : 's'} trouvé${n === '1' ? '' : 's'}, mais monté${n === '1' ? '' : 's'} d’une façon que Showplan ne peut pas encore contrôler pour une connexion`)
    .replace(/^not checked: no endpoints found, but (.+) looks like it runs a server \((.+)\)(, and so .+)?\. Its endpoints may be set up in a way Showplan doesn’t recognise yet, so nothing checked whether they need a login\.$/i,
      (_, file, what) => `non vérifié : aucun endpoint trouvé, mais ${file} ressemble à un serveur (${what}). Ses endpoints sont peut‑être montés d’une façon que Showplan ne reconnaît pas encore, donc rien n’a vérifié s’ils exigent une connexion.`)
    .replace(/^not checked: no endpoints found\. If your app has a server, it may use a setup Showplan doesn’t recognise yet\.$/i,
      'non vérifié : aucun endpoint trouvé. Si l’app a un serveur, il utilise peut‑être un montage que Showplan ne reconnaît pas encore.')
    .replace(/^checked (\d+) table(s)? in the migrations$/i, (_, n) => `${n} table${n === '1' ? '' : 's'} vérifiée${n === '1' ? '' : 's'} dans les migrations`)
    .replace(/^not checked: the app uses Supabase, but no migrations that create tables were found\. Tables made in the Supabase dashboard can’t be checked from the code\.$/i,
      'non vérifié : l’app utilise Supabase, mais aucune migration qui crée des tables n’a été trouvée. Les tables créées dans le tableau de bord Supabase ne peuvent pas être vérifiées depuis le code.')
    .replace(/^no Supabase found$/i, 'pas de Supabase trouvé')
    .replace(/^checked (\d+) rules file(s)?$/i, (_, n) => `${n} fichier${n === '1' ? '' : 's'} de règles vérifié${n === '1' ? '' : 's'}`)
    .replace(/^not checked: the project uses Firebase, but no rules files were found\. Rules set in the Firebase console can’t be checked from the code\.$/i,
      'non vérifié : le projet utilise Firebase, mais aucun fichier de règles n’a été trouvé. Les règles définies dans la console Firebase ne peuvent pas être vérifiées depuis le code.')
    .replace(/^no rules files found$/i, 'aucun fichier de règles trouvé')
    .replace(/^checked (\d+) file(s)? that receive(s)? Stripe events$/i, (_, n) => `${n} fichier${n === '1' ? '' : 's'} qui reçoit${n === '1' ? '' : 'vent'} des événements Stripe vérifié${n === '1' ? '' : 's'}`)
    .replace(/^the app uses Stripe, but no code that receives its events was found$/i, 'l’app utilise Stripe, mais aucun code qui reçoit ses événements n’a été trouvé')
    .replace(/^no Stripe code found$/i, 'pas de code Stripe trouvé')
    .replace(/^read (\d+) file(s)?(; (.+))?$/i, (_, n, _s, rest) =>
      `${n} fichier${n === '1' ? '' : 's'} lu${n === '1' ? '' : 's'}${rest ? `; ${rest
        .replace(/(\d+) file(s)? too big to read (wasn’t|weren’t) checked/i, (_, m) => `${m} fichier${m === '1' ? '' : 's'} trop gros non vérifié${m === '1' ? '' : 's'}`)
      }` : ''}`);
  return { ...c, label, text };
}

function localizeIssueFr(issue) {
  const n = nLoc(issue);
  const file = fileOf(issue);
  const path = pathOf(issue);
  const next = { ...issue };
  const notes = issue.notes && typeof issue.notes === 'object'
    ? Object.fromEntries(Object.entries(issue.notes).map(([k, v]) => [k, localizeNoteFr(String(v || ''))]))
    : issue.notes;

  switch (issue.kind) {
    case 'secret': {
      const one = n === 1 || (issue.id || '').startsWith('secret:') && !issue.title?.match(/^\d+/);
      const titleOne = /^A secret key is written into (.+)$/i.exec(issue.title);
      const titleMany = /^(\d+) passwords or keys are written into (.+)$/i.exec(issue.title);
      const where = titleOne?.[1] || titleMany?.[2] || file || 'des fichiers';
      const count = titleMany ? +titleMany[1] : (titleOne ? 1 : n || 1);
      next.title = count === 1
        ? `Une clé secrète est écrite dans ${where}`
        : `${count} mots de passe ou clés sont écrits dans ${where}`;
      next.detail = rewriteSecretDetailFr(issue.detail, { where, count, path });
      next.fix = rewriteFixFr(issue.fix, 'secret');
      break;
    }
    case 'env-file': {
      const tracked = /saved in git/i.test(issue.title);
      next.title = tracked
        ? 'Ton fichier de réglages privés est enregistré dans git'
        : 'Ton fichier de réglages privés n’est pas caché de git';
      next.detail = tracked
        ? `${path || file} contient des mots de passe ou des clés et est versionné : quiconque a accès au code (et à son historique) peut les lire. Ce fichier doit rester seulement sur ta machine.`
        : `${path || file} contient des mots de passe ou des clés et n’est pas dans .gitignore : le prochain commit l’enverra avec le code.`;
      next.fix = rewriteFixFr(issue.fix, 'env-file');
      break;
    }
    case 'public-env-secret': {
      const many = /(\d+) secret keys are sent/i.exec(issue.title);
      const oneName = /^(\S+) is sent to every visitor/i.exec(issue.title);
      next.title = many
        ? `${many[1]} clés secrètes sont envoyées au navigateur de chaque visiteur`
        : oneName
          ? `${oneName[1]} est envoyé au navigateur de chaque visiteur`
          : 'Des clés secrètes sont envoyées au navigateur de chaque visiteur';
      next.detail = (issue.detail || '')
        .replace(/Settings whose names start with NEXT_PUBLIC_, VITE_ and the like are copied into the code your site sends to every visitor, where anyone can read them in their browser’s developer tools\./i,
          'Les réglages dont le nom commence par NEXT_PUBLIC_, VITE_ et assimilés sont copiés dans le code que ton site envoie à chaque visiteur : n’importe qui peut les lire dans les outils développeur du navigateur.')
        .replace(/looks like a secret key/gi, 'ressemble à une clé secrète')
        .replace(/look like secret keys/gi, 'ressemblent à des clés secrètes')
        .replace(/so anyone could use .+ as you: run up your bill, send messages as you, or reach your data\./i,
          'donc n’importe qui pourrait les utiliser à ta place : faire gonfler la facture, envoyer des messages comme toi, ou atteindre tes données.')
        .replace(/Right now only server code seems to read it, so it may not have reached a browser yet, but the name invites that\./i,
          'Pour l’instant seul du code serveur semble le lire, donc ça n’a peut‑être pas encore atteint un navigateur, mais le nom y invite.');
      next.fix = rewriteFixFr(issue.fix, 'public-env');
      break;
    }
    case 'database-rules': {
      next.title = (issue.title || '')
        .replace(/^Anyone can read and change your (.+) table$/i, 'N’importe qui peut lire et modifier ta table $1')
        .replace(/^Anyone can read and change (\d+) of your database tables$/i, 'N’importe qui peut lire et modifier $1 de tes tables')
        .replace(/^Showplan can’t tell whether your (.+) table is protected$/i, 'Showplan ne peut pas dire si ta table $1 est protégée')
        .replace(/^Showplan can’t tell whether (\d+) of your database tables are protected$/i, 'Showplan ne peut pas dire si $1 de tes tables sont protégées')
        .replace(/^A database rule lets anyone change your (.+) table$/i, 'Une règle de base laisse n’importe qui modifier ta table $1')
        .replace(/^(\d+) database rules let anyone change your data$/i, '$1 règles de base laissent n’importe qui modifier tes données')
        .replace(/^Anyone can upload, replace or delete your Firebase files$/i, 'N’importe qui peut envoyer, remplacer ou supprimer tes fichiers Firebase')
        .replace(/^Anyone can read everything in your Firebase Realtime Database$/i, 'N’importe qui peut tout lire dans ta Firebase Realtime Database')
        .replace(/^Anyone can .+ Firebase/i, (m) => m.replace(/^Anyone can/i, 'N’importe qui peut'));
      next.detail = (issue.detail || '')
        .replace(/Your app talks to Supabase with a public key that every visitor’s browser has\./i,
          'Ton app parle à Supabase avec une clé publique que le navigateur de chaque visiteur a.')
        .replace(/Row-level security is what stops one person from reading or changing someone else’s rows, and it’s off for/i,
          'La sécurité au niveau des lignes (RLS) empêche quelqu’un de lire ou modifier les lignes d’un autre, et elle est désactivée pour')
        .replace(/Without it, anyone can use that key to read, change or delete every row/i,
          'Sans elle, n’importe qui peut utiliser cette clé pour lire, modifier ou supprimer chaque ligne')
        .replace(/If your app only reaches the database from its own server, the risk is lower, but switching it on is still the safe default\./i,
          'Si ton app n’atteint la base que depuis son propre serveur, le risque est plus bas, mais l’activer reste le choix sûr.')
        .replace(/Worth checking once in the Supabase dashboard, where a table without it is marked “RLS disabled”\./i,
          'À vérifier une fois dans le tableau de bord Supabase, où une table sans RLS est marquée « RLS disabled ».')
        .replace(/If a table is a public form \(like a waitlist or contact form\), letting anyone add rows is fine; otherwise limit it to signed-in users and their own rows\./i,
          'Si la table est un formulaire public (liste d’attente, contact), laisser n’importe qui ajouter des lignes peut être voulu ; sinon limite aux utilisateurs connectés et à leurs propres lignes.');
      next.fix = rewriteFixFr(issue.fix, 'database');
      break;
    }
    case 'stripe-webhook': {
      next.title = `N’importe qui pourrait falsifier un paiement Stripe dans ${file || 'ce fichier'}`;
      next.detail = (issue.detail || '')
        .replace(/acts on Stripe events \(like “(.+?)”\) without checking Stripe’s signature, so anyone who finds the address can send a fake “payment succeeded” message and get orders, credits or a subscription for free\. Stripe signs every real event; checking that signature takes a few lines\./i,
          (_, ev) => `traite des événements Stripe (comme « ${ev} ») sans vérifier la signature Stripe : quiconque trouve l’adresse peut envoyer un faux « paiement réussi » et obtenir commandes, crédits ou abonnement gratis. Stripe signe chaque vrai événement ; vérifier cette signature tient en quelques lignes.`);
      next.fix = rewriteFixFr(issue.fix, 'stripe');
      break;
    }
    case 'cors': {
      next.title = /signed-in users/i.test(issue.title)
        ? 'N’importe quel site pourrait agir comme tes utilisateurs connectés'
        : 'N’importe quel site peut appeler ton serveur depuis le navigateur d’un visiteur';
      next.detail = (issue.detail || '')
        .replace(/Your server’s CORS settings allow every website/i, 'Les réglages CORS de ton serveur autorisent tous les sites')
        .replace(/with credentials/i, 'avec identifiants')
        .replace(/so a malicious page could call your API as whoever is signed in there/i,
          'donc une page malveillante pourrait appeler ton API en tant que la personne connectée')
        .replace(/Lock CORS down to the sites you actually run\./i, 'Limite le CORS aux sites que tu fais tourner vraiment.');
      next.fix = rewriteFixFr(issue.fix, 'cors');
      break;
    }
    case 'unprotected-endpoint': {
      next.title = (issue.title || '')
        .replace(/^A login check is in the wrong place, so it does nothing$/i, 'Un contrôle de connexion est au mauvais endroit, donc il ne fait rien')
        .replace(/^None of (.+) endpoints check who is calling$/i, 'Aucun des endpoints de $1 ne vérifie qui appelle')
        .replace(/^None of your endpoints check who is calling$/i, 'Aucun de tes endpoints ne vérifie qui appelle')
        .replace(/^Anyone could change data through (.+)$/i, 'N’importe qui pourrait modifier des données via $1')
        .replace(/^Anyone could send fake events to (.+)$/i, 'N’importe qui pourrait envoyer de faux événements à $1')
        .replace(/^Anyone could read data from (.+)$/i, 'N’importe qui pourrait lire des données depuis $1')
        .replace(/^Anyone could change data through one planned endpoint$/i, 'N’importe qui pourrait modifier des données via un endpoint prévu')
        .replace(/^Anyone could change data through (\d+) planned endpoints$/i, 'N’importe qui pourrait modifier des données via $1 endpoints prévus')
        .replace(/^The plan doesn’t say who may use one endpoint$/i, 'Le plan ne dit pas qui peut utiliser un endpoint')
        .replace(/^The plan doesn’t say who may use (\d+) endpoints$/i, 'Le plan ne dit pas qui peut utiliser $1 endpoints');
      next.detail = (issue.detail || '')
        .replace(/On .+ the login check .+ is written above the route line instead of below it\. Flask only sees what's below, so .+ open to anyone even though .+ protected\./i,
          'Le contrôle de connexion est écrit au‑dessus de la ligne de route au lieu d’en dessous. Flask ne voit que ce qui est en dessous, donc c’est ouvert à tout le monde même si ça a l’air protégé.')
        .replace(/answer anyone who knows the address, with no login check in the code\./i,
          'répondent à quiconque connaît l’adresse, sans contrôle de connexion dans le code.')
        .replace(/That's fine only if this server is private/i, 'C’est acceptable seulement si ce serveur est privé')
        .replace(/otherwise anyone could read or change its data\./i, 'sinon n’importe qui pourrait lire ou modifier ses données.')
        .replace(/The plan lets .+ create, change or delete data with no sign-in\./i,
          'Le plan laisse créer, modifier ou supprimer des données sans connexion.')
        .replace(/Deciding who can use each part of the system now/i, 'Décider maintenant qui peut utiliser chaque partie du système');
      next.fix = rewriteFixFr(issue.fix, 'endpoints');
      break;
    }
    case 'unused-file': {
      next.title = (issue.title || '')
        .replace(/^A file in (.+) looks unused$/i, 'Un fichier dans $1 semble inutilisé')
        .replace(/^(\d+) files in (.+) look unused$/i, '$1 fichiers dans $2 semblent inutilisés')
        .replace(/^Nothing in the plan uses one endpoint$/i, 'Rien dans le plan n’utilise un endpoint')
        .replace(/^Nothing in the plan uses (\d+) endpoints$/i, 'Rien dans le plan n’utilise $1 endpoints')
        .replace(/^One planned file isn’t connected to anything$/i, 'Un fichier prévu n’est relié à rien')
        .replace(/^(\d+) planned files aren’t connected to anything$/i, '$1 fichiers prévus ne sont reliés à rien');
      next.detail = (issue.detail || '')
        .replace(/Nothing in the app imports or calls .+ Leftover code confuses AI assistants, which may edit or copy the wrong version\. Double-check before deleting: some files are loaded in ways the map can't see\./i,
          'Rien dans l’app n’importe ni n’appelle ce(s) fichier(s). Le code mort embrouille les assistants IA, qui peuvent éditer ou copier la mauvaise version. Vérifie avant de supprimer : certains fichiers sont chargés d’une façon que la carte ne voit pas.')
        .replace(/No planned page or service calls/i, 'Aucune page ou service prévu n’appelle')
        .replace(/Nothing in the plan uses/i, 'Rien dans le plan n’utilise');
      next.fix = rewriteFixFr(issue.fix, 'unused');
      break;
    }
    case 'large-file': {
      next.title = /^One file is very large$/i.test(issue.title)
        ? 'Un fichier est très gros'
        : (issue.title || '').replace(/^(\d+) files are very large$/i, '$1 fichiers sont très gros');
      next.detail = (issue.detail || '')
        .replace(/over 1,000 lines/gi, 'plus de 1 000 lignes')
        .replace(/AI assistants read and edit big files less reliably: they lose track of what's where and can break one part while fixing another\. Splitting them into smaller files by job makes future changes safer\./i,
          'Les assistants IA lisent et éditent moins bien les gros fichiers : ils perdent le fil et peuvent casser une partie en en corrigeant une autre. Les découper en plus petits fichiers par rôle rend les changements futurs plus sûrs.');
      next.fix = rewriteFixFr(issue.fix, 'large');
      break;
    }
    case 'hardcoded-url': {
      next.title = 'L’app pointe vers l’adresse de ta propre machine';
      next.detail = (issue.detail || '')
        .replace(/call(s)? a fixed “localhost” address\. That only works on your machine; once the app is online those calls will fail for everyone else\./i,
          'appelle une adresse « localhost » figée. Ça ne marche que sur ta machine ; une fois l’app en ligne, ces appels échoueront pour tout le monde.');
      next.fix = rewriteFixFr(issue.fix, 'localhost');
      break;
    }
    case 'question': {
      // title stays (from PRD / agent); translate the stock detail/fix wrappers
      next.detail = (issue.detail || '')
        .replace(/The PRD doesn’t answer this, and the answer changes what gets built\. Decide it before building the parts it touches\./i,
          'Le PRD ne répond pas à ça, et la réponse change ce qui sera construit. Trancher avant de bâtir les parties concernées.');
      next.fix = rewriteFixFr(issue.fix, 'question');
      break;
    }
    default:
      break;
  }
  if (notes) next.notes = notes;
  return next;
}

function localizeNoteFr(s) {
  return s
    .replace(/\bline\b/gi, 'ligne')
    .replace(/\bPlanned as open to anyone, and changes data\b/gi, 'Prévu ouvert à tous, et modifie des données')
    .replace(/\bWho may use this isn’t decided\b/gi, 'Qui peut l’utiliser n’est pas décidé')
    .replace(/\bDepends on an open question\b/gi, 'Dépend d’une question ouverte')
    .replace(/\bNo planned caller\b/gi, 'Aucun appelant prévu')
    .replace(/\bNot connected to anything in the plan\b/gi, 'Relié à rien dans le plan')
    .replace(/\bthe whole file\b/gi, 'tout le fichier')
    .replace(/\bmore\b/gi, 'de plus');
}

function rewriteSecretDetailFr(detail, { where, count, path }) {
  if (!detail) {
    return count === 1
      ? `${where} contient un secret. Quiconque voit le code peut l’utiliser. Traite‑le comme fuité : sors‑le du code et remplace‑le.`
      : `${where} contient ${count} secrets. Quiconque voit le code peut les utiliser. Traite‑les comme fuités : sors‑les du code et remplace‑les.`;
  }
  return detail
    .replace(/contains /i, 'contient ')
    .replace(/Anyone who can see the code can use/i, 'Quiconque voit le code peut utiliser')
    .replace(/to get into/i, 'pour entrer dans')
    .replace(/the services they unlock/i, 'les services qu’ils ouvrent')
    .replace(/as you/i, 'à ta place')
    .replace(/, and this code is sent to every visitor’s browser/i, ', et ce code est envoyé au navigateur de chaque visiteur')
    .replace(/Treat .+ as leaked: move .+ out of the code and replace .+\./i,
      count === 1
        ? 'Traite‑le comme fuité : sors‑le du code et remplace‑le par une nouvelle valeur.'
        : 'Traite‑les comme fuités : sors‑les du code et remplace‑les par de nouvelles valeurs.');
}

function rewriteFixFr(fix, kind) {
  if (!fix || typeof fix !== 'string') return fix;
  let out = fix
    .replace(/^Security fix:/gim, 'Correction sécurité :')
    .replace(/^Design review of/gim, 'Revue du plan de')
    .replace(/^Cleanup check:/gim, 'Vérification de nettoyage :')
    .replace(/^Refactor plan:/gim, 'Plan de découpage :')
    .replace(/^Open question in the blueprint/gim, 'Question ouverte dans le blueprint')
    .replace(/^These frontend lines use a hard-coded localhost URL:/gim, 'Ces lignes frontend utilisent une URL localhost figée :')
    .replace(/^These lines contain/gim, 'Ces lignes contiennent')
    .replace(/^For each one:/gim, 'Pour chacune :')
    .replace(/^Do not print, echo or repeat any secret value in your replies, commits or logs\./gim,
      'Ne pas afficher, répéter ni journaliser aucune valeur secrète dans tes réponses, commits ou logs.')
    .replace(/Do not print or repeat any value from it\./gim, 'Ne pas afficher ni répéter aucune valeur qui en vient.')
    .replace(/Do not print any keys\./gim, 'Ne pas afficher de clés.')
    .replace(/Do not print, echo or repeat any key value\./gim, 'Ne pas afficher, répéter ni journaliser aucune valeur de clé.')
    .replace(/\bReplace the literal with an environment variable lookup\b/gi, 'Remplace la valeur en dur par une lecture de variable d’environnement')
    .replace(/\bAdd each variable name \(with an empty value, never the real one\) to \.env\.example\b/gi,
      'Ajoute chaque nom de variable (valeur vide, jamais la vraie) à .env.example')
    .replace(/\band make sure \.env is listed in \.gitignore\b/gi, 'et assure‑toi que .env est dans .gitignore')
    .replace(/\bThis is frontend code that ships to the browser\. Move the call that needs the secret to a server-side route or function so the key never reaches visitors\./gi,
      'C’est du code frontend qui part au navigateur. Déplace l’appel qui a besoin du secret vers une route ou fonction côté serveur pour que la clé n’atteigne jamais les visiteurs.')
    .replace(/\bUpdate any deployment config .+ so the variable is set in production\./gi,
      'Met à jour la config de déploiement pour que la variable soit définie en production.')
    .replace(/\bThen give me a short checklist \(without the values\) of which services these keys belong to\b/gi,
      'Puis donne‑moi une courte checklist (sans les valeurs) des services auxquels appartiennent ces clés')
    .replace(/\bBecause the old values are in git history, assume they are compromised\./gi,
      'Comme les anciennes valeurs sont dans l’historique git, considère‑les comme compromises.')
    .replace(/\bFirst tell me in plain words whether this server is reachable from the internet\b/gi,
      'D’abord dis‑moi en mots simples si ce serveur est joignable depuis internet')
    .replace(/\bShow me the plan first\b/gi, 'Montre‑moi le plan d’abord')
    .replace(/\bDon't delete anything until I confirm\b/gi, 'Ne supprime rien tant que je n’ai pas confirmé')
    .replace(/\bDon't change behaviour\b/gi, 'Ne change pas le comportement')
    .replace(/\bDon't change anything else\b/gi, 'Ne change rien d’autre')
    .replace(/\bAsk me if you're unsure\b/gi, 'Demande‑moi si tu n’es pas sûr')
    .replace(/\bAfter I decide\b/gi, 'Après ma décision')
    .replace(/\bAfter I approve\b/gi, 'Après mon accord');
  if (kind === 'secret' && !/^Correction sécurité/m.test(out)) {
    out = 'Correction sécurité : secrets en dur dans le code.\n\n' + out;
  }
  return out;
}

/**
 * Apply built-in or overlay localization to a health object.
 * @param {object} health
 * @param {string} language
 * @param {{ issues?: Record<string, {title?:string,detail?:string,fix?:string,notes?:object}>, checked?: Record<string, {label?:string,text?:string}> }} [overlay]
 */
export function applyHealthLocale(health, language, overlay = null) {
  if (!health || !Array.isArray(health.issues)) return health;
  const lang = normalizeLang(language);
  if (lang === 'en' || !language) {
    // still allow explicit overlay on English maps if present
    if (!overlay?.issues && !overlay?.checked) return health;
  }

  let issues = health.issues.map((issue) => {
    let next = issue;
    if (lang === 'fr') next = localizeIssueFr(issue);
    const o = overlay?.issues?.[issue.id];
    if (o && typeof o === 'object') {
      next = {
        ...next,
        ...(o.title != null ? { title: String(o.title) } : {}),
        ...(o.detail != null ? { detail: String(o.detail) } : {}),
        ...(o.fix != null ? { fix: String(o.fix) } : {}),
        ...(o.notes && typeof o.notes === 'object' ? { notes: { ...(next.notes || {}), ...o.notes } } : {}),
      };
    }
    return next;
  });

  let checked = health.checked;
  if (Array.isArray(checked)) {
    checked = checked.map((c) => {
      let next = lang === 'fr' ? translateCheckedFr(c) : { ...c };
      const o = overlay?.checked?.[c.check];
      if (o && typeof o === 'object') {
        next = {
          ...next,
          ...(o.label != null ? { label: String(o.label) } : {}),
          ...(o.text != null ? { text: String(o.text) } : {}),
        };
      }
      return next;
    });
  }

  return { ...health, issues, ...(checked ? { checked } : {}) };
}

export { normalizeLang };
