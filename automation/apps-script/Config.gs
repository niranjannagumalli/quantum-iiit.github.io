// Settings shared by both tools. Per-maintainer secrets (GitHub token) live in User Properties.

const UPSTREAM_REPO = 'quantum-iiit/quantum-iiit.github.io';
const BASE_BRANCH = 'main';
const CALENDAR_ID = 'b02429b4ded9c76a1e5e691621d9da9263d3393d55efba77086f8b688470d589@group.calendar.google.com';

// Uploaded speaker photos are committed here, never to main (no repository bloat on the site branch).
const PHOTO_BRANCH = 'speaker-photos';
const PHOTO_DIR = 'photos';

// Branch prefixes for PRs this tool opens, so it can warn about ones still open.
const WEBSITE_PR_PREFIX = 'calendar-sync-';
const YOUTUBE_PR_PREFIX = 'youtube-link-';

const HOST = 'IIIT Hyderabad';
const IST_OFFSET_MINUTES = 330; // Asia/Kolkata, no DST
const DEFAULT_TEAMS_URL =
  'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MTIwYzA1N2UtZTk4OC00MmUyLTgzNTEtOGVlNjIyMjVkZGY0' +
  '%40thread.v2/0?context=%7b%22Tid%22%3a%22031a3bbc-cf7c-4e2b-96ec-867555540a1c%22%2c%22Oid%22%3a' +
  '%227a4a124e-e79f-4645-a13d-e0c802a8b77b%22%7d';
const PLACEHOLDER_PHOTO = 'https://github.com/user-attachments/assets/57584f93-28ff-435e-82fa-36bc0b42fece';

/**
 * The website repository the tools read and open PRs against. Normally UPSTREAM_REPO; a maintainer can
 * point it at their own fork in Settings to try the tools without touching the real site.
 */
function siteRepo() {
  return PropertiesService.getUserProperties().getProperty('SITE_REPO') || UPSTREAM_REPO;
}
