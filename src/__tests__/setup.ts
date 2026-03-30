// Test setup - loaded before all tests
import { Window } from "happy-dom";

// Create a browser-like environment
const window = new Window();
const document = window.document;

type TestChrome = {
	storage: {
		sync: {
			get: (
				key?: string | string[],
			) => Promise<Record<string, unknown>>;
			set: (value: Record<string, unknown>) => Promise<void>;
		};
		onChanged: {
			addListener: () => void;
		};
	};
	runtime: {
		onMessage: {
			addListener: () => void;
		};
	};
};

type GlobalTestEnvironment = typeof globalThis & {
	window: Window;
	document: Document;
	Element: typeof window.Element;
	HTMLDivElement: typeof window.HTMLDivElement;
	HTMLInputElement: typeof window.HTMLInputElement;
	HTMLTextAreaElement: typeof window.HTMLTextAreaElement;
	HTMLElement: typeof window.HTMLElement;
	Node: typeof window.Node;
	MutationObserver: typeof window.MutationObserver;
	requestAnimationFrame: typeof window.requestAnimationFrame;
	history: History;
	CSS?: typeof window.CSS;
	chrome: TestChrome;
	__resetTestStorage: () => void;
};

// Ensure document has a body
document.write("<!DOCTYPE html><html><head></head><body></body></html>");

const testGlobal = globalThis as GlobalTestEnvironment;
const defaultStorageState = {
	isHidden: false,
	customSelectors: "",
	siteConfigs: {},
	siteSelectors: {},
	theme: "light",
	defaultFilterEnabled: true,
};
let storageState = { ...defaultStorageState };
const readStorageValue = (key: string) =>
	storageState[key as keyof typeof storageState];

const resetTestStorage = () => {
	storageState = {
		...defaultStorageState,
		siteConfigs: {},
		siteSelectors: {},
	};
};

// Set up globals for browser APIs
testGlobal.window = window;
testGlobal.document = document;
testGlobal.Element = window.Element;
testGlobal.HTMLDivElement = window.HTMLDivElement;
testGlobal.HTMLInputElement = window.HTMLInputElement;
testGlobal.HTMLTextAreaElement = window.HTMLTextAreaElement;
testGlobal.HTMLElement = window.HTMLElement;
testGlobal.Node = window.Node;
testGlobal.MutationObserver = window.MutationObserver;
testGlobal.requestAnimationFrame = window.requestAnimationFrame.bind(window);
testGlobal.history = window.history;
testGlobal.CSS = window.CSS;
testGlobal.__resetTestStorage = resetTestStorage;

// Mock chrome API
testGlobal.chrome = {
	storage: {
		sync: {
			get: (key?: string | string[]) => {
				if (typeof key === "string") {
					return Promise.resolve({ [key]: readStorageValue(key) });
				}

				if (Array.isArray(key)) {
					return Promise.resolve(
						key.reduce<Record<string, unknown>>((result, currentKey) => {
							result[currentKey] = readStorageValue(currentKey);
							return result;
						}, {}),
					);
				}

				return Promise.resolve({ ...storageState });
			},
			set: (value: Record<string, unknown>) => {
				storageState = { ...storageState, ...value };
				return Promise.resolve();
			},
		},
		onChanged: {
			addListener: () => {},
		},
	},
	runtime: {
		onMessage: {
			addListener: () => {},
		},
	},
};

resetTestStorage();
