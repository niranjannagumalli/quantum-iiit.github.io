# Automation

The maintainer tools are in **[apps-script/](apps-script/README.md)**: a Google Apps Script web app with two tabs, Calendar → Website (opens PRs) and YouTube metadata.

The Python script below is the earlier command-line checker. It is still handy for a quick local report.

## Calendar → website check (Python CLI)

The Google Calendar is the ground truth. After someone updates it, run:

```bash
python3 automation/sync_calendar.py          # report what's missing / wrong
python3 automation/sync_calendar.py --fix    # also rewrite Upcoming + Pipeline in content.md
```

No dependencies beyond Python 3.9+. It reads the public calendar feed, so no login is needed.

It reports:

- **Raw Cal.com bookings**: events nobody has curated yet. They're skipped until they are.
- **Missing from the website**: calendar events with no block in `content.md` / `past.md`.
- **In the wrong place**: upcoming talks in the wrong section (Upcoming = up to the end of
  next week, Sunday 23:59 IST; later = Pipeline), or finished talks still in `content.md`.
- **Different from the calendar**: title, arXiv, abstract, venue, date, time, etc. for upcoming talks
  (`--past-details` to include finished ones).
- **On the website but not in the calendar**.

`--fix` only changes future talks in `content.md`. It keeps each block's image and HTML comments
and leaves past talks alone. To fix a typo, fix it **in the calendar** and rerun.

Calendar event format the parser expects (description):

```
Teams link | https://quantum-meets.github.io/

<Talk title>

<Abstract, one or more paragraphs>

arXiv. <link>          (optional)
About. <link>          (optional)
Affiliation. <text>    (optional; kept from the site if missing)
Photo. <github user-attachments URL>   (optional)
Venue. <text>
```

Summary: `[Quantum Seminar] Speaker Name (presented online)`.

Tests: `python3 -m unittest discover automation`
