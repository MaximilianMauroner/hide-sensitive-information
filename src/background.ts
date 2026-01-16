import { getIsHidden, setActionStatusIcon, setIsHidden } from "./utils";

chrome.runtime.onInstalled.addListener(() => {
  setIsHidden(false).catch(console.log);
});

const syncBadge = async () => {
  try {
    const hidden = await getIsHidden();
    await setActionStatusIcon(hidden);
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
