// Parse and render talk blocks in content.md / past.md. Plain JavaScript (no Apps Script services).

const TALK_HEADING_RE = /^### (?:~~)?\[/;
const BLOCK_END_RE = /^(### |## |<details|<\/details>|<!-- Don't remove|<!-- SKIP_START)/;
const HEADING_RE = /^\[([^\]]+)\]\s*([^—]*?)\s*(?:—\s*(.*))?$/;
const LINKED_TITLE_RE = /^\[(.+?)\]\(([^)\s]+)\)\s*(.*)$/;
const TRAILING_NOTE_RE = /^(.*?)\s*\(([^()]*)\)\s*$/;
const CLEAR_DIV = '<div style="clear: both;"></div>';
const COLUMNS = ['event', 'speaker', 'affiliation', 'venue', 'date', 'time', 'link'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

// content.md region markers
const UPCOMING_MARKER = '<!-- Upcoming event details go below  -->';
const PIPELINE_END_MARKER = "<!-- Don't remove this line break before Pipeline";
const PIPELINE_HEADING = '## Pipeline';
const SKIP_START = '<!-- SKIP_START -->';

/** Every talk block (### [Kind] Speaker—Title ...) in a markdown file. Line indices are 0-based. */
function parseTalks(text, file) {
  const lines = text.split('\n');
  const talks = [];
  let year = ''; // from period headings like "### September – December, 2026", for dates without a year
  let i = 0;
  while (i < lines.length) {
    if (!TALK_HEADING_RE.test(lines[i])) {
      const y = /^\s*#{2,4} [^\[].*\b(20\d\d)\s*$/.exec(lines[i]);
      if (y) year = y[1];
      i++;
      continue;
    }
    let j = i + 1;
    while (j < lines.length && !BLOCK_END_RE.test(lines[j])) j++;
    const talk = { file: file || '', start: i, end: j, text: lines.slice(i, j).join('\n') };
    Object.assign(talk, parseHeading(lines[i]));
    const span = abstractSpan(talk.text);
    talk.abstract = span ? talk.text.slice(span[0], span[1]).trim() : '';
    talk.row = parseRow(talk.text);
    talk.date = talk.row ? parseSiteDate(talk.row.date, year) : '';
    talks.push(talk);
    i = j;
  }
  return talks;
}

function parseHeading(line) {
  let h = line.slice(4);
  const out = { heading: line, kind: '', speaker: '', title: '', arxiv: '', note: '' };
  out.cancelled = h.includes('~~') || /cancel/i.test(h);
  h = h.replace(/\s*\((?:cancelled|being rescheduled)[^)]*\)\s*$|\s*\[CANCELLED\]\s*$/i, '').replace(/~~/g, '').trim();
  const m = HEADING_RE.exec(h);
  if (!m) return out;
  out.kind = m[1];
  out.speaker = m[2];
  const rest = m[3] || '';
  const lm = LINKED_TITLE_RE.exec(rest);
  if (lm) {
    out.title = lm[1];
    out.arxiv = lm[2];
    out.note = lm[3].trim().replace(/^\(|\)$/g, '');
  } else {
    const nm = TRAILING_NOTE_RE.exec(rest);
    out.title = nm ? nm[1] : rest;
    out.note = nm ? nm[2] : '';
  }
  return out;
}

/** [start, end) character offsets of the abstract inside a block, or null. */
function abstractSpan(text) {
  const bodyStart = text.indexOf('\n') + 1;
  const div = text.indexOf(CLEAR_DIV, bodyStart);
  if (div < 0) return null;
  // The abstract follows the last <img> line / HTML comment before the clear div.
  let pos = bodyStart;
  const re = /<!--[\s\S]*?-->|<img[^>]*>/g;
  const body = text.slice(bodyStart, div);
  let m;
  while ((m = re.exec(body))) pos = bodyStart + m.index + m[0].length;
  return [pos, div];
}

function parseRow(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].startsWith('|-') && lines[i + 1].startsWith('|')) {
      const cells = lines[i + 1].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (cells.length >= COLUMNS.length) {
        const row = {};
        COLUMNS.forEach((c, k) => { row[c] = cells[k]; });
        row.line = i + 1; // line within the block
        return row;
      }
    }
  }
  return null;
}

/**
 * "Wednesday, November 4, 2026" / "Wednesday, 8 July, 2026" / "~~Wed, June 25th~~" -> "2026-11-04".
 * `defaultYear` is used when the cell has none. '' if unparseable.
 */
function parseSiteDate(s, defaultYear) {
  const clean = (s || '').replace(/~/g, '').replace(/(\d)(?:st|nd|rd|th)\b/g, '$1').split(/\s+/).join(' ').trim();
  const m = /^(?:[A-Za-z]+,\s*)?(?:([A-Za-z]+)\.?\s+(\d{1,2})|(\d{1,2})\s+([A-Za-z]+)),?(?:\s+(\d{4}))?$/.exec(clean);
  if (!m || !(m[5] || defaultYear)) return '';
  const month = MONTHS.findIndex(name => name.slice(0, 3).toLowerCase() === (m[1] || m[4]).slice(0, 3).toLowerCase());
  if (month < 0) return '';
  return (m[5] || defaultYear) + '-' + pad2(month + 1) + '-' + pad2(+(m[2] || m[3]));
}

// ------------------------------------------------------------------ dates (IST)

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function istParts(date) {
  const t = new Date(new Date(date).getTime() + IST_OFFSET_MINUTES * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), wd: t.getUTCDay(),
    h: t.getUTCHours(), min: t.getUTCMinutes() };
}

function istDateKey(date) {
  const p = istParts(date);
  return p.y + '-' + pad2(p.m + 1) + '-' + pad2(p.d);
}

function fmtDate(date) {
  const p = istParts(date);
  return WEEKDAYS[p.wd] + ', ' + MONTHS[p.m] + ' ' + p.d + ', ' + p.y;
}

function fmtTime(start, end) {
  const s = istParts(start), e = istParts(end);
  const hm = p => (p.h % 12 || 12) + ':' + pad2(p.min);
  const ap = p => (p.h < 12 ? 'am' : 'pm');
  if (ap(s) === ap(e)) return hm(s) + ' – ' + hm(e) + ap(e);
  return hm(s) + ap(s) + ' – ' + hm(e) + ap(e);
}

/** End of next calendar week (Sunday 23:59:59 IST). Talks up to here belong in Upcoming. */
function weekCeiling(now) {
  const p = istParts(now);
  const daysToSunday = 6 - (p.wd + 6) % 7 + 7;
  return new Date(Date.UTC(p.y, p.m, p.d + daysToSunday, 23, 59, 59) - IST_OFFSET_MINUTES * 60000);
}

function sectionFor(ev, now) {
  return new Date(ev.start) <= weekCeiling(now) ? 'Upcoming' : 'Pipeline';
}

// ------------------------------------------------------------------ matching calendar <-> site

/** Comparison key for names and titles: case-, accent- and punctuation-insensitive. */
function normKey(s) {
  return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** "A<sup>1</sup>, B and C" -> normalised individual names. */
function speakerKeys(s) {
  return (s || '').replace(/<sup>.*?<\/sup>/g, '').split(/,|&|\band\b/).map(normKey).filter(Boolean);
}

function sameSpeaker(a, b) {
  const A = speakerKeys(a), B = speakerKeys(b);
  return A.some(x => B.some(y => x === y || (Math.min(x.length, y.length) > 5 && (x.includes(y) || y.includes(x)))));
}

/**
 * The site talk for a calendar event: {talk, sameDate} or null.
 * Same date + same speaker (or title) wins; otherwise same speaker within 60 days (a reschedule).
 */
function findTalkForEvent(ev, talks) {
  const day = istDateKey(ev.start);
  const title = normKey(ev.title);
  const exact = talks.find(t => t.date === day && (sameSpeaker(t.speaker, ev.speaker) || (title && normKey(t.title) === title)));
  if (exact) return { talk: exact, sameDate: true };
  const near = talks.find(t => sameSpeaker(t.speaker, ev.speaker) &&
    ((title && normKey(t.title) === title) || (t.date && Math.abs(new Date(t.date) - new Date(day)) <= 60 * 864e5)));
  return near ? { talk: near, sameDate: false } : null;
}

// ------------------------------------------------------------------ rendering

function expectedHeading(ev) {
  const title = ev.fields.arXiv ? '[' + ev.title + '](' + ev.fields.arXiv + ')' : ev.title;
  if (ev.cancelled) return '### ~~[' + ev.kind + '] ' + ev.speaker + '—' + title + '~~ [CANCELLED]';
  return '### [' + ev.kind + '] ' + ev.speaker + '—' + title + (ev.note ? ' (' + ev.note + ')' : '');
}

function expectedVenue(ev) {
  if (ev.fields.Venue) return ev.fields.Venue.split(/\s+/).join(' ');
  return /online/i.test(ev.note) ? 'Online-only' : '';
}

function expectedRow(ev, affiliation) {
  return {
    event: ev.kind.replace(/^Quantum\s+/, ''),
    speaker: ev.speaker,
    affiliation: affiliation || ev.fields.Affiliation || '',
    venue: expectedVenue(ev),
    date: fmtDate(ev.start),
    time: fmtTime(ev.start, ev.end),
    link: '[Teams](' + (ev.teamsUrl || DEFAULT_TEAMS_URL) + ')',
  };
}

function renderRow(row) {
  return '| ' + COLUMNS.slice(0, -1).map(c => row[c]).join(' | ') + ' |  ' + row.link + ' | ';
}

/** The markdown block for a calendar event, in the layout content.md already uses. */
function renderBlock(ev, opts) {
  opts = opts || {};
  const photo = opts.photoUrl || ev.fields.Photo;
  const img = photo ? '<img align="left" width="140" alt="image" src="' + photo + '" /> '
    : '<!-- No image: upload a photo in the tool -->';
  return [
    expectedHeading(ev), '', img, '', opts.abstract || ev.abstract, '', CLEAR_DIV, '<br/>', '<br/>', '', '', '',
    '| Event | Speaker | Affiliation | Venue | Date | Time | Link |',
    '|-|-|-|-|-|-|-|',
    renderRow(expectedRow(ev, opts.affiliation)), '', '<br/>',
  ].join('\n');
}

/** content.md with `block` inserted into Upcoming or Pipeline, in date order. */
function insertBlock(text, block, section, dateKey) {
  const lines = text.split('\n');
  const idx = marker => {
    const k = lines.findIndex(l => l.startsWith(marker));
    if (k < 0) throw new Error('content.md is missing the line "' + marker + '"');
    return k;
  };
  const [lo, hi] = section === 'Upcoming' ? [idx(UPCOMING_MARKER), idx(PIPELINE_END_MARKER)]
    : [idx(PIPELINE_HEADING), idx(SKIP_START)];
  const talks = parseTalks(text).filter(t => t.start > lo && t.start < hi);
  const blockLines = block.replace(/\n+$/, '').split('\n');
  const later = talks.find(t => t.date && t.date > dateKey);
  if (later) {
    lines.splice(later.start, 0, ...blockLines, '', '', '');
  } else if (talks.length) {
    const last = talks[talks.length - 1];
    let k = last.end - 1;
    while (k > last.start && !lines[k].trim()) k--;
    lines.splice(k + 1, 0, '', '', '', ...blockLines);
  } else {
    lines.splice(lo + 1, 0, '', ...blockLines, '');
  }
  return lines.join('\n');
}

/** File text with the talk's table link replaced by the YouTube link, or null if there's no link cell. */
function setVideoLink(text, talk, videoId) {
  if (!talk.row) return null;
  const lines = text.split('\n');
  const k = talk.start + talk.row.line;
  const link = '[YouTube](https://youtu.be/' + videoId + ')';
  const re = /\[(?:Teams|YouTube|Recording)\]\([^)]*\)/;
  if (!re.test(lines[k])) return null;
  lines[k] = lines[k].replace(re, link);
  return lines.join('\n');
}
