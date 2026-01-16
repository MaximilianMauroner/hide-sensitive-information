import { getIsHidden, setIsHidden } from "./utils";

chrome.runtime.onInstalled.addListener(() => {
  setIsHidden(false).catch(console.log);
});

const syncBadge = async () => {
  try {
    const hidden = await getIsHidden();
    if (chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: hidden ? "ON" : "OFF" });
      chrome.action.setBadgeBackgroundColor({
        color: hidden ? "#10b981" : "#ef4444",
      });
      chrome.action.setBadgeTextColor({ color: "#0b0b0f" });
    }
  } catch (error) {
    console.log("Failed to sync badge state", error);
  }
};

syncBadge();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (!changes.isHidden) return;
  syncBadge();
});
