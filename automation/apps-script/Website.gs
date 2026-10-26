// Tool 1: Calendar -> website. Server functions called from the "Calendar → Website" tab.

/** Repository status, upcoming calendar events and whether each one is already on the website. */
function loadWebsiteState() {
  const log = [];
  const now = new Date();
  const repo = githubContext_();
  log.push('Upstream ' + siteRepo() + ' ' + BASE_BRANCH + ' is at ' + repo.head.sha.slice(0, 7) + ' ("' + repo.head.message + '")');

  const content = readSiteFile('content.md', repo.head.sha);
  const past = readSiteFile('past.md', repo.head.sha);
  const talks = parseTalks(content, 'content.md').concat(parseTalks(past, 'past.md'));
  log.push('Read content.md and past.md: ' + talks.length + ' talks on the website');

  const events = fetchCalendarEvents(now, new Date(now.getTime() + 365 * 864e5));
  log.push('Read ' + events.length + ' upcoming event(s) from the Google Calendar');

  const rows = events.map(ev => describeEvent_(ev, talks, now));
  const missing = rows.filter(r => r.status === 'missing').length;
  log.push(missing ? missing + ' event(s) are not on the website yet' : 'Every curated upcoming event is already on the website');
  return { now: now.toISOString(), ceiling: weekCeiling(now).toISOString(), repo: repo, events: rows, log: log };
}

function describeEvent_(ev, talks, now) {
  const row = { ev: ev, date: fmtDate(ev.start) + ', ' + fmtTime(ev.start, ev.end), section: sectionFor(ev, now) };
  if (!ev.curated) return Object.assign(row, { status: 'raw', detail: 'Raw booking — curate it in the calendar first' });
  const match = findTalkForEvent(ev, talks);
  if (match && match.sameDate) {
    return Object.assign(row, { status: 'listed', detail: 'On the website (' + match.talk.file + ' line ' + (match.talk.start + 1) + ')' });
  }
  if (match) {
    return Object.assign(row, { status: 'moved',
      detail: 'Website has this speaker on ' + (match.talk.date || '?') + ' (' + match.talk.file + ' line ' +
        (match.talk.start + 1) + ') — rescheduled? Fix by hand.' });
  }
  if (ev.cancelled) return Object.assign(row, { status: 'cancelled', detail: 'Cancelled — not added' });

  // A returning speaker: offer their previous affiliation and photo.
  const previous = talks.filter(t => sameSpeaker(t.speaker, ev.speaker)).sort((a, b) => (b.date > a.date ? 1 : -1))[0];
  row.affiliation = ev.fields.Affiliation || (previous && previous.row ? previous.row.affiliation : '');
  row.photoUrl = ev.fields.Photo || (previous ? previousPhoto_(previous) : '');
  row.markdown = renderBlock(ev, { affiliation: row.affiliation, photoUrl: row.photoUrl });
  const warnings = [];
  if (!ev.title) warnings.push('No title found in the calendar description');
  if (!ev.abstract) warnings.push('No abstract found in the calendar description');
  if (!expectedVenue(ev)) warnings.push('No venue in the calendar ("Venue." line)');
  return Object.assign(row, { status: 'missing', detail: 'Not on the website', warnings: warnings });
}

function previousPhoto_(talk) {
  const m = /<img[^>]*src="([^"]+)"/.exec(talk.text.replace(/<!--[\s\S]*?-->/g, ''));
  return m && m[1] !== PLACEHOLDER_PHOTO ? m[1] : '';
}

/** Markdown for one event with the maintainer's affiliation / photo. */
function previewBlock(ev, opts) {
  return renderBlock(ev, opts);
}

/**
 * Insert the reviewed blocks into content.md and open a PR.
 * items: [{ev, markdown, section}] where markdown is the (possibly hand-edited) block.
 */
function createWebsitePr(items, baseSha) {
  if (!items || !items.length) throw new Error('Nothing selected.');
  const log = [];
  let content = readSiteFile('content.md', baseSha);
  const past = readSiteFile('past.md', baseSha);
  const talks = parseTalks(content, 'content.md').concat(parseTalks(past, 'past.md'));

  items.slice().sort((a, b) => (a.ev.start < b.ev.start ? -1 : 1)).forEach(item => {
    const match = findTalkForEvent(item.ev, talks);
    if (match && match.sameDate) throw new Error(item.ev.summary + ' is already on the website (' + match.talk.file + ').');
    content = insertBlock(content, item.markdown, item.section, istDateKey(item.ev.start));
    log.push('Added ' + item.ev.summary + ' to ## ' + item.section);
  });

  const speakers = items.map(i => i.ev.speaker);
  const pr = openPullRequest_({
    baseSha: baseSha,
    branchPrefix: WEBSITE_PR_PREFIX,
    files: { 'content.md': content },
    commitMessage: 'Add ' + speakers.join(', ') + ' from the calendar',
    title: 'Add ' + speakers.join(', ') + ' from the Google Calendar',
    body: 'Added from the Quantum Meets Google Calendar by the calendar → website tool.\n\n' +
      items.map(i => '- **' + i.ev.summary + '** — ' + fmtDate(i.ev.start) + ', ' + fmtTime(i.ev.start, i.ev.end) +
        ' → `## ' + i.section + '`').join('\n'),
  });
  pr.log = log.concat(pr.log);
  return pr;
}
