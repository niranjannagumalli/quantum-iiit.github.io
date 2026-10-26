"""Run with: python3 -m unittest discover automation"""

import os
import sys
import tempfile
import unittest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from calendar_feed import IST, parse_ics
from site_pages import expected_row, fmt_time, parse_talks, week_ceiling
from sync_calendar import field_diffs, match_events, rebuild_content

CURATED = r"""BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20261104T053000Z
DTEND:20261104T070000Z
UID:abc@Cal.com
DESCRIPTION:<a href="https://teams.microsoft.com/l/meetup-join/x">Teams link
 </a> | <a href="https://quantum-meets.github.io/">https://quantum-meets.gith
 ub.io/</a><br><br><b>Rational degree</b><br>  <br>We prove things\, nicely.
 <br><br><b>arXiv.</b> <a href="https://calendly.com/url?q=https%3A%2F%2Farxi
 v.org%2Fabs%2F2601.08727&user_uuid=1">https://arxiv.org/abs/2601.08727</a><b
 r><br><b>About.</b> <a href="http://wdaochen.com">wdaochen.com</a><br><br><
 b>Affiliation.</b> UBC\, Canada<br><br><b>Venue.</b> Meeting Room\, CQST
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
"""

CONTENT = """# Quantum Meets

## Upcoming
<!-- Upcoming event details go below  -->





<!-- Don't remove this line break before Pipeline; messes up the email formatting in the weekly announcement emails -->
<br/>

## Pipeline





<!-- SKIP_START -->

## Past
"""


class CalendarParsing(unittest.TestCase):
    def setUp(self):
        self.ev, self.raw = parse_ics(CURATED)

    def test_curated_fields(self):
        ev = self.ev
        self.assertEqual((ev.kind, ev.speaker, ev.note), ("Quantum Seminar", "Daochen Wang", "presented online"))
        self.assertEqual(ev.title, "Rational degree")
        self.assertEqual(ev.abstract, "We prove things, nicely.")
        self.assertEqual(ev.fields["arXiv"], "https://arxiv.org/abs/2601.08727")  # redirect unwrapped
        self.assertEqual(ev.fields["About"], "http://wdaochen.com")
        self.assertEqual(ev.fields["Affiliation"], "UBC, Canada")
        self.assertEqual(ev.teams_url, "https://teams.microsoft.com/l/meetup-join/x")
        self.assertEqual(ev.start.tzinfo, IST)
        self.assertEqual(ev.start.hour, 11)

    def test_raw_booking_not_curated(self):
        self.assertTrue(self.ev.curated)
        self.assertFalse(self.raw.curated)


class Formatting(unittest.TestCase):
    def test_time(self):
        d = lambda h, m: datetime(2026, 1, 1, h, m, tzinfo=IST)
        self.assertEqual(fmt_time(d(11, 0), d(12, 30)), "11:00am – 12:30pm")
        self.assertEqual(fmt_time(d(20, 30), d(22, 0)), "8:30 – 10:00pm")

    def test_week_ceiling(self):
        friday = datetime(2026, 10, 16, 18, 0, tzinfo=IST)
        sunday = datetime(2026, 10, 18, 12, 0, tzinfo=IST)
        self.assertEqual(week_ceiling(friday).date().isoformat(), "2026-10-25")
        self.assertEqual(week_ceiling(sunday).date().isoformat(), "2026-10-25")


class Fix(unittest.TestCase):
    def test_add_then_idempotent(self):
        ev = parse_ics(CURATED)[0]
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "content.md")
            with open(path, "w") as f:
                f.write(CONTENT)
            now = datetime(2026, 11, 1, 12, 0, tzinfo=IST)  # Sunday before the talk -> Upcoming
            new = rebuild_content(path, [], {}, [ev], now)
            self.assertLess(new.index("### [Quantum Seminar] Daochen Wang"), new.index("## Pipeline"))
            with open(path, "w") as f:
                f.write(new)

            talks = parse_talks(path)
            self.assertEqual(len(talks), 1)
            pairs = match_events([ev], talks)
            self.assertIs(pairs[ev.uid], talks[0])
            self.assertEqual(field_diffs(ev, talks[0], future=True), [])
            self.assertEqual(talks[0].row["affiliation"], expected_row(ev)["affiliation"])
            again = rebuild_content(path, talks, {id(talks[0]): ev}, [ev], now)
            self.assertEqual(again, new)


if __name__ == "__main__":
    unittest.main()
