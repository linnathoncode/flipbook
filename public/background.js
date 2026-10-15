const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');

chrome.action.onClicked.addListener(async () => {
  const [existing] = await chrome.tabs.query({ url: DASHBOARD_URL });
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    return;
  }
  await chrome.tabs.create({ url: DASHBOARD_URL });
});
