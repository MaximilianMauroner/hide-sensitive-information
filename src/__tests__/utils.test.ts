import { beforeEach, describe, expect, mock, test } from "bun:test";

// Mock Chrome APIs
const mockStorage = {
	sync: {
		set: mock(() => Promise.resolve()),
		get: mock((keys: string | string[]) => {
			// Default mock values
			if (typeof keys === "string") {
				return Promise.resolve({ [keys]: getDefaultValue(keys) });
			}
			const result: Record<string, unknown> = {};
			for (const key of keys) {
				result[key] = getDefaultValue(key);
			}
			return Promise.resolve(result);
		}),
	},
};

const mockAction = {
	setIcon: mock((_options: unknown, callback?: () => void) => callback?.()),
};

const mockTabs = {
	query: mock(
		(_queryInfo: unknown, callback?: (tabs: chrome.tabs.Tab[]) => void) => {
			const tabs: chrome.tabs.Tab[] = [];
			if (callback) {
				callback(tabs);
				return;
			}
			return Promise.resolve(tabs);
		},
	),
	sendMessage: mock(
		(_tabId: number, _message: unknown, callback?: () => void) => {
			callback?.();
			return Promise.resolve();
		},
	),
};

const mockRuntime = {
	onMessage: {
		addListener: mock(() => {}),
	},
};

function getDefaultValue(key: string) {
	switch (key) {
		case "isHidden":
			return false;
		case "customSelectors":
			return "";
		case "siteSelectors":
			return {};
		case "theme":
			return "light";
		default:
			return undefined;
	}
}

// Set up global Chrome mock
globalThis.chrome = {
	storage: mockStorage,
	action: mockAction,
	tabs: mockTabs,
	runtime: mockRuntime,
} as unknown as typeof chrome;

describe("Storage utilities", () => {
	beforeEach(() => {
		// Reset mocks before each test
		mockStorage.sync.get.mockClear();
		mockStorage.sync.set.mockClear();
		mockTabs.query.mockClear();
		mockTabs.sendMessage.mockClear();
	});

	test("getIsHidden returns false by default", async () => {
		const { getIsHidden } = await import("../utils");
		const result = await getIsHidden();
		expect(result).toBe(false);
		expect(mockStorage.sync.get).toHaveBeenCalledWith("isHidden");
	});

	test("setIsHidden stores boolean value", async () => {
		const { setIsHidden } = await import("../utils");
		await setIsHidden(true);
		expect(mockStorage.sync.set).toHaveBeenCalledWith({ isHidden: true });
	});

	test("getCustomSelectors returns empty string by default", async () => {
		const { getCustomSelectors } = await import("../utils");
		const result = await getCustomSelectors();
		expect(typeof result).toBe("string");
		expect(result).toBe("");
	});

	test("setCustomSelectors stores string value", async () => {
		const { setCustomSelectors } = await import("../utils");
		const selectors = ".class1, .class2";
		await setCustomSelectors(selectors);
		expect(mockStorage.sync.set).toHaveBeenCalledWith({
			customSelectors: selectors,
		});
	});

	test("getSiteSelectors returns empty object by default", async () => {
		const { getSiteSelectors } = await import("../utils");
		const result = await getSiteSelectors();
		expect(typeof result).toBe("object");
		expect(Object.keys(result).length).toBe(0);
	});

	test("setSiteSelectors stores object value", async () => {
		const { setSiteSelectors } = await import("../utils");
		const siteMap = {
			"example.com": ".selector1",
			"test.com": ".selector2",
		};
		await setSiteSelectors(siteMap);
		expect(mockStorage.sync.set).toHaveBeenCalledWith({
			siteSelectors: siteMap,
		});
	});

	test("getTheme returns light by default", async () => {
		const { getTheme } = await import("../utils");
		const result = await getTheme();
		expect(result).toBe("light");
	});

	test("setTheme stores theme value", async () => {
		const { setTheme } = await import("../utils");
		await setTheme("dark");
		expect(mockStorage.sync.set).toHaveBeenCalledWith({ theme: "dark" });
	});

	test("getCurrentTab calls chrome.tabs.query", async () => {
		const { getCurrentTab } = await import("../utils");
		await getCurrentTab();
		expect(mockTabs.query).toHaveBeenCalledWith({
			active: true,
			currentWindow: true,
		});
	});
});

describe("Theme type", () => {
	test("ThemeMode type accepts light and dark", async () => {
		const { setTheme } = await import("../utils");

		// These should not throw TypeScript errors
		await setTheme("light");
		await setTheme("dark");
	});
});

describe("SiteSelectorMap type", () => {
	test("SiteSelectorMap accepts string to string mapping", async () => {
		const { setSiteSelectors } = await import("../utils");

		const validMap = {
			"example.com": ".selector",
			"test.com": "#id",
		};

		await setSiteSelectors(validMap);
		expect(mockStorage.sync.set).toHaveBeenCalledWith({
			siteSelectors: validMap,
		});
	});
});
