// Recent work as a timeline: grouped tasks (conversation / releases / commit clusters / uncommitted WIP)
// from floorplan/recent-work.json. Personal maps keep commit SHAs; audience export may strip them.
// Talks through window.Floorplan.
(() => {
  const SC = window.Floorplan;
  const R = SC && SC.graph.recent;
  if (!R || !R.items || !R.items.length) return;
  const { h, hk } = SC;
  const UI = SC.graph.meta?.ui || {};
  const t = (k, fallback) => (typeof UI[k] === 'string' && UI[k]) || fallback;
  const tasks = R.tasks || [];
  const items = R.items.filter((it) => SC.exists(it.id));
  if (!items.length) return;
  const showCommits = R.showCommits !== false;

  SC.icons.recent = '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>';

  const style = document.createElement('style');
  style.textContent = `
    #btn-recent svg.i { color: var(--recent); }
    #btn-recent .badge { background: var(--recent); color: var(--on-recent-text); }
    .rw-when { color: var(--text-3); font-size: 12px; margin-top: 4px; }
    .rw-tl { position: relative; margin: 12px 0 0; padding: 0 0 0 18px; }
    .rw-tl::before { content: ""; position: absolute; left: 5px; top: 4px; bottom: 4px; width: 2px; background: color-mix(in srgb, var(--recent) 35%, rgba(var(--ink), .12)); border-radius: 1px; }
    .rw-ev { position: relative; padding: 0 0 16px 14px; }
    .rw-ev:last-child { padding-bottom: 2px; }
    .rw-ev::before { content: ""; position: absolute; left: -16px; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--recent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--recent) 22%, transparent); }
    .rw-card { padding: 12px 14px; border-radius: 16px; background: color-mix(in srgb, var(--recent) 6%, transparent); }
    .rw-tt { font-weight: 600; line-height: 1.4; color: var(--text); }
    .rw-date { color: var(--text-3); font-size: 11.5px; margin-top: 3px; }
    .rw-q { color: var(--text-3); font-size: 12.5px; line-height: 1.5; margin-top: 6px; }
    .rw-q b { color: var(--text-2); font-weight: 500; }
    .rw-s { color: var(--text-2); font-size: 12.5px; line-height: 1.55; margin-top: 6px; }
    .rw-meta { color: var(--text-3); font-size: 12px; line-height: 1.45; margin-top: 6px; }
    .rw-a { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
    .rw-a .btn { height: 30px; padding: 0 12px; font-size: 12.5px; gap: 6px; }
    .rw-note { margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--recent) 9%, transparent); font-size: 13px; line-height: 1.55; }
    .rw-note .rw-h { color: var(--recent); font-size: 11.5px; font-weight: 600; margin-bottom: 3px; }
    .rw-src { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; color: var(--recent); margin-bottom: 4px; }
    .rw-ev-wip::before { background: color-mix(in srgb, var(--recent) 55%, var(--text-3)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--recent) 12%, transparent); }
    .rw-ev-wip .rw-src { color: color-mix(in srgb, var(--recent) 70%, var(--text-2)); }
  `;
  document.head.appendChild(style);

  const ago = (iso) => {
    const ms = Date.parse(iso); if (!ms) return '';
    const m = Math.round((Date.now() - ms) / 60000);
    return m < 2 ? 'just now' : m < 60 ? `${m} minutes ago` : m < 48 * 60 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`;
  };
  const fmtDay = (iso) => {
    const d = new Date(iso); if (isNaN(d)) return '';
    try { return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso.slice(0, 10); }
  };
  const itemsOf = (ti) => items.filter((it) => ti == null || it.task === ti);
  const shortSha = (c) => String(c || '').slice(0, 7);
  const sourceLabel = (task) => {
    if (task.uncommitted) return t('uncommitted', 'Uncommitted');
    if (task.mode === 'releases') return t('fromReleases', 'From releases');
    if (task.mode === 'commits') return t('fromCommits', 'From commits');
    return t('fromRecent', 'Recent');
  };
  const taskAt = (task) => task.at || R.updatedAt || null;
  const ordered = tasks.map((task, i) => ({ t: task, i })).filter(({ i }) => itemsOf(i).length)
    .sort((a, b) => {
      // Uncommitted WIP floats to the top; then newest first.
      const ua = a.t.uncommitted ? 1 : 0, ub = b.t.uncommitted ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return (Date.parse(taskAt(b.t)) || 0) - (Date.parse(taskAt(a.t)) || 0);
    });

  const metaLine = (task) => {
    const bits = [];
    if (task.uncommitted) bits.push(h(t('uncommittedHint', 'Local changes, not committed yet')));
    if (task.release) bits.push(`${t('release', 'Release')} ${h(task.release)}`);
    if (showCommits && Array.isArray(task.commits) && task.commits.length) {
      bits.push(task.commits.slice(0, 5).map(shortSha).map(h).join(', ') + (task.commits.length > 5 ? '…' : ''));
    }
    return bits.length ? `<div class="rw-meta">${bits.join(' · ')}</div>` : '';
  };

  function showCards(ti) {
    const one = ti != null ? tasks[ti] : tasks.length === 1 ? tasks[0] : null;
    const releaseBit = one?.release ? `\n\n${t('release', 'Release')}: ${one.release}` : '';
    const commitBit = showCommits && one?.commits?.length ? `\n${t('commits', 'Commits')}: ${one.commits.map(shortSha).join(', ')}` : '';
    SC.showBoard({
      kind: t('recentWork', 'Recent work'), icon: 'recent',
      title: one ? one.title : t('recentWork', 'Recent work'),
      question: one ? (one.request ? `${t('youAsked', 'You asked:')} ${one.request}` : (one.release ? `${t('release', 'Release')} ${one.release}` : '')) : tasks.map((x) => x.title).join(' · '),
      answer: (one ? one.summary : tasks.map((x) => `**${x.title}.** ${x.summary}`).join('\n\n')) + releaseBit + commitBit,
      items: itemsOf(ti != null ? ti : null).map((it) => ({ id: it.id, note: it.note || (it.change === 'new' ? t('new', 'New') : t('changed', 'Changed')) })),
    });
  }

  const eventHtml = ({ t: task, i }) => {
    const at = taskAt(task);
    const n = itemsOf(i).length;
    return `<div class="rw-ev${task.uncommitted ? ' rw-ev-wip' : ''}"><div class="rw-card">
      <div class="rw-src">${h(sourceLabel(task))}</div>
      <div class="rw-tt">${h(task.title)}</div>
      ${at && !task.uncommitted ? `<div class="rw-date">${h(fmtDay(at))}${ago(at) ? ` · ${h(ago(at))}` : ''}</div>` : ''}
      ${task.request ? `<div class="rw-q"><b>${h(t('youAsked', 'You asked:'))}</b> ${h(task.request)}</div>` : ''}
      ${task.summary ? `<div class="rw-s">${h(task.summary)}</div>` : ''}
      ${metaLine(task)}
      <div class="rw-a"><button class="btn soft" data-rw="${i}">${SC.iconI('recent')}${h(t('showCards', 'Show'))} ${SC.plural(n, 'card')}</button></div>
    </div></div>`;
  };

  const timelineHtml = () => `<div class="rw-tl">${ordered.map(eventHtml).join('')}</div>`;

  function openTimeline() {
    SC.showPanel(`<div class="sec">
      <div class="ph"><span class="ico" style="--c:var(--recent)">${SC.icon('recent')}</span><span class="kindlabel">${h(t('recentWork', 'Recent work'))}</span></div>
      <h2 class="pt">${h(t('timeline', 'Timeline'))}</h2>
      <p class="pd">${h(t('timelineHint', 'Grouped changes over time. Open a stop to see the cards on the map.'))}</p>
      ${R.updatedAt ? `<div class="rw-when">${h(t('updated', 'Updated'))} ${h(ago(R.updatedAt))}</div>` : ''}
      ${timelineHtml()}
      <div class="actions"><button class="btn soft" data-rw-back>${SC.iconI('left')}${h(t('back', 'Back'))}</button></div>
    </div>`, (panel) => {
      panel.querySelector('[data-rw-back]')?.addEventListener('click', () => SC.closePanel());
      panel.querySelectorAll('[data-rw]').forEach((x) => x.addEventListener('click', () => showCards(+x.dataset.rw)));
    });
  }

  const btn = SC.addHeaderButton({
    id: 'btn-recent',
    label: t('recentWork', 'Recent work'),
    icon: 'recent',
    title: t('timelineHint', 'Grouped changes over time'),
    onClick: () => openTimeline(),
  });
  const b = document.createElement('span');
  b.className = 'badge';
  b.textContent = String(items.length);
  btn.appendChild(b);

  SC.addPanelSection('overview', () => ({
    top: true,
    html: `<div class="sec"><h3>${h(t('recentWork', 'Recent work'))} <span class="c">${items.length}</span></h3>
      ${R.updatedAt ? `<div class="rw-when">${h(t('updated', 'Updated'))} ${h(ago(R.updatedAt))}</div>` : ''}
      ${timelineHtml()}
      <div class="rw-a" style="margin-top:12px"><button class="btn soft" data-rw-all>${SC.iconI('recent')}${h(t('openTimeline', 'Open timeline'))}</button></div>
    </div>`,
    bind: (el) => {
      el.querySelectorAll('[data-rw]').forEach((x) => x.addEventListener('click', () => showCards(+x.dataset.rw)));
      el.querySelector('[data-rw-all]')?.addEventListener('click', openTimeline);
    },
  }));

  SC.addPanelSection('item', (id) => {
    const key = id.startsWith('m:') ? 'f:' + id.slice(2) : id;
    const mine = items.filter((it) => it.id === key);
    const inside = items.filter((it) => it.id !== key && SC.chain(it.id).includes(key));
    if (!mine.length && !inside.length) return '';
    if (!mine.length) return { top: true, html: `<div class="sec"><h3>${h(t('recentWork', 'Recent work'))} <span class="c">${inside.length}</span></h3><div class="list">${inside.map((it) => {
      const i = SC.info(it.id);
      return `<a class="row" data-go="${hk(it.id)}"><span class="dot" style="background:var(--recent)"></span><span class="rt"><div class="rn">${h(i.name)}</div>${it.note ? `<div class="rd">${h(it.note)}</div>` : ''}</span></a>`;
    }).join('')}</div></div>` };
    return { top: true, html: `<div class="sec">${mine.map((it) => {
      const task = tasks[it.task] || {};
      return `<div class="rw-note"><div class="rw-h">${it.change === 'new' ? h(t('new', 'New')) : h(t('changed', 'Changed'))} · ${h(task.title || t('recentWork', 'Recent work'))}</div>${h(it.note || '')}${task.request ? `<div class="rw-q" style="margin:6px 0 0"><b>${h(t('youAsked', 'You asked:'))}</b> ${h(task.request)}</div>` : ''}</div>`;
    }).join('')}</div>` };
  });

  window.FloorplanRecent = { show: showCards, openTimeline, items, tasks };
})();
