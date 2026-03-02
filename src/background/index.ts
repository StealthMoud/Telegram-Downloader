
const updateBadge = (count: number) => {
  const text =
    count > 9999 && count < 1e6
      ? `${Math.trunc(count / 1e3).toString()}k`
      : count > 1e6
        ? "1M+"
        : count.toString();
  chrome.action.setBadgeBackgroundColor({ color: "#1976d2" });
  chrome.action.setBadgeText({ text });
};

async function handleTabAction(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const isTelegram = (tab.url || "").includes("web.telegram.org");
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: isTelegram,
    });
  } catch (err) { }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const manifest = chrome.runtime.getManifest();
    const installTime = Math.round(new Date().getTime() / 1000);

    chrome.storage.local.set({ version: manifest.version, installTime });
    handleTabAction(0);

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab?.url && tab.url.includes("web.telegram.org") && tab.id) {
        chrome.tabs
          .sendMessage(tab.id, { type: "extension_installed" })
          .catch(() => {
            chrome.scripting
              .executeScript({
                target: { tabId: tab.id! },
                func: () => {
                  const msg =
                    chrome.i18n.getMessage("extensionInstalled") ||
                    "Extension installed successfully! Please refresh the page to enable new features.";
                  alert(msg);
                },
              })
              .catch(() => { });
          });
      }
    }
  }
});

chrome.tabs.onActivated.addListener((info) => handleTabAction(info.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") handleTabAction(tabId);
});

chrome.action.onClicked.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    if (tab.url && !tab.url.includes("web.telegram.org")) {
      try {
        await chrome.tabs.update(tab.id, { url: "https://web.telegram.org/k" });
      } catch (e) {
        return;
      }
    }
    handleTabAction(tab.id);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "update_file_count") {
    chrome.storage.local.get(request.message, (result) => {
      if (
        result[request.message] === undefined ||
        result[request.message] === null
      ) {
        updateBadge(0);
      } else {
        const count = Object.keys(result[request.message]).length;
        updateBadge(count);
      }
    });
  } else if (request.type === "progress" || request.type === "download_status") {
    chrome.runtime.sendMessage(request).catch(() => { });
  } else if (request.type === "clearAll") {
    chrome.action.setBadgeText({ text: "0" });
  } else if (request.type === "openSidePanel") {
    if (sender.tab?.id) chrome.sidePanel.open({ tabId: sender.tab.id });
  } else if (request.action === "openOptionsPage") {
    try {
      if (request.hash) {
        const url =
          chrome.runtime.getURL("src/options/index.html") + request.hash;
        chrome.tabs.create({ url, active: true });
      } else {
        chrome.runtime.openOptionsPage();
      }
    } catch (e) { }
  }

  return true;
});

chrome.runtime.onSuspend.addListener(() => { });
