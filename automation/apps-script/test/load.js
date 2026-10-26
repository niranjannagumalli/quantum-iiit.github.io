// Load the plain-JavaScript parts of the Apps Script project into Node for testing.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..');
const FILES = ['Config.gs', 'Calendar.gs', 'Site.gs', 'YouTube.gs'];

function load() {
  const ctx = vm.createContext({});
  // Apps Script shares top-level declarations across files; one concatenated script does the same.
  const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
  vm.runInContext(src + '\n;globalThis.__exports = {' + exported(src).join(',') + '};', ctx);
  return ctx.__exports;
}

function exported(src) {
  const names = new Set();
  for (const m of src.matchAll(/^(?:function|const)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  return [...names];
}

/** Minimal .ics -> Calendar API-shaped items, enough to feed eventFromApi. */
function icsToItems(text) {
  text = text.replace(/\r?\n[ \t]/g, '');
  const unescape = v => v.replace(/\\(.)/g, (a, c) => (c === 'n' || c === 'N' ? '\n' : c));
  const dt = v => (/Z$/.test(v)
    ? v.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z')
    : v.replace(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d))?$/, (a, y, mo, d, h = '00', mi = '00', s = '00') => `${y}-${mo}-${d}T${h}:${mi}:${s}+05:30`));
  const items = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT' && cur) {
      items.push({
        id: cur.UID, summary: unescape(cur.SUMMARY || ''), description: unescape(cur.DESCRIPTION || ''),
        status: (cur.STATUS || 'confirmed').toLowerCase(),
        start: { dateTime: dt(cur.DTSTART) }, end: { dateTime: dt(cur.DTEND || cur.DTSTART) },
      });
      cur = null;
    } else if (cur && line.includes(':')) {
      const i = line.indexOf(':');
      cur[line.slice(0, i).split(';')[0]] = line.slice(i + 1);
    }
  }
  return items;
}

module.exports = { load, icsToItems };
