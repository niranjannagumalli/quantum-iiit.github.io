// Web app entry point and per-maintainer settings.

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Quantum Meets tools')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSettings() {
  const props = PropertiesService.getUserProperties();
  const out = { hasToken: !!props.getProperty('GITHUB_TOKEN'), forkRepo: props.getProperty('FORK_REPO') || '',
    siteRepo: props.getProperty('SITE_REPO') || '', upstream: UPSTREAM_REPO };
  if (out.hasToken) {
    try {
      out.login = gh_('get', '/user').login;
    } catch (e) {
      out.error = e.message;
    }
  }
  return out;
}

/**
 * Save the GitHub token (blank = keep the current one), an optional fork name override and an optional
 * test repository (blank = the real site, UPSTREAM_REPO).
 */
function saveSettings(token, forkRepo, testRepo) {
  const props = PropertiesService.getUserProperties();
  const previous = props.getProperty('GITHUB_TOKEN');
  if (token) props.setProperty('GITHUB_TOKEN', token.trim());
  if (forkRepo) props.setProperty('FORK_REPO', forkRepo.trim());
  else props.deleteProperty('FORK_REPO');
  const settings = getSettings();
  if (settings.error && token) {
    if (previous) props.setProperty('GITHUB_TOKEN', previous);
    else props.deleteProperty('GITHUB_TOKEN');
    throw new Error('GitHub rejected that token: ' + settings.error);
  }

  testRepo = (testRepo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '');
  if (testRepo && testRepo !== UPSTREAM_REPO) {
    const repo = settings.hasToken ? ghFind_('/repos/' + testRepo) : null;
    if (!repo) throw new Error('Test repository ' + testRepo + ' not found (or no GitHub token saved yet).');
    if (!(repo.permissions && repo.permissions.push)) throw new Error('Your token cannot push to ' + testRepo + '.');
    props.setProperty('SITE_REPO', repo.full_name);
  } else {
    props.deleteProperty('SITE_REPO');
  }
  settings.siteRepo = props.getProperty('SITE_REPO') || '';
  return settings;
}
