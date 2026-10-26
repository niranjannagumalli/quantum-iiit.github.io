// Web app entry point and per-maintainer settings.

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Quantum Meets tools')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSettings() {
  const props = PropertiesService.getUserProperties();
  const out = { hasToken: !!props.getProperty('GITHUB_TOKEN'), forkRepo: props.getProperty('FORK_REPO') || '' };
  if (out.hasToken) {
    try {
      out.login = gh_('get', '/user').login;
    } catch (e) {
      out.error = e.message;
    }
  }
  return out;
}

/** Save the GitHub token (blank = keep the current one) and an optional fork name override. */
function saveSettings(token, forkRepo) {
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
  return settings;
}
