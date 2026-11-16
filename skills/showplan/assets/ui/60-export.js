// Export: a copy of the map to share as one HTML file. Supports audience categories (Public / Team /
// Serverless / custom). Full Public/Team wording sanitize is done by the Showplan skill
// (export.mjs + export-sanitize.json); this UI can still download a structural audience copy when
// the server has sanitize helpers, or show a ready prompt for the agent. Talks through window.Floorplan.
(() => {
  const SC = window.Floorplan;
  if (!SC || SC.exported) return;
  const S = window.FLOORPLAN_SERVER;
  if (!S && location.protocol !== 'file:') return;
  const { h } = SC;
  const G = SC.graph;
  const PLAN = !!G.meta.blueprint;
  const CMD = 'node floorplan/serve.mjs --export';
  const SKILL_EXPORT = 'Ask Showplan to export this map for <audience> in <language>';

  const AUDIENCES = [
    { id: 'serverless', label: 'Serverless / Local', hint: 'Almost the full personal map. Trusted / local share.', on: true },
    { id: 'team', label: 'Team', hint: 'Simplified for teammates: less low-level detail, no health check by default.' },
    { id: 'public', label: 'Public', hint: 'Most sanitized: high-level only. Best via the Showplan skill (rewrites names for the audience).' },
    { id: 'custom', label: 'Custom…', hint: 'Describe who will read it; the agent adapts the sanitize to that description.' },
  ];

  const style = document.createElement('style');
  style.textContent = `
.xp-opts { display: flex; flex-direction: column; gap: 2px; margin: 14px 0 4px; }
.xp-opt { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; cursor: pointer; }
.xp-opt:hover { background: rgba(var(--ink), .05); }
.xp-opt input { margin: 3px 0 0; width: 16px; height: 16px; accent-color: var(--accent); flex: none; cursor: pointer; }
.xp-opt b { display: block; font-weight: 500; color: var(--text); }
.xp-opt span { display: block; font-size: 12.5px; color: var(--text-3); line-height: 1.5; }
.xp-opt.warn span { color: var(--warn-text); }
.xp-note { font-size: 12.5px; color: var(--text-3); line-height: 1.55; margin-top: 10px; }
.xp-err { font-size: 12.5px; color: var(--warn-text); background: var(--warn-bg); border-radius: 10px; padding: 8px 12px; margin-top: 10px; }
.xp-row { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.xp-row label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--text-3); flex: 1; min-width: 140px; }
.xp-row input, .xp-row select, .xp-row textarea { border: 1px solid rgba(var(--ink), .12); background: var(--panel); color: var(--text); border-radius: 10px; padding: 8px 10px; font: inherit; }
.xp-row textarea { min-height: 64px; resize: vertical; }
`;
  document.head.appendChild(style);
  SC.icons.export = '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>';

  const PARTS = [
    { id: 'flows', label: 'Flows and the tour', hint: 'The guided walkthroughs, including ones you requested.', on: true, has: G.flows.length > 0 || (G.tour || []).length > 0 },
    { id: 'notes', label: 'Notes pinned to files', hint: 'The notes shown on file cards.', on: true, has: G.files.some((f) => f.note) },
    { id: 'recent', label: 'Recent work', hint: 'What was just changed, and why (sanitized for the audience when exporting via the skill).', on: false, has: !!G.recent?.items?.length },
    PLAN
      ? { id: 'health', label: 'Design review', hint: 'The decisions the plan still leaves open.', on: false, has: !!G.health?.issues?.length }
      : { id: 'health', label: 'Health check', hint: 'Lists the endpoints anyone can use and where secrets sit in the code (never their values). Only include it for people you trust.', on: false, warn: true, has: !!G.health?.issues?.length },
  ].filter((p) => p.has);

  const promptFor = (audience, language, custom) => {
    const who = audience === 'custom' ? (custom || 'describe the audience') : audience;
    const lang = language || G.meta?.language || 'the user\'s language';
    return `Export this Showplan for audience "${who}" in ${lang}. Clarify the goal if needed, run the sanitize pass (export.mjs --prepare → fill export-sanitize.json → export.mjs), and include a sanitized Recent work when relevant.`;
  };

  async function download(el, close) {
    const err = el.querySelector('.xp-err');
    const include = [...el.querySelectorAll('[data-xp]')].filter((c) => c.checked).map((c) => c.dataset.xp);
    const audience = el.querySelector('[data-audience]:checked')?.value || 'serverless';
    const language = el.querySelector('[data-lang]')?.value?.trim() || undefined;
    const audienceDescription = audience === 'custom' ? el.querySelector('[data-custom]')?.value?.trim() : undefined;
    const flows = G.flows.filter((f) => f.custom).map((f) => ({ id: f.id, title: f.title, description: f.description, steps: f.steps }));

    if (audience === 'public' || audience === 'custom') {
      const prompt = promptFor(audience, language, audienceDescription);
      err.hidden = true;
      SC.modal({
        title: 'Export via Showplan',
        html: `<p>Public and custom exports need an AI sanitize pass so names match the audience and language.</p>
          <p class="xp-note">Paste this in your Showplan chat (or ask in your own words):</p>
          <pre>${h(prompt)}</pre>
          <p class="xp-note">Or run structural-only from the project folder after a rebuild:<br><code>node floorplan/serve.mjs --export --audience ${h(audience === 'custom' ? 'team' : audience)}${language ? ` --language ${h(language)}` : ''}</code></p>`,
        actions: [
          { label: 'Copy prompt', primary: true, icon: 'copy', onClick: () => { SC.copy(prompt).then((ok) => { if (ok) SC.toast('Copied'); }); } },
          {
            label: 'Download structural copy', keepOpen: true, onClick: async (c2) => {
              try {
                const body = { include, flows, audience: audience === 'custom' ? 'team' : audience, language, audienceDescription };
                const r = await fetch('/api/export', { method: 'POST', headers: { 'content-type': 'application/json', 'x-floorplan-token': S.token }, body: JSON.stringify(body) });
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Export failed');
                const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || 'showplan-map.html';
                const a = document.createElement('a');
                a.href = URL.createObjectURL(await r.blob());
                a.download = name;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 30000);
                c2(); close();
                SC.toast(`Downloaded ${name}`);
              } catch (e) {
                err.hidden = false;
                err.textContent = e.message === 'Failed to fetch' ? 'Couldn’t reach the map’s server.' : e.message;
              }
            },
          },
        ],
      });
      return;
    }

    try {
      const body = { include, flows, audience, language, audienceDescription };
      const r = await fetch('/api/export', { method: 'POST', headers: { 'content-type': 'application/json', 'x-floorplan-token': S.token }, body: JSON.stringify(body) });
      if (r.status === 403) throw new Error('The map’s server has restarted since this page opened. Reload the page and try again.');
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'The map’s server couldn’t export it.');
      const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || 'floorplan-map.html';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await r.blob());
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      close();
      SC.toast(`Downloaded ${name}`);
    } catch (e) {
      err.hidden = false;
      err.textContent = e.message === 'Failed to fetch' ? 'Couldn’t reach the map’s server. Ask to open the showplan again, then try again.' : e.message;
    }
  }

  function openExport() {
    if (!S) {
      SC.modal({
        title: 'Export a copy',
        html: `<p>Exporting needs the map’s server. Ask to “export the showplan”, or run this in the project folder:</p><pre>${h(CMD)}</pre>
          <p class="xp-note">Audience exports: <code>node &lt;skill&gt;/scripts/export.mjs . --audience public --language fr</code></p>`,
        actions: [{ label: 'Copy command', primary: true, icon: 'copy', onClick: () => { SC.copy(CMD).then((ok) => { if (ok) SC.toast('Copied'); }); } }],
      });
      return;
    }
    const langDefault = G.meta?.language || '';
    const m = SC.modal({
      title: 'Export a copy',
      html: `<p>One HTML file to send to anyone. Pick who it’s for — that controls how much detail is kept.</p>
        <div class="xp-opts">${AUDIENCES.map((a) => `<label class="xp-opt"><input type="radio" name="xp-aud" data-audience value="${a.id}"${a.on ? ' checked' : ''}><div><b>${h(a.label)}</b><span>${h(a.hint)}</span></div></label>`).join('')}</div>
        <div class="xp-row">
          <label>Language<input data-lang type="text" placeholder="fr, en, es…" value="${h(langDefault)}"></label>
        </div>
        <label class="xp-row" style="display:block;margin-top:8px"><span style="font-size:12.5px;color:var(--text-3)">Custom audience (when Custom is selected)</span>
          <textarea data-custom placeholder="e.g. Non-technical executives reviewing a sales deck"></textarea>
        </label>
        ${PARTS.length ? `<div class="xp-opts">${PARTS.map((p) => `<label class="xp-opt${p.warn ? ' warn' : ''}"><input type="checkbox" data-xp="${p.id}"${p.on ? ' checked' : ''}><div><b>${h(p.label)}</b><span>${h(p.hint)}</span></div></label>`).join('')}</div>` : ''}
        <p class="xp-note">Public / custom: prefer asking Showplan in chat so names are rewritten for the audience. Serverless matches the classic shareable export.</p>
        <div class="xp-err" hidden></div>`,
      actions: [{ label: 'Download', primary: true, icon: 'export', keepOpen: true, onClick: (close) => { download(m.el, close); } }],
    });
  }

  SC.addHeaderButton({ id: 'btn-export', label: 'Export', icon: 'export', title: 'Export a copy of this map to share', onClick: openExport });
})();
