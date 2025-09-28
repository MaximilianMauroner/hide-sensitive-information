import elementReady, { type Options } from "element-ready";

export function $<T extends Element>(selector: string) {
  return document.querySelector<T>(selector);
}

export function $$<T extends Element>(selector: string) {
  return document.querySelectorAll<T>(selector);
}

export const waitFor = async (duration = 1000) =>
  new Promise((resolve) => setTimeout(resolve, duration));

export const waitForElement = async (selector: string, options?: Options) => {
  return elementReady(selector, {
    stopOnDomReady: false,
    ...options,
  });
};

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
