// Test setup - loaded before all tests
import { Window } from "happy-dom";

// Create a browser-like environment
const window = new Window();
const document = window.document;

type TestChrome = {
	storage: {
		sync: {
			get: () => Promise<{ isHidden: boolean; customSelectors: string }>;
			set: () => Promise<void>;
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
	HTMLInputElement: typeof window.HTMLInputElement;
	HTMLTextAreaElement: typeof window.HTMLTextAreaElement;
	HTMLElement: typeof window.HTMLElement;
	Node: typeof window.Node;
	MutationObserver: typeof window.MutationObserver;
	requestAnimationFrame: typeof window.requestAnimationFrame;
	history: History;
	chrome: TestChrome;
};

// Ensure document has a body
document.write("<!DOCTYPE html><html><head></head><body></body></html>");

const testGlobal = globalThis as GlobalTestEnvironment;

// Set up globals for browser APIs
testGlobal.window = window;
testGlobal.document = document;
testGlobal.HTMLInputElement = window.HTMLInputElement;
testGlobal.HTMLTextAreaElement = window.HTMLTextAreaElement;
testGlobal.HTMLElement = window.HTMLElement;
testGlobal.Node = window.Node;
testGlobal.MutationObserver = window.MutationObserver;
testGlobal.requestAnimationFrame = window.requestAnimationFrame.bind(window);
testGlobal.history = window.history;

// Mock chrome API
testGlobal.chrome = {
	storage: {
		sync: {
			get: () => Promise.resolve({ isHidden: false, customSelectors: "" }),
			set: () => Promise.resolve(),
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
