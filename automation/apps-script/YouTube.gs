// Tool 2: YouTube metadata. Fills in the title/description of an (unlisted) talk recording
// from the website, previews it, saves it, and optionally makes it public / links it from past.md.

const YT_TITLE_MAX = 100;
const YT_DESCRIPTION_MAX = 5000;

/** Speakers on the website, newest first, for the speaker field's suggestions. */
function listSpeakers() {
  const talks = siteTalks_().filter(t => t.speaker);
  const seen = {};
  return talks.sort((a, b) => (b.date > a.date ? 1 : -1))
    .map(t => t.speaker.replace(/<sup>.*?<\/sup>/g, ''))
    .filter(s => !seen[normKey(s)] && (seen[normKey(s)] = true));
}

/** Current video metadata, the talk it belongs to and the proposed title/description. */
function prepareVideo(url, speaker, talkKey) {
  const videoId = parseVideoId(url);
  if (!videoId) throw new Error('Not a YouTube link: ' + url);
  const video = getVideo_(videoId);

  const talks = siteTalks_().filter(t => sameSpeaker(t.speaker, speaker))
    .sort((a, b) => (b.date > a.date ? 1 : -1));
  if (!talks.length) throw new Error('No talk by "' + speaker + '" in past.md or content.md on ' + BASE_BRANCH + '.');
  const today = istDateKey(new Date());
  const talk = talks.find(t => talkKeyOf_(t) === talkKey) || talks.find(t => t.date && t.date <= today) || talks[0];

  const cal = calendarDetails_(talk);
  const meta = {
    kind: talk.kind,
    speaker: talk.speaker.replace(/<sup>.*?<\/sup>/g, ''),
    title: markdownToPlain(talk.title),
    abstract: markdownToPlain(talk.abstract),
    arxiv: talk.arxiv || cal.arXiv || '',
    about: cal.About || '',
  };
  const sources = {
    title: talk.file, abstract: talk.file,
    arxiv: talk.arxiv ? talk.file : (cal.arXiv ? 'Google Calendar' : ''),
    about: cal.About ? 'Google Calendar' : '',
  };
  const title = youtubeSafe(buildVideoTitle(meta));
  const description = youtubeSafe(buildVideoDescription(meta));

  const warnings = [];
  if (title.length > YT_TITLE_MAX) warnings.push('Title is ' + title.length + ' characters; YouTube allows ' + YT_TITLE_MAX + '. Pick a shorter one.');
  if (!meta.arxiv) warnings.push('No arXiv / paper link found on the website or in the calendar — the line is left out.');
  if (!meta.about) warnings.push('No "About." link found in the calendar event — the line is left out.');
  if (/[<>]/.test(buildVideoDescription(meta) + buildVideoTitle(meta))) warnings.push('YouTube does not allow < or >; they were replaced with ＜ ＞.');
  if (cal.error) warnings.push('Could not read the calendar: ' + cal.error);
  const linkCell = talk.row ? talk.row.link : '';
  return {
    videoId: videoId,
    current: video,
    proposed: { title: title, description: description },
    titleOptions: title.length > YT_TITLE_MAX ? shortTitleOptions(meta).map(youtubeSafe) : [],
    talk: {
      key: talkKeyOf_(talk), file: talk.file, date: talk.date, heading: talk.heading,
      linkCell: linkCell, hasThisVideo: linkCell.indexOf(videoId) >= 0,
    },
    otherTalks: talks.map(t => ({ key: talkKeyOf_(t), label: (t.date || '?') + ' — ' + markdownToPlain(t.title) + ' (' + t.file + ')' })),
    sources: sources,
    warnings: warnings,
  };
}

/** Write the title/description (no tags). Privacy is left as it is. */
function saveVideoMetadata(videoId, title, description) {
  title = (title || '').trim();
  if (!title) throw new Error('Title is empty.');
  if (title.length > YT_TITLE_MAX) throw new Error('Title is ' + title.length + ' characters; the limit is ' + YT_TITLE_MAX + '.');
  if (/[<>]/.test(title + description)) throw new Error('YouTube does not allow < or > in the title or description.');
  if (Utilities.newBlob(description).getBytes().length > YT_DESCRIPTION_MAX) {
    throw new Error('Description is longer than YouTube\'s ' + YT_DESCRIPTION_MAX + ' bytes.');
  }
  const current = YouTube.Videos.list('snippet', { id: videoId }).items[0];
  const snippet = { title: title, description: description, categoryId: current.snippet.categoryId || '27', tags: [] };
  ['defaultLanguage', 'defaultAudioLanguage'].forEach(k => { if (current.snippet[k]) snippet[k] = current.snippet[k]; });
  YouTube.Videos.update({ id: videoId, snippet: snippet }, 'snippet');
  return getVideo_(videoId);
}

/** Switch between unlisted and public, keeping the other status settings. */
function setVideoPrivacy(videoId, privacy) {
  if (privacy !== 'public' && privacy !== 'unlisted') throw new Error('Unsupported privacy: ' + privacy);
  const current = YouTube.Videos.list('status', { id: videoId }).items[0].status;
  const status = { privacyStatus: privacy };
  ['embeddable', 'license', 'publicStatsViewable', 'selfDeclaredMadeForKids', 'containsSyntheticMedia']
    .forEach(k => { if (current[k] !== undefined) status[k] = current[k]; });
  YouTube.Videos.update({ id: videoId, status: status }, 'status');
  return getVideo_(videoId);
}

/** PR replacing the talk's [Teams](...) link with [YouTube](https://youtu.be/ID). */
function createVideoLinkPr(videoId, talkKey) {
  const head = gh_('get', '/repos/' + UPSTREAM_REPO + '/commits/' + BASE_BRANCH).sha;
  const file = talkKey.split(':')[0];
  const text = readSiteFile(file, head);
  const talk = parseTalks(text, file).find(t => talkKeyOf_(t) === talkKey);
  if (!talk) throw new Error('The talk is no longer in ' + file + ' on ' + BASE_BRANCH + '. Fetch again.');
  const updated = setVideoLink(text, talk, videoId);
  if (!updated) throw new Error('Could not find a [Teams](...) link in the talk\'s table row in ' + file + '.');
  return openPullRequest_({
    baseSha: head,
    branchPrefix: YOUTUBE_PR_PREFIX,
    files: (function () { const f = {}; f[file] = updated; return f; })(),
    commitMessage: 'Link the recording of ' + talk.speaker + "'s talk",
    title: 'YouTube link for ' + talk.speaker + ' (' + talk.date + ')',
    body: 'Replaces the Teams link of **' + talk.heading.slice(4) + '** in `' + file + '` with https://youtu.be/' + videoId +
      '.\n\nOpened by the Quantum Meets YouTube metadata tool.',
  });
}

// ------------------------------------------------------------------ helpers (Apps Script)

function getVideo_(videoId) {
  const res = YouTube.Videos.list('snippet,status', { id: videoId });
  if (!res.items || !res.items.length) {
    throw new Error('Video ' + videoId + ' not found. It has to be on a channel this Google account manages.');
  }
  const v = res.items[0];
  const thumbs = v.snippet.thumbnails || {};
  return {
    id: videoId,
    title: v.snippet.title,
    description: v.snippet.description,
    tags: v.snippet.tags || [],
    channelTitle: v.snippet.channelTitle,
    privacy: v.status.privacyStatus,
    thumbnail: (thumbs.maxres || thumbs.high || thumbs.medium || thumbs.default || {}).url || '',
  };
}

function siteTalks_() {
  return parseTalks(readSiteFile('past.md'), 'past.md').concat(parseTalks(readSiteFile('content.md'), 'content.md'));
}

function talkKeyOf_(talk) {
  return talk.file + ':' + talk.date + ':' + normKey(talk.speaker);
}

/** About / arXiv from the calendar event on the talk's date (the website has no About link). */
function calendarDetails_(talk) {
  if (!talk.date) return {};
  try {
    const day = new Date(talk.date + 'T00:00:00+05:30');
    const events = fetchCalendarEvents(day, new Date(day.getTime() + 864e5));
    const ev = events.find(e => sameSpeaker(e.speaker, talk.speaker));
    return ev ? ev.fields : {};
  } catch (e) {
    return { error: e.message };
  }
}

// ------------------------------------------------------------------ pure helpers

function parseVideoId(s) {
  s = (s || '').trim();
  const m = /(?:youtu\.be\/|[?&]v=|\/(?:live|shorts|embed|video)\/)([A-Za-z0-9_-]{11})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
}

/** Website markdown/HTML -> plain text for YouTube. Links become "text (url)". */
function markdownToPlain(md) {
  return (md || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text, url) => (text === url ? url : text + ' (' + url + ')'))
    .split('\n').map(l => l.replace(/\s+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** YouTube rejects < and > in titles and descriptions. */
function youtubeSafe(s) {
  return s.replace(/</g, '＜').replace(/>/g, '＞');
}

/** "[Quantum Seminar] Speaker | Talk title" */
function buildVideoTitle(meta) {
  return '[' + meta.kind + '] ' + meta.speaker + ' | ' + meta.title;
}

/** Same layout as the videos already on the channel (*x* renders bold on YouTube). */
function buildVideoDescription(meta) {
  const parts = ['*' + meta.title + '*', '*Abstract.* ' + meta.abstract];
  if (meta.arxiv) parts.push('*arXiv.* ' + meta.arxiv);
  if (meta.about) parts.push('*About.* ' + meta.about);
  parts.push('*Host.* ' + HOST);
  return parts.join('\n\n');
}

/** Up to three titles within 100 characters, for when the full one is too long. */
function shortTitleOptions(meta) {
  const prefix = '[' + meta.kind + '] ' + meta.speaker + ' | ';
  const options = [];
  const main = meta.title.split(/:\s| — | - /)[0].trim();
  if (main !== meta.title) options.push(prefix + main);
  options.push('[' + meta.kind.replace(/^Quantum\s+/, '') + '] ' + meta.speaker + ' | ' + meta.title);
  const room = YT_TITLE_MAX - prefix.length - 1;
  if (room > 10) {
    let cut = meta.title.slice(0, room);
    cut = cut.slice(0, cut.lastIndexOf(' ') > room / 2 ? cut.lastIndexOf(' ') : room).replace(/[\s,;:.-]+$/, '');
    options.push(prefix + cut + '…');
  }
  return options.filter((t, i) => t.length <= YT_TITLE_MAX && options.indexOf(t) === i).slice(0, 3);
}
