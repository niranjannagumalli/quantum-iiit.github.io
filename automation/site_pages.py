"""Parse and render talk blocks in content.md / past.md."""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta

from calendar_feed import DEFAULT_TEAMS_URL, Event

TALK_HEADING_RE = re.compile(r"^### (?:~~)?\[")
BLOCK_END_RE = re.compile(r"^(### |## |<details|</details>|<!-- Don't remove|<!-- SKIP_START)")
HEADING_RE = re.compile(r"^\[(?P<kind>[^\]]+)\]\s*(?P<speaker>[^—]*?)\s*(?:—\s*(?P<rest>.*))?$")
LINKED_TITLE_RE = re.compile(r"^\[(?P<title>.+?)\]\((?P<url>[^)\s]+)\)\s*(?P<note>.*)$")
TRAILING_NOTE_RE = re.compile(r"^(?P<title>.*?)\s*\((?P<note>[^()]*)\)\s*$")
CLEAR_DIV = '<div style="clear: both;"></div>'
COLUMNS = ("event", "speaker", "affiliation", "venue", "date", "time", "link")
DATE_FORMATS = ("%A, %B %d, %Y", "%A, %d %B, %Y", "%A, %B %d %Y", "%A, %d %B %Y")

# content.md region markers
UPCOMING_MARKER = "<!-- Upcoming event details go below  -->"
PIPELINE_END_MARKER = "<!-- Don't remove this line break before Pipeline"
PIPELINE_HEADING = "## Pipeline"
SKIP_START = "<!-- SKIP_START -->"


@dataclass
class Talk:
    file: str
    start: int  # line index of the heading
    end: int    # exclusive
    text: str
    kind: str = ""
    speaker: str = ""
    title: str = ""
    arxiv: str = ""
    note: str = ""
    cancelled: bool = False
    abstract: str = ""
    row: dict = None
    date: object = None

    @property
    def heading(self):
        return self.text.split("\n", 1)[0]


def parse_date(s):
    s = " ".join(s.split())
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _parse_heading(talk):
    h = talk.heading[4:]
    talk.cancelled = "~~" in h or "cancel" in h.lower()
    h = re.sub(r"\s*\((?:cancelled|being rescheduled)[^)]*\)\s*$|\s*\[CANCELLED\]\s*$", "", h, flags=re.I)
    h = h.replace("~~", "").strip()
    m = HEADING_RE.match(h)
    if not m:
        return
    talk.kind, talk.speaker, rest = m.group("kind"), m.group("speaker"), m.group("rest") or ""
    lm = LINKED_TITLE_RE.match(rest)
    if lm:
        talk.title, talk.arxiv = lm.group("title"), lm.group("url")
        talk.note = lm.group("note").strip().strip("()")
    else:
        nm = TRAILING_NOTE_RE.match(rest)
        talk.title, talk.note = (nm.group("title"), nm.group("note")) if nm else (rest, "")


def _abstract_span(text):
    """(start, end) character offsets of the abstract inside a block, or None."""
    body_start = text.find("\n") + 1
    div = text.find(CLEAR_DIV, body_start)
    if div < 0:
        return None
    # The abstract follows the last <img> line / HTML comment before the clear div.
    pos = body_start
    for m in re.finditer(r"<!--.*?-->|<img[^>]*>", text[body_start:div], re.S):
        pos = body_start + m.end()
    return pos, div


def _parse_row(text):
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if line.startswith("|-") and i + 1 < len(lines) and lines[i + 1].startswith("|"):
            cells = [c.strip() for c in lines[i + 1].strip().strip("|").split("|")]
            if len(cells) >= len(COLUMNS):
                return dict(zip(COLUMNS, cells))
    return None


def parse_talks(path):
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")
    talks, i = [], 0
    while i < len(lines):
        if not TALK_HEADING_RE.match(lines[i]):
            i += 1
            continue
        j = i + 1
        while j < len(lines) and not BLOCK_END_RE.match(lines[j]):
            j += 1
        talk = Talk(file=path, start=i, end=j, text="\n".join(lines[i:j]))
        _parse_heading(talk)
        span = _abstract_span(talk.text)
        if span:
            talk.abstract = talk.text[span[0]:span[1]].strip()
        talk.row = _parse_row(talk.text)
        if talk.row:
            talk.date = parse_date(talk.row["date"])
        talks.append(talk)
        i = j
    return talks


# ---------------------------------------------------------------- rendering

def fmt_date(d):
    return f"{d:%A}, {d:%B} {d.day}, {d.year}"


def fmt_time(start, end):
    hm = lambda d: f"{d.hour % 12 or 12}:{d.minute:02d}"
    ap = lambda d: "am" if d.hour < 12 else "pm"
    if ap(start) == ap(end):
        return f"{hm(start)} – {hm(end)}{ap(end)}"
    return f"{hm(start)}{ap(start)} – {hm(end)}{ap(end)}"


def expected_heading(ev: Event):
    title = f"[{ev.title}]({ev.fields['arXiv']})" if ev.fields.get("arXiv") else ev.title
    note = f" ({ev.note})" if ev.note else ""
    if ev.cancelled:
        return f"### ~~[{ev.kind}] {ev.speaker}—{title}~~ [CANCELLED]"
    return f"### [{ev.kind}] {ev.speaker}—{title}{note}"


def expected_venue(ev: Event):
    if ev.fields.get("Venue"):
        return " ".join(ev.fields["Venue"].split())
    return "Online-only" if "online" in ev.note.lower() else ""


def expected_row(ev: Event, existing: dict = None):
    """Table row the calendar implies. Affiliation falls back to what the site already has."""
    existing = existing or {}
    return {
        "event": re.sub(r"^Quantum\s+", "", ev.kind),
        "speaker": ev.speaker,
        "affiliation": ev.fields.get("Affiliation") or existing.get("affiliation", ""),
        "venue": expected_venue(ev),
        "date": fmt_date(ev.start),
        "time": fmt_time(ev.start, ev.end),
        "link": f"[Teams]({ev.teams_url or DEFAULT_TEAMS_URL})",
    }


def render_row(row):
    return "| " + " | ".join(row[c] for c in COLUMNS[:-1]) + f" |  {row['link']} | "


def render_block(ev: Event, row: dict):
    photo = ev.fields.get("Photo")
    img = (f'<img align="left" width="140" alt="image" src="{photo}" /> ' if photo
           else "<!-- No image: add Photo. to the calendar event -->")
    return "\n".join([
        expected_heading(ev), "", img, "", ev.abstract, "", CLEAR_DIV, "<br/>", "<br/>", "", "", "",
        "| Event | Speaker | Affiliation | Venue | Date | Time | Link |",
        "|-|-|-|-|-|-|-|",
        render_row(row), "", "<br/>",
    ])


def patch_block(talk: Talk, ev: Event, row: dict):
    """Update heading, abstract and table row in place; keep images, comments and anything else."""
    text = talk.text
    span = _abstract_span(text)
    if span:
        text = text[:span[0]] + "\n\n" + ev.abstract + "\n\n" + text[span[1]:]
    lines = text.split("\n")
    lines[0] = expected_heading(ev)
    for i, line in enumerate(lines):
        if line.startswith("|-") and i + 1 < len(lines) and lines[i + 1].startswith("|"):
            lines[i + 1] = render_row(row)
            break
    return "\n".join(lines)


def week_ceiling(now):
    """End of next calendar week (Sunday 23:59:59 IST). Talks up to here belong in Upcoming."""
    sunday = now + timedelta(days=6 - now.weekday() + 7)
    return sunday.replace(hour=23, minute=59, second=59, microsecond=0)
