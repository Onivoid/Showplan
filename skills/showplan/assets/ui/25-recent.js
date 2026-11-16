// Recent work: changed map cards laid out as a chronological timeline board (stops = grouped
// tasks / releases / commit clusters / uncommitted WIP). Talks through window.Floorplan.
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
    .rw-stop { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid rgba(var(--ink), .06); }
    .rw-stop:last-child { border-bottom: 0; }
    .rw-dot { flex: none; width: 10px; height: 10px; margin-top: 5px; border-radius: 50%; background: var(--recent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--recent) 22%, transparent); }
    .rw-stop.wip .rw-dot { background: color-mix(in srgb, var(--recent) 55%, var(--text-3)); }
    .rw-tt { font-weight: 600; line-height: 1.35; color: var(--text); }
    .rw-sub { color: var(--text-3); font-size: 12px; margin-top: 2px; }
    .rw-s { color: var(--text-2); font-size: 12.5px; line-height: 1.5; margin-top: 4px; }
    .rw-a { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
    .rw-a .btn { height: 30px; padding: 0 12px; font-size: 12.5px; gap: 6px; }
    .rw-note { margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--recent) 9%, transparent); font-size: 13px; line-height: 1.55; }
    .rw-note .rw-h { color: var(--recent); font-size: 11.5px; font-weight: 600; margin-bottom: 3px; }
    .rw-q { color: var(--text-3); font-size: 12.5px; line-height: 1.5; margin-top: 6px; }
    .rw-q b { color: var(--text-2); font-weight: 500; }
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
  const taskAt = (task) => task.at || R.updatedAt || null;

  const ordered = tasks.map((task, i) => ({ task, i })).filter(({ i }) => itemsOf(i).length)
    .sort((a, b) => {
      const ua = a.task.uncommitted ? 1 : 0, ub = b.task.uncommitted ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return (Date.parse(taskAt(b.task)) || 0) - (Date.parse(taskAt(a.task)) || 0);
    });

  const stopSubtitle = (task) => {
    if (task.uncommitted) return t('uncommittedHint', 'Local changes, not committed yet');
    const bits = [];
    if (task.release) bits.push(`${t('release', 'Release')} ${task.release}`);
    else if (task.mode === 'releases') bits.push(t('fromReleases', 'From releases'));
    else if (task.mode === 'commits') bits.push(t('fromCommits', 'From commits'));
    const at = taskAt(task);
    if (at) bits.push(fmtDay(at) || '');
    if (showCommits && Array.isArray(task.commits) && task.commits.length) {
      bits.push(task.commits.slice(0, 3).map(shortSha).join(', ') + (task.commits.length > 3 ? '…' : ''));
    }
    return bits.filter(Boolean).join(' · ');
  };

  const boardItems = (list) => list.map((it) => ({
    id: it.id,
    note: it.note || (it.change === 'new' ? t('new', 'New') : t('changed', 'Changed'))
      + (it.uncommitted || tasks[it.task]?.uncommitted ? ` · ${t('uncommitted', 'Uncommitted')}` : ''),
  }));

  const stopKind = (task) => {
    if (task.uncommitted) return t('uncommitted', 'Uncommitted');
    if (task.release || task.mode === 'releases') return t('release', 'Release');
    if (task.mode === 'commits') return t('fromCommits', 'From commits');
    return t('fromRecent', 'Recent');
  };
  const stopsFrom = (rows) => rows.map(({ task, i }) => ({
    title: task.title,
    subtitle: stopSubtitle(task),
    kind: stopKind(task),
    uncommitted: !!task.uncommitted,
    ids: itemsOf(i).map((it) => it.id),
  }));

  /** Open the map board with the changed cards arranged as a timeline. */
  function showTimeline(ti) {
    const rows = ti != null ? ordered.filter(({ i }) => i === ti) : ordered;
    if (!rows.length) return;
    const one = ti != null ? tasks[ti] : rows.length === 1 ? rows[0].task : null;
    const list = rows.flatMap(({ i }) => itemsOf(i));
    const releaseBit = one?.release ? `\n\n${t('release', 'Release')}: ${one.release}` : '';
    const commitBit = showCommits && one?.commits?.length ? `\n${t('commits', 'Commits')}: ${one.commits.map(shortSha).join(', ')}` : '';
    SC.showBoard({
      kind: t('recentWork', 'Recent work'),
      icon: 'recent',
      title: one ? one.title : t('recentWork', 'Recent work'),
      question: one
        ? (one.request ? `${t('youAsked', 'You asked:')} ${one.request}` : (one.uncommitted ? t('uncommittedHint', 'Local changes, not committed yet') : ''))
        : t('timelineHint', 'Changed cards laid out over time.'),
      answer: (one ? one.summary : rows.map(({ task }) => `**${task.title}.** ${task.summary || ''}`).join('\n\n')) + releaseBit + commitBit,
      layout: 'timeline',
      stops: stopsFrom(rows),
      items: boardItems(list),
    });
  }

  const stopRow = ({ task, i }) => {
    const n = itemsOf(i).length;
    return `<div class="rw-stop${task.uncommitted ? ' wip' : ''}">
      <span class="rw-dot"></span>
      <div>
        <div class="rw-tt">${h(task.title)}</div>
        <div class="rw-sub">${h(stopSubtitle(task))} · ${SC.plural(n, 'card')}</div>
        ${task.summary ? `<div class="rw-s">${h(task.summary)}</div>` : ''}
        <div class="rw-a"><button class="btn soft" data-rw="${i}">${SC.iconI('recent')}${h(t('showCards', 'Show'))}</button></div>
      </div>
    </div>`;
  };

  const btn = SC.addHeaderButton({
    id: 'btn-recent',
    label: t('recentWork', 'Recent work'),
    icon: 'recent',
    title: t('timelineHint', 'Changed cards laid out over time'),
    onClick: () => showTimeline(),
  });
  const b = document.createElement('span');
  b.className = 'badge';
  b.textContent = String(items.length);
  btn.appendChild(b);

  SC.addPanelSection('overview', () => ({
    top: true,
    html: `<div class="sec"><h3>${h(t('recentWork', 'Recent work'))} <span class="c">${items.length}</span></h3>
      ${R.updatedAt ? `<div class="rw-when">${h(t('updated', 'Updated'))} ${h(ago(R.updatedAt))}</div>` : ''}
      <p class="pd" style="margin-top:8px">${h(t('timelineHint', 'Changed cards laid out over time.'))}</p>
      ${ordered.map(stopRow).join('')}
      <div class="rw-a" style="margin-top:12px"><button class="btn soft" data-rw-all>${SC.iconI('recent')}${h(t('openTimeline', 'Open timeline'))}</button></div>
    </div>`,
    bind: (el) => {
      el.querySelectorAll('[data-rw]').forEach((x) => x.addEventListener('click', () => showTimeline(+x.dataset.rw)));
      el.querySelector('[data-rw-all]')?.addEventListener('click', () => showTimeline());
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
      const tag = it.uncommitted || task.uncommitted
        ? h(t('uncommitted', 'Uncommitted'))
        : (it.change === 'new' ? h(t('new', 'New')) : h(t('changed', 'Changed')));
      return `<div class="rw-note"><div class="rw-h">${tag} · ${h(task.title || t('recentWork', 'Recent work'))}</div>${h(it.note || '')}${task.request ? `<div class="rw-q" style="margin:6px 0 0"><b>${h(t('youAsked', 'You asked:'))}</b> ${h(task.request)}</div>` : ''}<div class="rw-a"><button class="btn soft" data-rw-one="${it.task}">${SC.iconI('recent')}${h(t('openTimeline', 'Open timeline'))}</button></div></div>`;
    }).join('')}</div>`, bind: (el) => {
      el.querySelectorAll('[data-rw-one]').forEach((x) => x.addEventListener('click', () => showTimeline(+x.dataset.rwOne)));
    } };
  });

  window.FloorplanRecent = { show: showTimeline, openTimeline: () => showTimeline(), items, tasks };
})();
