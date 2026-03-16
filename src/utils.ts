const extensionApi =
	(
		globalThis as typeof globalThis & {
			browser?: typeof chrome;
		}
	).browser ?? chrome;

export const getCurrentTab = async () => {
	const [tab] = await extensionApi.tabs.query({
		active: true,
		currentWindow: true,
	});
	return tab;
};

/**
 * convenient method for chrome.storage
 */
export const storage = {
	set: async (key: string, value: unknown) => {
		return extensionApi.storage.sync
			.set({ [key]: value })
			.then(() => value)
			.catch(console.log);
	},
	get: async (key: string) => {
		return extensionApi.storage.sync
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
	await setActionStatusIcon(hidden);
	// Broadcast to tabs and wait for completion
	await broadcastHiddenState(hidden);
};

const isValidTabUrl = (url?: string): boolean => {
	if (!url) return false;
	// Skip special browser pages that can't have content scripts
	const invalidPrefixes = [
		"chrome://",
		"chrome-extension://",
		"edge://",
		"about:",
		"view-source:",
		"devtools://",
	];
	return !invalidPrefixes.some((prefix) => url.startsWith(prefix));
};

const broadcastHiddenState = (hidden: boolean): Promise<void> => {
	return Promise.race([
		(async () => {
			const tabs = await extensionApi.tabs.query({});
			const validTabs = tabs.filter(
				(
					tab,
				): tab is chrome.tabs.Tab & {
					id: number;
					url: string;
				} => typeof tab.id === "number" && isValidTabUrl(tab.url),
			);

			await Promise.all(
				validTabs.map(async (tab) => {
					try {
						await extensionApi.tabs.sendMessage(tab.id, {
							action: "change-hidden-mode",
							isHidden: hidden,
						});
					} catch {
						// ignore - tab likely has no content script
					}
				}),
			);
		})(),
		new Promise<void>((resolve) => {
			setTimeout(resolve, 2000);
		}),
	]);
};

export const setActionStatusIcon = async (hidden: boolean) => {
	if (!extensionApi.action?.setIcon) return;
	const folder = hidden ? "/icons/on_icon" : "/icons/off_icon";
	const path = {
		"16": `${folder}/icon-16.png`,
		"32": `${folder}/icon-32.png`,
		"48": `${folder}/icon-48.png`,
		"128": `${folder}/icon-128.png`,
	};

	try {
		await extensionApi.action.setIcon({ path });
	} catch (error) {
		console.log("Failed to set action icon:", error);
	}
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

// New per-site config structure
export type SiteConfig = {
	selectors?: string; // custom CSS selectors
	defaultFilterEnabled?: boolean; // undefined = use global, true/false = override
};

export type SiteConfigMap = Record<string, SiteConfig>;

export const getSiteConfigs = async (): Promise<SiteConfigMap> => {
	// Check new format first
	const configs = await storage.get("siteConfigs");
	if (configs && typeof configs === "object") {
		return configs as SiteConfigMap;
	}

	// Migrate from old format
	const oldSelectors = await storage.get("siteSelectors");
	if (oldSelectors && typeof oldSelectors === "object") {
		const migrated: SiteConfigMap = {};
		for (const [host, selectors] of Object.entries(oldSelectors)) {
			migrated[host] = { selectors: selectors as string };
		}
		await storage.set("siteConfigs", migrated);
		return migrated;
	}

	return {};
};

export const setSiteConfigs = async (configs: SiteConfigMap) => {
	await storage.set("siteConfigs", configs);
};

export type ThemeMode = "light" | "dark";

export const getTheme = async (): Promise<ThemeMode> => {
	const value = await storage.get("theme");
	return value === "dark" ? "dark" : "light";
};

export const setTheme = async (theme: ThemeMode) => {
	await storage.set("theme", theme);
};

export const getDefaultFilterEnabled = async (): Promise<boolean> => {
	const value = await storage.get("defaultFilterEnabled");
	// Default to true if not set
	return typeof value === "boolean" ? value : true;
};

export const setDefaultFilterEnabled = async (enabled: boolean) => {
	await storage.set("defaultFilterEnabled", enabled);
};
