chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ isHidden: false });
});

function toggleSensitiveInformation() {
  chrome.storage.sync.get("isHidden", (data) => {
    const newState = !data.isHidden;
    chrome.storage.sync.set({ isHidden: newState }, () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          try {
            if (
              !tab.url?.includes("chrome://") &&
              typeof tab.id !== "undefined"
            ) {
              chrome.tabs.sendMessage(tab.id, {
                action: "change-hidden-mode",
                isHidden: newState,
              });
            }
          } catch (error) {
            console.log("Error sending message to tab:", error);
          }
        });
      });
    });
  });
}

chrome.action.onClicked.addListener((tab) => {
  try {
    if (!tab.url?.includes("chrome://")) {
      toggleSensitiveInformation();
    }
  } catch (e) {
    console.log(e);
  }
});
