export const getCurrentTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

/**
 * convenient method for chrome.storage
 */
export const storage = {
  set: async (key: string, value: unknown) => {
    return chrome.storage.sync
      .set({ [key]: value })
      .then(() => value)
      .catch(console.log);
  },
  get: async (key: string) => {
    return chrome.storage.sync
      .get(key)
      .then((result) => result[key])
      .catch(console.log);
  },
};

// Convenience helpers for the isHidden flag used across the extension
export const getIsHidden = async (): Promise<boolean> => {
  const value = await storage.get("isHidden");
  return typeof value === "boolean" ? value : false;
};

export const setIsHidden = async (hidden: boolean) => {
  await storage.set("isHidden", hidden);
  if (chrome.action?.setBadgeText) {
    chrome.action.setBadgeText({ text: hidden ? "ON" : "OFF" });
    chrome.action.setBadgeBackgroundColor({
      color: hidden ? "#10b981" : "#ef4444",
    });
    chrome.action.setBadgeTextColor({ color: "#0b0b0f" });
  }
  // Broadcast to tabs but swallow any runtime.lastError via callback so callers
  // don't observe unhandled promise rejections when a tab lacks a receiver.
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      try {
        if (!tab.url?.includes("chrome://") && typeof tab.id !== "undefined") {
          chrome.tabs.sendMessage(
            tab.id,
            { action: "change-hidden-mode", isHidden: hidden },
            () => {
              if (chrome.runtime.lastError) {
                // ignore - tab likely has no content script
              }
            }
          );
        }
      } catch (error) {
        console.log("Error sending message to tab:", error);
      }
    });
  });
};

export const getCustomSelectors = async (): Promise<string> => {
  const value = await storage.get("customSelectors");
  return typeof value === "string" ? value : "";
};

export const setCustomSelectors = async (selectors: string) => {
  await storage.set("customSelectors", selectors);
};

export type SiteSelectorMap = Record<string, string>;

export const getSiteSelectors = async (): Promise<SiteSelectorMap> => {
  const value = await storage.get("siteSelectors");
  if (value && typeof value === "object") {
    return value as SiteSelectorMap;
  }
  return {};
};

export const setSiteSelectors = async (selectors: SiteSelectorMap) => {
  await storage.set("siteSelectors", selectors);
};

export type ThemeMode = "light" | "dark";

export const getTheme = async (): Promise<ThemeMode> => {
  const value = await storage.get("theme");
  return value === "dark" ? "dark" : "light";
};

export const setTheme = async (theme: ThemeMode) => {
  await storage.set("theme", theme);
};
