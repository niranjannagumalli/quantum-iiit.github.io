# Quantum Meets tools (Google Apps Script)

These are two maintainer tools in one Apps Script web app. The requirements are in [requirements.md](../../requirements.md).

| Tab | What it does |
|-|-|
| **Calendar → Website** | Reads the [Quantum Meets calendar](https://calendar.google.com/calendar/embed?src=b02429b4ded9c76a1e5e691621d9da9263d3393d55efba77086f8b688470d589%40group.calendar.google.com&ctz=Asia%2FKolkata) and checks the website repo against it. Any upcoming talk missing from `content.md` gets an entry you can review, with an optional photo upload. It then opens a pull request. |
| **YouTube metadata** | Takes a YouTube link and a speaker name. It finds the talk on the website and builds the title and description, then previews them. You save them to the (unlisted) video, and can then make it public and open a PR that links the video from `past.md`. |

The calendar is the ground truth. To fix a talk's details, fix them in the calendar and run the tool again.

## Setup (once)

1. **Create the project.** Either:
   - with [clasp](https://github.com/google/clasp):
     ```bash
     npm install -g @google/clasp && clasp login
     clasp create --type webapp --title "Quantum Meets tools" --rootDir automation/apps-script
     clasp push
     ```
   - or by hand: create a project at [script.google.com](https://script.google.com), then add every `.gs` file and `Index.html` from this folder with the same names. Under *Project Settings*, tick *Show "appsscript.json"* and paste in [appsscript.json](appsscript.json). The manifest turns on the Calendar and YouTube advanced services.
2. **Deploy.** Choose *Deploy → New deployment → Web app*. The manifest already sets *Execute as: User accessing the web app* and *Who has access: Anyone with a Google account*. Share the web app URL with the maintainers.
3. **Each maintainer, on first use:**
   - Open the URL and authorize. The app asks for read-only calendar access, YouTube, and external requests to GitHub.
   - In **Settings**, paste a GitHub token: a classic token with the `public_repo` scope. It is stored in that person's own user properties.
   - If you can't push to `quantum-iiit/quantum-iiit.github.io`, fork it first. PRs then come from a branch on your fork.
   - For the YouTube tab, sign in with the Google account that manages the Quantum Meets channel. If it's a Brand Account channel, choose that channel when Google asks which account or channel to use.

## Calendar → Website

1. Update the calendar event. The summary looks like `[Quantum Seminar] Speaker Name (presented online)`. The description holds the title (bold), the abstract, and then the `arXiv.`, `About.` and `Venue.` lines. `Affiliation.` and `Photo.` are optional.
2. Open the web app. It shows:
   - **Repository:** the latest commit on upstream `main`, and whether your fork is behind. Use **Sync fork** if it is. It also warns about PRs from this tool that are still open.
   - **Calendar vs. website:** every upcoming event, marked *On website*, *Missing*, *Date differs* (fix that one by hand), *Not curated* (a raw Cal.com booking) or *Cancelled*.
   - **New entries:** one card per missing talk, with these fields:
     - **Section:** Upcoming if the talk is before the end of next week, otherwise Pipeline. You can change it.
     - **Affiliation:** filled in if the speaker has spoken before.
     - **Photo:** upload one, or paste a URL.
     - **Markdown:** the generated entry, which you can edit, shown next to a rendered preview.
3. Tick the confirmation box and click **Commit & open pull request**. The tool creates a `calendar-sync-…` branch from upstream `main`, commits `content.md` and opens a PR. Review and merge it on GitHub.

**Photos.** The image is resized to 280 px wide (twice the 140 px display width). It is committed to the **`speaker-photos`** branch, never to `main`. The entry links to it through `raw.githubusercontent.com`. The tool can't use `gh image` (`github.com/user-attachments/...`) because GitHub has no API for those links, so Apps Script can't create them. The photo goes to the upstream repo if you can push there, otherwise to your fork.

## YouTube metadata

1. Paste the video link (`youtu.be/…`, `watch?v=…` or a YouTube Studio link) and the speaker's name.
2. The tool reads:
   - the talk's title, abstract, type and arXiv link from `past.md` / `content.md` on `main`
   - the speaker's `About.` link from the calendar event on that date, plus the arXiv link if the website has none.

   It builds the title and description in the same format as the videos already on the channel:
   ```
   [Quantum Seminar] Speaker Name | Talk title

   *Talk title*

   *Abstract.* …

   *arXiv.* https://arxiv.org/abs/…

   *About.* https://…

   *Host.* IIIT Hyderabad
   ```
3. Edit the title and description on the left. The right side previews them the way YouTube shows them. Titles over 100 characters get shorter suggestions, and `<` / `>` are replaced because YouTube rejects them.
4. **Save to YouTube** writes the title and description and removes any tags. The privacy setting is left alone.
5. Once the preview looks right, click **Make public**, or do it in YouTube Studio. **Open PR: YouTube link on the website** replaces the talk's `[Teams](…)` link with `[YouTube](https://youtu.be/…)`.

## Tests

The parsing and rendering code is plain JavaScript, so it runs under Node 18+ against the real `content.md` and `past.md`:

```bash
node --test automation/apps-script/test/*.test.js
```

The parts that call Google or GitHub services (`fetchCalendarEvents`, `GitHub.gs`, and the `YouTube.*` calls) can only be exercised in the deployed web app.
