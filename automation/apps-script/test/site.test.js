// Run with: node --test automation/apps-script/test/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, icsToItems } = require('./load');

const g = load();
const plain = x => JSON.parse(JSON.stringify(x)); // arrays from the vm context aren't deepEqual to local ones
const REPO = path.join(__dirname, '..', '..', '..');
const CONTENT = fs.readFileSync(path.join(REPO, 'content.md'), 'utf8');
const PAST = fs.readFileSync(path.join(REPO, 'past.md'), 'utf8');

const CURATED = String.raw`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20261104T053000Z
DTEND:20261104T070000Z
UID:abc@Cal.com
DESCRIPTION:<a href="https://teams.microsoft.com/l/meetup-join/x">Teams link
 </a> | <a href="https://quantum-meets.github.io/">https://quantum-meets.gith
 ub.io/</a><br><br><b>Rational degree</b><br>  <br>We prove things\, nicely 
 &amp; x &lt; y.<br><br><b>arXiv.</b> <a href="https://calendly.com/url?q=htt
 ps%3A%2F%2Farxiv.org%2Fabs%2F2601.08727&user_uuid=1">https://arxiv.org/abs/2
 601.08727</a><br><br><b>About.</b> <a href="http://wdaochen.com">wdaochen.c
 om</a><br><br><b>Venue.</b> Meeting Room\, CQST
STATUS:CONFIRMED
SUMMARY:[Quantum Seminar] Daochen Wang (presented online)
END:VEVENT
BEGIN:VEVENT
DTSTART:20261111T053000Z
DTEND:20261111T070000Z
UID:raw@Cal.com
DESCRIPTION:What:\n[Quantum Event] Yiming Wang\n\nNeed to reschedule or cancel? https://cal.com/x
SUMMARY:[Quantum Event] Yiming Wang
END:VEVENT
END:VCALENDAR
`;

const event = (overrides) => Object.assign(g.eventFromApi({
  id: 'x', summary: '[Quantum Seminar] Test Speaker (presented online)',
  description: '<b>A title</b><br><br>An abstract.<br><br><b>Venue.</b> Online',
  start: { dateTime: '2026-11-18T11:00:00+05:30' }, end: { dateTime: '2026-11-18T12:30:00+05:30' },
}), overrides || {});

test('calendar description is parsed', () => {
  const [ev, raw] = icsToItems(CURATED).map(g.eventFromApi);
  assert.equal(ev.kind, 'Quantum Seminar');
  assert.equal(ev.speaker, 'Daochen Wang');
  assert.equal(ev.note, 'presented online');
  assert.equal(ev.title, 'Rational degree');
  assert.equal(ev.abstract, 'We prove things, nicely & x < y.');
  assert.equal(ev.fields.arXiv, 'https://arxiv.org/abs/2601.08727');
  assert.equal(ev.fields.About, 'http://wdaochen.com');
  assert.equal(ev.fields.Venue, 'Meeting Room, CQST');
  assert.equal(ev.teamsUrl, 'https://teams.microsoft.com/l/meetup-join/x');
  assert.equal(raw.curated, false);
});

test('"Abstract." label and multi-paragraph abstracts', () => {
  const ev = g.parseDescription('<b>T</b><br><br><b>Abstract. </b>One.<br><br>Two.<br><br><b>About.</b> x.org');
  assert.equal(ev.title, 'T');
  assert.equal(ev.abstract, 'One.\n\nTwo.');
  assert.equal(ev.fields.About, 'x.org');
});

test('site dates in all the formats past.md uses', () => {
  assert.equal(g.parseSiteDate('Wednesday, November 4, 2026'), '2026-11-04');
  assert.equal(g.parseSiteDate('Wednesday, 8 July, 2026'), '2026-07-08');
  assert.equal(g.parseSiteDate('~~Monday, March 30, 2026~~'), '2026-03-30');
  assert.equal(g.parseSiteDate('Wed, June 25th, 2025'), '2025-06-25');
  assert.equal(g.parseSiteDate('Friday, 6 February', '2026'), '2026-02-06');
  assert.equal(g.parseSiteDate('Friday, 6 February'), '');
});

test('every talk with a table row on the site has a date', () => {
  const talks = g.parseTalks(CONTENT, 'content.md').concat(g.parseTalks(PAST, 'past.md'));
  assert.deepEqual(plain(talks.filter(t => t.row && !t.date).map(t => t.heading)), []);
});

test('Upcoming horizon is the end of next week (IST)', () => {
  const ceiling = '2026-11-08T18:29:59.000Z'; // Sunday Nov 8, 23:59:59 IST
  assert.equal(g.weekCeiling(new Date('2026-10-26T10:00:00+05:30')).toISOString(), ceiling);
  assert.equal(g.weekCeiling(new Date('2026-11-01T23:00:00+05:30')).toISOString(), ceiling);
  assert.equal(g.weekCeiling(new Date('2026-11-02T00:30:00+05:30')).toISOString(), '2026-11-15T18:29:59.000Z');
});

test('table date and time are formatted like the site', () => {
  assert.equal(g.fmtDate('2026-11-04T05:30:00Z'), 'Wednesday, November 4, 2026');
  assert.equal(g.fmtTime('2026-11-04T05:30:00Z', '2026-11-04T07:00:00Z'), '11:00am – 12:30pm');
  assert.equal(g.fmtTime('2026-10-30T10:30:00Z', '2026-10-30T12:00:00Z'), '4:00 – 5:30pm');
});

test('calendar events are matched to talks already on the site', () => {
  const talks = g.parseTalks(CONTENT, 'content.md').concat(g.parseTalks(PAST, 'past.md'));
  const daochen = icsToItems(CURATED).map(g.eventFromApi)[0];
  const m = g.findTalkForEvent(daochen, talks);
  assert.ok(m && m.sameDate && m.talk.file === 'content.md');
  // Joint calendar event vs. single-speaker block on the same day.
  const joint = event({ speaker: 'Anindita Bera and Sudipto Singha Roy', start: '2026-10-30T10:30:00Z', title: 'x' });
  assert.ok(g.findTalkForEvent(joint, talks).sameDate);
  assert.equal(g.findTalkForEvent(event(), talks), null);
});

test('a new talk is inserted into the right section in date order', () => {
  const ev = event();
  const out = g.insertBlock(CONTENT, g.renderBlock(ev, { affiliation: 'Somewhere' }), 'Pipeline', '2026-11-18');
  const talks = g.parseTalks(out);
  const pipeline = talks.filter(t => t.start > out.split('\n').indexOf('## Pipeline'));
  assert.deepEqual(plain(pipeline.map(t => t.date)), ['2026-11-11', '2026-11-18', '2026-11-25']);
  const added = pipeline[1];
  assert.equal(added.title, 'A title');
  assert.equal(added.row.affiliation, 'Somewhere');
  assert.equal(added.row.venue, 'Online');
  // Nothing else changed.
  assert.equal(out.replace(added.text + '\n', ''), CONTENT);
});

test('removing and re-adding a talk restores content.md', () => {
  const talks = g.parseTalks(CONTENT);
  for (const t of talks) {
    const lines = CONTENT.split('\n');
    const block = lines.slice(t.start, t.end).join('\n');
    const section = t.start < lines.findIndex(l => l.startsWith(g.PIPELINE_END_MARKER)) ? 'Upcoming' : 'Pipeline';
    const without = lines.slice(0, t.start).concat(lines.slice(t.end)).join('\n');
    const back = g.parseTalks(g.insertBlock(without, block, section, t.date)).map(x => x.heading);
    assert.deepEqual(plain(back), plain(talks.map(x => x.heading)), t.heading);
  }
});

test('inserting into an empty section', () => {
  const lines = CONTENT.split('\n');
  const lo = lines.findIndex(l => l.startsWith(g.UPCOMING_MARKER));
  const hi = lines.findIndex(l => l.startsWith(g.PIPELINE_END_MARKER));
  const empty = lines.slice(0, lo + 1).concat(['', '', '', ''], lines.slice(hi)).join('\n');
  const out = g.insertBlock(empty, g.renderBlock(event()), 'Upcoming', '2026-11-18');
  const t = g.parseTalks(out)[0];
  assert.equal(t.title, 'A title');
  assert.ok(out.indexOf(g.UPCOMING_MARKER) < out.indexOf(t.heading));
  assert.ok(out.indexOf(t.heading) < out.indexOf(g.PIPELINE_END_MARKER));
});

test('YouTube link replaces the Teams link in the talk row only', () => {
  const talk = g.parseTalks(PAST, 'past.md').find(t => t.row && t.row.link.startsWith('[Teams]'));
  const out = g.setVideoLink(PAST, talk, 'abcdefghijk');
  const after = g.parseTalks(out, 'past.md').find(t => t.start === talk.start);
  assert.equal(after.row.link, '[YouTube](https://youtu.be/abcdefghijk)');
  assert.equal(out.split('\n').length, PAST.split('\n').length);
  assert.equal(out.split('\n').filter((l, i) => l !== PAST.split('\n')[i]).length, 1);
});

test('YouTube title and description follow the channel layout', () => {
  const talk = g.parseTalks(PAST, 'past.md').find(t => t.speaker === 'Avantika Agarwal');
  const meta = {
    kind: talk.kind, speaker: talk.speaker, title: g.markdownToPlain(talk.title), abstract: g.markdownToPlain(talk.abstract),
    arxiv: 'https://arxiv.org/abs/2605.09138', about: 'https://sites.google.com/view/avantikaagarwal/',
  };
  assert.equal(g.buildVideoTitle(meta), '[Quantum Seminar] Avantika Agarwal | Quantum Capacity of the Depolarizing Channel');
  const desc = g.buildVideoDescription(meta);
  assert.ok(desc.startsWith('*Quantum Capacity of the Depolarizing Channel*\n\n*Abstract.* The quantum capacity captures'));
  assert.ok(desc.endsWith('\n\n*arXiv.* https://arxiv.org/abs/2605.09138\n\n*About.* https://sites.google.com/view/avantikaagarwal/\n\n*Host.* IIIT Hyderabad'));
  assert.equal(g.buildVideoDescription(Object.assign({}, meta, { arxiv: '', about: '' })).includes('arXiv'), false);
});

test('long titles get shorter options within 100 characters', () => {
  const meta = { kind: 'Quantum Seminar', speaker: 'Myeongjin Shin, Junseo Lee',
    title: 'Hamiltonian learning: a very long subtitle that keeps going and going well beyond what YouTube accepts' };
  assert.ok(g.buildVideoTitle(meta).length > 100);
  const options = g.shortTitleOptions(meta);
  assert.ok(options.length >= 1);
  options.forEach(o => assert.ok(o.length <= 100, o));
  assert.ok(options.includes('[Quantum Seminar] Myeongjin Shin, Junseo Lee | Hamiltonian learning'));
});

test('video ids and YouTube-safe text', () => {
  for (const s of ['https://youtu.be/TUyJ2jtpDOA', 'https://www.youtube.com/watch?v=TUyJ2jtpDOA&t=3',
    'https://youtube.com/live/TUyJ2jtpDOA?si=x', 'TUyJ2jtpDOA', 'https://studio.youtube.com/video/TUyJ2jtpDOA/edit']) {
    assert.equal(g.parseVideoId(s), 'TUyJ2jtpDOA', s);
  }
  assert.equal(g.parseVideoId('not a link'), null);
  assert.equal(g.youtubeSafe('a < b > c'), 'a ＜ b ＞ c');
  assert.equal(g.markdownToPlain('See [paper](https://x.org) <br/> and <sup>1</sup>'), 'See paper (https://x.org)\n and 1');
});
