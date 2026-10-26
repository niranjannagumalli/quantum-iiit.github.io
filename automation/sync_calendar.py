#!/usr/bin/env python3
"""Check that every Google Calendar event is on the website, and correct.

    python3 automation/sync_calendar.py            # report only
    python3 automation/sync_calendar.py --fix      # also rewrite Upcoming/Pipeline in content.md

The calendar is the ground truth. --fix only touches content.md (future talks);
problems with past talks are reported for a human to fix.
"""

import argparse
import difflib
import os
import re
import sys
from datetime import date, datetime

from calendar_feed import ICS_URL, IST, fetch, norm_name, parse_ics
from site_pages import (
    PIPELINE_END_MARKER, PIPELINE_HEADING, SKIP_START, UPCOMING_MARKER,
    expected_heading, expected_row, patch_block, parse_talks, render_block, week_ceiling,
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def squash(s):
    """Whitespace-, tag- and dash-insensitive form for comparing text."""
    s = re.sub(r"<[^>]+>", "", s or "")
    s = s.replace("–", "-").replace("—", "-")
    return " ".join(s.split())


def match_events(events, talks):
    """Pair calendar events with site talks: same speaker, same date first, then nearest date."""
    pairs, used = {}, set()
    by_speaker = {}
    for t in talks:
        by_speaker.setdefault(norm_name(t.speaker), []).append(t)
    for exact in (True, False):
        for ev in events:
            if ev.uid in pairs:
                continue
            cands = [t for t in by_speaker.get(norm_name(ev.speaker), []) if id(t) not in used]
            if exact:
                cands = [t for t in cands if t.date == ev.start.date()]
            if cands:
                best = min(cands, key=lambda t: abs((t.date or date.min) - ev.start.date()).days
                           if t.date else 10**6)
                pairs[ev.uid] = best
                used.add(id(best))
    return pairs


def field_diffs(ev, talk, future):
    exp_row = expected_row(ev, talk.row)
    row = talk.row or {}
    checks = [
        ("type", talk.kind, ev.kind),
        ("speaker", talk.speaker, ev.speaker),
        ("title", talk.title, ev.title),
        ("arXiv", talk.arxiv, ev.fields.get("arXiv", "")),
        ("mode note", talk.note, ev.note),
        ("abstract", talk.abstract, ev.abstract),
        ("cancelled", str(talk.cancelled), str(ev.cancelled)),
        ("table: event", row.get("event"), exp_row["event"]),
        ("table: venue", row.get("venue"), exp_row["venue"]),
        ("table: date", talk.date and str(talk.date), str(ev.start.date())),
        ("table: time", row.get("time"), exp_row["time"]),
    ]
    if ev.fields.get("Affiliation"):
        checks.append(("table: affiliation", row.get("affiliation"), exp_row["affiliation"]))
    if future:
        checks.append(("table: link", row.get("link"), exp_row["link"]))
    return [(name, site, cal) for name, site, cal in checks if squash(site) != squash(cal)]


def section_of(talk, content_lines):
    """'Upcoming', 'Pipeline' or 'other' for a talk in content.md."""
    idx = lambda marker: next(i for i, l in enumerate(content_lines) if l.startswith(marker))
    if idx(UPCOMING_MARKER) < talk.start < idx(PIPELINE_END_MARKER):
        return "Upcoming"
    if idx(PIPELINE_HEADING) < talk.start < idx(SKIP_START):
        return "Pipeline"
    return "other"


def excerpts(a, b, n=90):
    """Short excerpts of a and b around the first point where they differ."""
    a, b = squash(a), squash(b)
    i = next((k for k, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
    start = max(0, i - n // 3)
    cut = lambda s: ("…" if start else "") + s[start:start + n] + ("…" if len(s) > start + n else "")
    return cut(a), cut(b)


def where(talk):
    return f"{os.path.basename(talk.file)}:{talk.start + 1}"


def rebuild_content(path, content_talks, pairs_by_talk, future_events, now):
    """New content.md text with Upcoming/Pipeline regenerated from the calendar."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    lines = text.split("\n")
    regions = {"Upcoming": [], "Pipeline": []}
    matched_uids = set()
    for t in content_talks:
        sec = section_of(t, lines)
        ev = pairs_by_talk.get(id(t))
        if ev and ev in future_events:
            matched_uids.add(ev.uid)
            sec = "Upcoming" if ev.start <= week_ceiling(now) else "Pipeline"
            regions[sec].append((ev.start.date(), patch_block(t, ev, expected_row(ev, t.row))))
        elif sec in regions:  # not ours to change (no calendar event, or already finished)
            regions[sec].append((t.date or date.min, t.text))
    for ev in future_events:
        if ev.uid not in matched_uids:
            sec = "Upcoming" if ev.start <= week_ceiling(now) else "Pipeline"
            regions[sec].append((ev.start.date(), render_block(ev, expected_row(ev))))

    def region(blocks):
        if not blocks:
            return "\n\n\n\n\n"
        blocks = [b.strip("\n") for _, b in sorted(blocks, key=lambda b: b[0])]
        return "\n\n" + "\n\n\n".join(blocks) + "\n\n\n\n"

    idx = lambda marker: next(i for i, l in enumerate(lines) if l.startswith(marker))
    a, b, c, d = idx(UPCOMING_MARKER), idx(PIPELINE_END_MARKER), idx(PIPELINE_HEADING), idx(SKIP_START)
    return ("\n".join(lines[: a + 1]) + "\n" + region(regions["Upcoming"])
            + "\n".join(lines[b: c + 1]) + "\n" + region(regions["Pipeline"])
            + "\n".join(lines[d:]))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fix", action="store_true", help="rewrite Upcoming/Pipeline in content.md")
    ap.add_argument("--since", default="2026-01-01",
                    help="ignore events before this date (YYYY-MM-DD, default %(default)s)")
    ap.add_argument("--past-details", action="store_true",
                    help="also list field differences for finished talks (default: only whether they are listed)")
    ap.add_argument("--ics", help="read a downloaded .ics file instead of fetching the calendar")
    ap.add_argument("--site", default=REPO, help=argparse.SUPPRESS)  # folder with content.md/past.md
    ap.add_argument("--now", help=argparse.SUPPRESS)  # e.g. 2026-10-18T12:00, for testing
    args = ap.parse_args()

    now = datetime.fromisoformat(args.now).replace(tzinfo=IST) if args.now else datetime.now(IST)
    since = date.fromisoformat(args.since)
    ics = open(args.ics, encoding="utf-8").read() if args.ics else fetch(ICS_URL)
    events = sorted((e for e in parse_ics(ics) if e.start.date() >= since), key=lambda e: e.start)

    content_path, past_path = os.path.join(args.site, "content.md"), os.path.join(args.site, "past.md")
    content_talks, past_talks = parse_talks(content_path), parse_talks(past_path)
    content_lines = open(content_path, encoding="utf-8").read().split("\n")
    talks = content_talks + past_talks
    curated = [e for e in events if e.curated]
    pairs = match_events(events, talks)  # raw bookings too, so their site entries aren't orphans

    issues = 0

    def report(title, items):
        nonlocal issues
        if items:
            issues += len(items)
            print(f"\n## {title} ({len(items)})")
            for item in items:
                print(item)

    pending = [f"- {e.start:%a %d %b %Y} {e.summary}"
               + (f"  (on the website at {where(pairs[e.uid])}, left as is)" if e.uid in pairs else "")
               for e in events if not e.curated]
    print(f"Checked {len(events)} calendar events since {since} against content.md + past.md "
          f"(now: {now:%a %d %b %Y %H:%M} IST, Upcoming horizon: {week_ceiling(now):%a %d %b}).")
    report("Raw Cal.com bookings — curate these in the calendar first", pending)

    missing, misplaced, mismatched = [], [], []
    for ev in curated:
        future = ev.end > now
        talk = pairs.get(ev.uid)
        label = f"{ev.start:%a %d %b %Y} {ev.summary}"
        if not talk:
            missing.append(f"- {label}" + ("" if future else "  (finished — belongs in past.md)"))
            continue
        in_content = talk.file == content_path
        if future:
            want = "Upcoming" if ev.start <= week_ceiling(now) else "Pipeline"
            got = section_of(talk, content_lines) if in_content else "past.md"
            if got != want:
                misplaced.append(f"- {label}: in {got}, should be in {want}  [{where(talk)}]")
        elif in_content:
            misplaced.append(f"- {label}: finished, still in content.md — move to past.md  [{where(talk)}]")
        diffs = field_diffs(ev, talk, future) if future or args.past_details else []
        if diffs:
            lines = [f"- {label}  [{where(talk)}]"]
            for name, site, cal in diffs:
                site, cal = excerpts(site, cal)
                lines.append(f"    {name}:\n      site:     {site}\n      calendar: {cal}")
            mismatched.append("\n".join(lines))

    report("Missing from the website", missing)
    report("In the wrong place", misplaced)
    report("Different from the calendar", mismatched)

    matched = {id(t) for t in pairs.values()}
    orphans = [f"- {t.date} {t.heading[4:90]}  [{where(t)}]" for t in talks
               if id(t) not in matched and t.date and t.date >= since]
    report("On the website but not in the calendar", orphans)

    if args.fix:
        future_events = [e for e in curated if e.end > now]
        by_uid = {e.uid: e for e in events}
        talk_to_event = {id(t): by_uid[uid] for uid, t in pairs.items()}
        old = open(content_path, encoding="utf-8").read()
        new = rebuild_content(content_path, content_talks, talk_to_event, future_events, now)
        if new == old:
            print("\n--fix: content.md already matches the calendar.")
        else:
            sys.stdout.writelines(difflib.unified_diff(
                old.splitlines(True), new.splitlines(True), "content.md", "content.md (fixed)"))
            with open(content_path, "w", encoding="utf-8") as f:
                f.write(new)
            print("\n--fix: wrote content.md. Review with `git diff` before committing.")

    if not issues:
        print("\nAll good: the website matches the calendar.")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
