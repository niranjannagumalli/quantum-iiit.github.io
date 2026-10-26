"""Read Quantum Meets events from the public Google Calendar feed (the ground truth)."""

import re
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

ICS_URL = (
    "https://calendar.google.com/calendar/ical/"
    "b02429b4ded9c76a1e5e691621d9da9263d3393d55efba77086f8b688470d589"
    "%40group.calendar.google.com/public/basic.ics"
)
DEFAULT_TEAMS_URL = (
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_MTIwYzA1N2UtZTk4OC00MmUyLTgzNTEtOGVlNjIyMjVkZGY0"
    "%40thread.v2/0?context=%7b%22Tid%22%3a%22031a3bbc-cf7c-4e2b-96ec-867555540a1c%22%2c%22Oid%22%3a"
    "%227a4a124e-e79f-4645-a13d-e0c802a8b77b%22%7d"
)
IST = ZoneInfo("Asia/Kolkata")

# "Label. value" lines in a curated description. Anything else after the title is abstract.
LABELS = {
    "arxiv": "arXiv", "about": "About", "venue": "Venue", "affiliation": "Affiliation",
    "photo": "Photo", "abstract": "Abstract", "bio": "Bio", "reference": "Reference",
    "references": "References", "slides": "Slides", "host": "Host",
}
LABEL_RE = re.compile(r"^(%s)\.\s*:?\s*(.*)$" % "|".join(LABELS), re.I | re.S)
SUMMARY_RE = re.compile(r"^\[(?P<kind>[^\]]+)\]\s*(?P<speaker>.*?)\s*(?:\((?P<note>[^()]*)\))?\s*$")


@dataclass
class Event:
    uid: str
    summary: str
    start: datetime
    end: datetime
    status: str = "CONFIRMED"
    kind: str = ""          # e.g. "Quantum Seminar"
    speaker: str = ""
    note: str = ""          # e.g. "presented online"
    curated: bool = True    # False for raw Cal.com bookings nobody has edited yet
    title: str = ""
    abstract: str = ""
    fields: dict = field(default_factory=dict)  # arXiv / About / Venue / Affiliation / Photo ...
    teams_url: str = ""

    @property
    def cancelled(self):
        return self.status == "CANCELLED" or "cancel" in self.summary.lower()


def fetch(url=ICS_URL):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8")


def _unescape(value):
    return re.sub(r"\\(.)", lambda m: "\n" if m.group(1) in "nN" else m.group(1), value)


def _parse_dt(value, params):
    tzid = next((p[5:] for p in params if p.startswith("TZID=")), None)
    if value.endswith("Z"):
        dt = datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    elif "T" in value:
        dt = datetime.strptime(value, "%Y%m%dT%H%M%S").replace(tzinfo=ZoneInfo(tzid) if tzid else IST)
    else:
        dt = datetime.strptime(value, "%Y%m%d").replace(tzinfo=IST)
    return dt.astimezone(IST)


def unwrap_redirect(url):
    """calendly.com/url?q=... and google.com/url?q=... -> the real target."""
    parts = urllib.parse.urlsplit(url)
    if parts.path == "/url" and parts.netloc.endswith(("calendly.com", "google.com")):
        target = urllib.parse.parse_qs(parts.query).get("q")
        if target:
            return target[0]
    return url


class _TextExtractor(HTMLParser):
    """Google stores descriptions as HTML; flatten to text, keeping link targets."""

    def __init__(self):
        super().__init__()
        self.out, self.links, self._href, self._text = [], [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == "br":
            self.out.append("\n")
        elif tag == "a":
            href = dict(attrs).get("href")
            self._href, self._text = (unwrap_redirect(href) if href else None), []

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            text = "".join(self._text).strip()
            self.links.append((text, self._href))
            # Show the real URL when the link text is just a (shortened) address, e.g. "wdaochen.com".
            looks_like_address = text and " " not in text and "." in text
            self.out.append(self._href if looks_like_address or not text else text)
            self._href = None
        elif tag in ("p", "div", "li"):
            self.out.append("\n")

    def handle_data(self, data):
        (self._text if self._href is not None else self.out).append(data)


def html_to_text(description):
    p = _TextExtractor()
    p.feed(description)
    p.close()
    text = "".join(p.out).replace("\xa0", " ")
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    return text, p.links


def parse_description(event, description):
    text, links = html_to_text(description)
    event.teams_url = next((href for _, href in links if "teams.microsoft.com" in href), "")
    if "Need to reschedule or cancel?" in text or text.lstrip().startswith("What:"):
        event.curated = False
        return

    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if paras and paras[0].lower().startswith("teams link"):
        paras = paras[1:]
    abstract, current = [], None
    for para in paras:
        m = LABEL_RE.match(para)
        if m:
            current = LABELS[m.group(1).lower()]
            event.fields[current] = m.group(2).strip()
        elif not event.title:
            event.title = " ".join(para.split())
        elif current in (None, "Abstract"):
            abstract.append(para)
        else:
            event.fields[current] += "\n\n" + para
    if "Abstract" in event.fields:
        abstract.insert(0, event.fields.pop("Abstract"))
    event.abstract = "\n\n".join(a for a in abstract if a)


def parse_ics(text):
    text = re.sub(r"\r?\n[ \t]", "", text)  # unfold continuation lines
    events, cur = [], None
    for line in text.splitlines():
        if line == "BEGIN:VEVENT":
            cur = {}
        elif line == "END:VEVENT" and cur is not None:
            events.append(_build_event(cur))
            cur = None
        elif cur is not None and ":" in line:
            key, value = line.split(":", 1)
            name, *params = key.split(";")
            cur[name] = (value, params)
    return events


def _build_event(props):
    get = lambda k: _unescape(props.get(k, ("", []))[0])
    ev = Event(
        uid=get("UID"),
        summary=get("SUMMARY").strip(),
        start=_parse_dt(*props["DTSTART"]),
        end=_parse_dt(*props.get("DTEND", props["DTSTART"])),
        status=get("STATUS") or "CONFIRMED",
    )
    m = SUMMARY_RE.match(ev.summary)
    if m:
        ev.kind, ev.speaker, ev.note = m.group("kind"), m.group("speaker"), m.group("note") or ""
    parse_description(ev, get("DESCRIPTION"))
    return ev


def norm_name(name):
    """Comparison key for speaker names: case-, accent- and punctuation-insensitive."""
    name = unicodedata.normalize("NFKD", name)
    return "".join(c for c in name.casefold() if c.isalnum())
