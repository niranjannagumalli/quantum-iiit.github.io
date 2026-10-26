// Read Quantum Meets events from the Google Calendar (the ground truth).
// Everything below fetchCalendarEvents is plain JavaScript so it can be tested outside Apps Script.

// "Label. value" paragraphs in a curated description. Anything else after the title is abstract.
const CAL_LABELS = {
  arxiv: 'arXiv', about: 'About', venue: 'Venue', affiliation: 'Affiliation', photo: 'Photo',
  abstract: 'Abstract', bio: 'Bio', reference: 'Reference', references: 'References',
  slides: 'Slides', host: 'Host',
};
const CAL_LABEL_RE = new RegExp('^(' + Object.keys(CAL_LABELS).join('|') + ')\\.\\s*:?\\s*([\\s\\S]*)$', 'i');
const CAL_SUMMARY_RE = /^\[([^\]]+)\]\s*(.*?)\s*(?:\(([^()]*)\))?\s*$/;

/** Events overlapping [timeMin, timeMax), oldest first. `q` is an optional free-text filter. */
function fetchCalendarEvents(timeMin, timeMax, q) {
  const items = [];
  let pageToken;
  do {
    const opts = { singleEvents: true, orderBy: 'startTime', maxResults: 250, timeMin: timeMin.toISOString() };
    if (pageToken) opts.pageToken = pageToken;
    if (timeMax) opts.timeMax = timeMax.toISOString();
    if (q) opts.q = q;
    const res = Calendar.Events.list(CALENDAR_ID, opts);
    items.push(...(res.items || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return items.map(eventFromApi);
}

/** Calendar API event resource -> plain, serialisable event object. */
function eventFromApi(item) {
  const ev = {
    id: item.id,
    htmlLink: item.htmlLink || '',
    summary: (item.summary || '').trim(),
    start: new Date(item.start.dateTime || item.start.date).toISOString(),
    end: new Date((item.end || item.start).dateTime || (item.end || item.start).date).toISOString(),
    status: (item.status || 'confirmed').toLowerCase(),
  };
  Object.assign(ev, parseSummary(ev.summary), parseDescription(item.description || ''));
  ev.cancelled = ev.status === 'cancelled' || /cancel/i.test(ev.summary);
  return ev;
}

/** "[Quantum Seminar] Daochen Wang (presented online)" -> kind, speaker, note. */
function parseSummary(summary) {
  const m = CAL_SUMMARY_RE.exec(summary);
  if (!m) return { kind: '', speaker: summary, note: '' };
  return { kind: m[1].trim(), speaker: m[2].trim(), note: (m[3] || '').trim() };
}

/** Curated description HTML -> title, abstract, labelled fields and the Teams link. */
function parseDescription(html) {
  const { text, links } = htmlToText(html);
  const out = { curated: true, title: '', abstract: '', fields: {}, teamsUrl: '' };
  const teams = links.find(l => l.href.includes('teams.microsoft.com'));
  out.teamsUrl = teams ? teams.href : '';
  if (text.includes('Need to reschedule or cancel?') || /^\s*What:/.test(text)) {
    out.curated = false; // raw Cal.com booking nobody has edited yet
    return out;
  }
  let paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paras.length && paras[0].toLowerCase().startsWith('teams link')) paras = paras.slice(1);
  const abstract = [];
  let current = null;
  for (const para of paras) {
    const m = CAL_LABEL_RE.exec(para);
    if (m) {
      current = CAL_LABELS[m[1].toLowerCase()];
      out.fields[current] = m[2].trim();
    } else if (!out.title) {
      out.title = para.split(/\s+/).join(' ');
    } else if (current === null || current === 'Abstract') {
      abstract.push(para);
    } else {
      out.fields[current] += '\n\n' + para;
    }
  }
  if ('Abstract' in out.fields) {
    abstract.unshift(out.fields.Abstract);
    delete out.fields.Abstract;
  }
  out.abstract = abstract.filter(Boolean).join('\n\n');
  return out;
}

/** Google stores descriptions as HTML; flatten to text, keeping link targets. */
function htmlToText(html) {
  const out = [], links = [];
  let href = null, linkText = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|(<)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined || m[5] !== undefined) {
      (href !== null ? linkText : out).push(decodeEntities(m[4] !== undefined ? m[4] : m[5]));
      continue;
    }
    const closing = m[1] === '/', tag = m[2].toLowerCase();
    if (!closing && tag === 'br') {
      out.push('\n');
    } else if (!closing && tag === 'a') {
      const h = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[3]);
      href = h ? unwrapRedirect(decodeEntities(h[1] !== undefined ? h[1] : h[2])) : null;
      linkText = [];
    } else if (closing && tag === 'a' && href !== null) {
      const t = linkText.join('').trim();
      links.push({ text: t, href });
      // Show the real URL when the link text is just a (shortened) address, e.g. "wdaochen.com".
      const looksLikeAddress = t && !t.includes(' ') && t.includes('.');
      out.push(looksLikeAddress || !t ? href : t);
      href = null;
    } else if (closing && (tag === 'p' || tag === 'div' || tag === 'li')) {
      out.push('\n');
    }
  }
  const text = out.join('').replace(/ /g, ' ').split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
  return { text, links };
}

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return named[e.toLowerCase()] !== undefined ? named[e.toLowerCase()] : all;
  });
}

/** calendly.com/url?q=... and google.com/url?q=... -> the real target. */
function unwrapRedirect(url) {
  const m = /^https?:\/\/([^/?#]+)\/url\?([^#]*)/.exec(url);
  if (m && /(^|\.)(calendly|google)\.com$/.test(m[1])) {
    const q = m[2].split('&').find(p => p.startsWith('q='));
    if (q) return decodeURIComponent(q.slice(2).replace(/\+/g, ' '));
  }
  return url;
}
