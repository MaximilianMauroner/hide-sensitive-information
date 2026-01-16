// Test setup - loaded before all tests
import { Window } from "happy-dom";

// Create a browser-like environment
const window = new Window();
const document = window.document;

// Ensure document has a body
document.write("<!DOCTYPE html><html><head></head><body></body></html>");

// Set up globals for browser APIs
(globalThis as any).window = window;
(globalThis as any).document = document;
(globalThis as any).HTMLInputElement = window.HTMLInputElement;
(globalThis as any).HTMLTextAreaElement = window.HTMLTextAreaElement;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Node = window.Node;
(globalThis as any).MutationObserver = window.MutationObserver;
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(globalThis as any).history = window.history;

// Mock chrome API
(globalThis as any).chrome = {
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
