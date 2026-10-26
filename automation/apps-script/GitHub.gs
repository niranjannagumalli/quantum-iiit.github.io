// GitHub REST API: repository status, reading site files, photo upload and pull requests.
// Apps Script cannot run git, so "add + commit + PR" is: create branch -> commit file -> open PR.

function githubToken_() {
  const token = PropertiesService.getUserProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Add your GitHub token in Settings first.');
  return token;
}

function gh_(method, path, body, accept) {
  const opts = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + githubToken_(),
      Accept: accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
  if (body) {
    opts.contentType = 'application/json';
    opts.payload = JSON.stringify(body);
  }
  const res = UrlFetchApp.fetch('https://api.github.com' + path, opts);
  const code = res.getResponseCode();
  const text = res.getContentText('UTF-8');
  if (code >= 300) {
    let msg = text.slice(0, 300);
    try { msg = JSON.parse(text).message; } catch (e) { /* not JSON */ }
    const err = new Error('GitHub ' + method.toUpperCase() + ' ' + path.split('?')[0] + ' failed (' + code + '): ' + msg);
    err.status = code;
    throw err;
  }
  if (accept && accept.indexOf('raw') >= 0) return text;
  return text ? JSON.parse(text) : null;
}

/** Like gh_ GET, but null on 404. */
function ghFind_(path) {
  try {
    return gh_('get', path);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

/**
 * Who the maintainer is and where PRs come from:
 * their fork if they have one, otherwise a branch on upstream (when they can push there).
 */
function githubContext_() {
  const login = gh_('get', '/user').login;
  const upstream = gh_('get', '/repos/' + UPSTREAM_REPO);
  const canPush = !!(upstream.permissions && upstream.permissions.push);
  const head = gh_('get', '/repos/' + UPSTREAM_REPO + '/commits/' + BASE_BRANCH);
  const forkName = PropertiesService.getUserProperties().getProperty('FORK_REPO') ||
    login + '/' + UPSTREAM_REPO.split('/')[1];
  const fork = ghFind_('/repos/' + forkName);
  const isFork = !!(fork && fork.fork && fork.parent && fork.parent.full_name === UPSTREAM_REPO);

  const ctx = {
    login: login,
    upstream: UPSTREAM_REPO,
    canPush: canPush,
    workRepo: isFork ? fork.full_name : (canPush ? UPSTREAM_REPO : ''),
    isFork: isFork,
    behindBy: 0,
    aheadBy: 0,
    photoRepo: canPush ? UPSTREAM_REPO : (isFork ? fork.full_name : ''),
    head: {
      sha: head.sha,
      message: head.commit.message.split('\n')[0],
      date: head.commit.committer.date,
      url: head.html_url,
    },
  };
  if (isFork) {
    const cmp = gh_('get', '/repos/' + UPSTREAM_REPO + '/compare/' + BASE_BRANCH + '...' +
      fork.owner.login + ':' + BASE_BRANCH);
    ctx.behindBy = cmp.behind_by;
    ctx.aheadBy = cmp.ahead_by;
  }
  ctx.openPrs = gh_('get', '/repos/' + UPSTREAM_REPO + '/pulls?state=open&per_page=100')
    .filter(pr => pr.head.ref.indexOf(WEBSITE_PR_PREFIX) === 0 || pr.head.ref.indexOf(YOUTUBE_PR_PREFIX) === 0)
    .map(pr => ({ number: pr.number, title: pr.title, url: pr.html_url, branch: pr.head.ref }));
  return ctx;
}

/** Bring the fork's main up to date with upstream main ("Sync fork" on github.com). */
function syncFork() {
  const ctx = githubContext_();
  if (!ctx.isFork) throw new Error('No fork to sync: PRs are opened from branches on ' + ctx.workRepo + '.');
  const res = gh_('post', '/repos/' + ctx.workRepo + '/merge-upstream', { branch: BASE_BRANCH });
  return { message: res.message, status: githubContext_() };
}

/** A site file at `ref` (default: upstream main). Works without a token for the public repo. */
function readSiteFile(path, ref) {
  ref = ref || BASE_BRANCH;
  if (PropertiesService.getUserProperties().getProperty('GITHUB_TOKEN')) {
    return gh_('get', '/repos/' + UPSTREAM_REPO + '/contents/' + path + '?ref=' + ref, null,
      'application/vnd.github.raw+json');
  }
  const res = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + UPSTREAM_REPO + '/' + ref + '/' + path);
  return res.getContentText('UTF-8');
}

/**
 * Commit `files` ({path: newText}) on a new branch based on upstream main and open a PR to upstream.
 * Refuses if main moved since `baseSha` (the files were edited from that version) or the fork is behind.
 */
function openPullRequest_(opts) {
  const log = [];
  const ctx = githubContext_();
  if (!ctx.workRepo) {
    throw new Error('You cannot push to ' + UPSTREAM_REPO + ' and have no fork of it. Fork it on GitHub first.');
  }
  if (ctx.head.sha !== opts.baseSha) {
    throw new Error(BASE_BRANCH + ' changed since you loaded the page (now ' + ctx.head.sha.slice(0, 7) +
      '). Reload and try again so nothing is overwritten.');
  }
  if (ctx.isFork && ctx.behindBy > 0) {
    throw new Error('Your fork ' + ctx.workRepo + ' is ' + ctx.behindBy + ' commit(s) behind ' + UPSTREAM_REPO +
      '. Sync it first.');
  }
  const stamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd-HHmmss');
  const branch = opts.branchPrefix + stamp;
  gh_('post', '/repos/' + ctx.workRepo + '/git/refs', { ref: 'refs/heads/' + branch, sha: ctx.head.sha });
  log.push('Created branch ' + ctx.workRepo + ':' + branch + ' from ' + BASE_BRANCH + ' @ ' + ctx.head.sha.slice(0, 7));

  Object.keys(opts.files).forEach(path => {
    const current = gh_('get', '/repos/' + ctx.workRepo + '/contents/' + path + '?ref=' + branch);
    gh_('put', '/repos/' + ctx.workRepo + '/contents/' + path, {
      message: opts.commitMessage,
      content: Utilities.base64Encode(opts.files[path], Utilities.Charset.UTF_8),
      sha: current.sha,
      branch: branch,
    });
    log.push('Committed ' + path + ': "' + opts.commitMessage + '"');
  });

  const pr = gh_('post', '/repos/' + UPSTREAM_REPO + '/pulls', {
    title: opts.title,
    body: opts.body,
    head: ctx.isFork ? ctx.workRepo.split('/')[0] + ':' + branch : branch,
    base: BASE_BRANCH,
    maintainer_can_modify: true,
  });
  log.push('Opened PR #' + pr.number + ' → ' + pr.html_url);
  return { number: pr.number, url: pr.html_url, branch: branch, log: log };
}

/**
 * Commit an image to the speaker-photos branch and return its raw.githubusercontent.com URL.
 * (github.com/user-attachments links have no public API, so they can't be created from Apps Script.)
 */
function uploadPhoto(base64, mimeType, baseName) {
  const ctx = githubContext_();
  if (!ctx.photoRepo) throw new Error('No repository to store the photo in. Fork ' + UPSTREAM_REPO + ' first.');
  ensurePhotoBranch_(ctx.photoRepo);
  const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mimeType] || 'jpg';
  const slug = (baseName || 'speaker').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'speaker';
  const path = PHOTO_DIR + '/' + slug + '-' + Date.now().toString(36) + '.' + ext;
  gh_('put', '/repos/' + ctx.photoRepo + '/contents/' + path, {
    message: 'Add speaker photo ' + path,
    content: base64,
    branch: PHOTO_BRANCH,
  });
  return { url: 'https://raw.githubusercontent.com/' + ctx.photoRepo + '/' + PHOTO_BRANCH + '/' + path, repo: ctx.photoRepo, path: path };
}

/** Create the photo branch as an orphan (no site history) the first time it's needed. */
function ensurePhotoBranch_(repo) {
  if (ghFind_('/repos/' + repo + '/git/ref/heads/' + PHOTO_BRANCH)) return;
  const tree = gh_('post', '/repos/' + repo + '/git/trees', {
    tree: [{
      path: 'README.md', mode: '100644', type: 'blob',
      content: '# Speaker photos\n\nUploaded by the Quantum Meets calendar tool and linked from content.md / past.md.\n' +
        'Kept off `main` so the website branch stays small. Do not delete files that are still linked.\n',
    }],
  });
  const commit = gh_('post', '/repos/' + repo + '/git/commits', {
    message: 'Start speaker photo branch', tree: tree.sha, parents: [],
  });
  gh_('post', '/repos/' + repo + '/git/refs', { ref: 'refs/heads/' + PHOTO_BRANCH, sha: commit.sha });
}
