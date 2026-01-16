import { getCustomSelectors, getIsHidden } from "./utils";

const dataTypeAttribute = "data-hide-sensitive-information-type";
const textOriginalAttribute = "data-hide-sensitive-original";
const styleOriginalAttribute = "data-hide-sensitive-original-style";

const emailRegex = RegExp(
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i
);

const sensitiveKeywords = [
  "password",
  "pass",
  "secret",
  "token",
  "api",
  "key",
  "auth",
  "session",
  "ssn",
  "social",
  "credit",
  "card",
  "cvv",
  "cvc",
  "pin",
  "email",
  "e-mail",
  "mail",
  "phone",
  "tel",
];

const sensitiveAutocompleteValues = new Set([
  "current-password",
  "new-password",
  "one-time-code",
  "cc-number",
  "cc-csc",
  "cc-exp",
  "cc-exp-month",
  "cc-exp-year",
  "cc-name",
  "email",
  "tel",
]);

let isHiddenGlobal: boolean = false;
let throttleTimer: ReturnType<typeof setTimeout> | null = null;
let customSelectors: string[] = [];

const parseSelectors = (raw: unknown): string[] => {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\n,]+/)
    .map((selector) => selector.trim())
    .filter(Boolean);
};

const normalizeValue = (value?: string | null) => (value ?? "").toLowerCase();

const hasSensitiveKeyword = (value?: string | null) => {
  const normalized = normalizeValue(value);
  return sensitiveKeywords.some((keyword) => normalized.includes(keyword));
};

const isSensitiveField = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement
) => {
  if (element instanceof HTMLInputElement) {
    const type = normalizeValue(element.type);
    if (type === "password" || type === "email" || type === "tel") return true;
  }

  const autocomplete = normalizeValue(element.getAttribute("autocomplete"));
  if (autocomplete && sensitiveAutocompleteValues.has(autocomplete)) return true;

  return [
    element.getAttribute("name"),
    element.getAttribute("id"),
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.getAttribute("data-testid"),
  ].some(hasSensitiveKeyword);
};

const refreshCustomSelectors = async () => {
  try {
    const raw = await getCustomSelectors();
    customSelectors = parseSelectors(raw);
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        applyCustomSelectors();
      });
    }
  } catch (error) {
    console.log("Error loading custom selectors:", error);
    customSelectors = [];
  }
};

// Run as soon as possible - even before DOM is fully loaded
executeEarly();

// Create an observer instance that will run only once for initial load
const initialObserver = new MutationObserver((_mutations) => {
  try {
    // Process immediately without disconnecting first for speed
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleSensitive();
      });
    }
  } catch (error) {
    console.log("Error in mutation observer:", error);
  }
});

// Create a continuous observer to detect new content
const contentObserver = new MutationObserver((_mutations) => {
  if (!isHiddenGlobal) return; // Only process if hiding is enabled

  // Throttle processing to prevent performance issues
  if (!throttleTimer) {
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      toggleSensitive(); // Process any new content
    }, 10);
  }
});

// Execute as early as possible
function executeEarly() {
  refreshCustomSelectors();
  setupInputListener();

  // Try to get the state immediately
  (async () => {
    const isHidden = await getIsHidden();
    handleState(isHidden);

    // Execute immediately if we can
    if (isHidden && document.body) {
      requestAnimationFrame(() => {
        toggleSensitive();
      });
    }
  })();

  // Add fastest possible listeners
  document.addEventListener("DOMContentLoaded", () => {
    (async () => {
      const isHidden = await getIsHidden();
      handleState(isHidden);
      if (isHidden) {
        requestAnimationFrame(() => {
          toggleSensitive();
        });
      }
    })();
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (!changes.customSelectors) return;
  customSelectors = parseSelectors(changes.customSelectors.newValue);

  if (isHiddenGlobal) {
    requestAnimationFrame(() => {
      applyCustomSelectors();
    });
  }
});

// Initial check directly
(async () => {
  const isHidden = await getIsHidden();
  handleState(isHidden);

  // Set up observers immediately
  if (document.body) {
    // Start observing for both initial and continuous changes
    initialObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Start the continuous observer for dynamic content
    setupContinuousObservation();
  } else {
    // If body isn't ready, wait for it
    const checkBodyInterval = setInterval(() => {
      if (document.body) {
        clearInterval(checkBodyInterval);

        initialObserver.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        setupContinuousObservation();
      }
    }, 5);
  }

  // Also run when the page is fully loaded for any missed content
  window.addEventListener("load", () => {
    if (isHidden) {
      requestAnimationFrame(() => {
        toggleSensitive();
      });
    }
  });
})();

// Set up monitoring for URL/navigation changes
function setupNavigationMonitoring() {
  // Listen for popstate events (back/forward navigation)
  window.addEventListener("popstate", () => {
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleSensitive();
      });
    }
  });

  // Monitor pushState and replaceState calls
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState.apply(this, args as any);
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleSensitive();
      });
    }
  };

  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ) {
    originalReplaceState.apply(this, args as any);
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleSensitive();
      });
    }
  };
}

// Set up continuous observation of DOM changes
function setupContinuousObservation() {
  // Start observing for dynamic content changes
  contentObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Set up navigation monitoring for SPA
  setupNavigationMonitoring();
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "change-hidden-mode") {
    handleState(request.isHidden);
  }
});

function handleState(hidden: boolean) {
  isHiddenGlobal = hidden;
  if (document.body) {
    requestAnimationFrame(() => {
      if (hidden) toggleSensitive();
      else restoreSensitive();
    });
  }
}

function restoreSensitive(): void {
  try {
    restoreInputTypes();
    restoreMaskedStyles(document.body);
    restoreTextNodes(document.body);
  } catch (e) {
    console.log("Error restoring sensitive content:", e);
  }
}

function restoreInputTypes() {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[${dataTypeAttribute}]`)
  );

  for (const input of inputs) {
    const original = input.getAttribute(dataTypeAttribute);
    if (original) {
      try {
        input.type = original;
      } catch (e) {
        // ignore if type cannot be set
      }
    }
    input.removeAttribute(dataTypeAttribute);
  }
}

function restoreMaskedStyles(root: Element | Document | null) {
  if (!root) return;
  const els = (root as Element).querySelectorAll
    ? (root as Element).querySelectorAll(`[${styleOriginalAttribute}]`)
    : [];

  els.forEach((el) => {
    try {
      const encoded = el.getAttribute(styleOriginalAttribute);
      if (!encoded) return;
      const original = JSON.parse(encoded) as {
        color?: string;
        textShadow?: string;
        caretColor?: string;
        webkitTextSecurity?: string;
      };
      const htmlEl = el as HTMLElement;
      htmlEl.style.color = original.color ?? "";
      htmlEl.style.textShadow = original.textShadow ?? "";
      htmlEl.style.caretColor = original.caretColor ?? "";

      if (original.webkitTextSecurity) {
        htmlEl.style.setProperty(
          "-webkit-text-security",
          original.webkitTextSecurity
        );
      } else {
        htmlEl.style.removeProperty("-webkit-text-security");
      }
      (htmlEl.style as any).textSecurity = "";
    } catch (e) {
      // ignore restore errors
    } finally {
      el.removeAttribute(styleOriginalAttribute);
    }
  });
}

function restoreTextNodes(root: Element | Document | null) {
  if (!root) return;
  const els = (root as Element).querySelectorAll
    ? (root as Element).querySelectorAll(`[${textOriginalAttribute}]`)
    : [];

  els.forEach((el) => {
    try {
      const encoded = el.getAttribute(textOriginalAttribute);
      if (encoded == null) return;
      const original = decodeURIComponent(encoded);
      const textNode = document.createTextNode(original);
      el.replaceWith(textNode);
    } catch (e) {
      // ignore errors during replace
    }
  });
}

function setupInputListener() {
  document.addEventListener("input", (event) => {
    if (!isHiddenGlobal) return;
    const target = event.target;

    if (target instanceof HTMLInputElement) {
      if (shouldMaskInput(target)) {
        maskElement(target);
      }
      return;
    }

    if (target instanceof HTMLTextAreaElement) {
      if (isSensitiveField(target) || emailRegex.test(target.value)) {
        maskElement(target);
      }
      return;
    }

    if (target instanceof HTMLElement && target.isContentEditable) {
      if (isSensitiveField(target)) {
        maskElement(target);
      }
    }
  });
}

function shouldMaskInput(input: HTMLInputElement) {
  if (isSensitiveField(input)) return true;
  return input.value ? emailRegex.test(input.value) : false;
}

function applyStyleMask(element: HTMLElement) {
  if (element.hasAttribute(styleOriginalAttribute)) return;
  const original = {
    color: element.style.color,
    textShadow: element.style.textShadow,
    caretColor: element.style.caretColor,
    webkitTextSecurity: element.style.getPropertyValue(
      "-webkit-text-security"
    ),
  };
  element.setAttribute(styleOriginalAttribute, JSON.stringify(original));
  element.style.setProperty("-webkit-text-security", "disc");
  (element.style as any).textSecurity = "disc";
  element.style.color = "transparent";
  element.style.textShadow = "0 0 8px rgba(0,0,0,0.6)";
  element.style.caretColor = "#94a3b8";
}

function maskElement(element: Element) {
  if (element instanceof HTMLInputElement) {
    maskInputElement(element);
    return;
  }
  if (element instanceof HTMLTextAreaElement) {
    applyStyleMask(element);
    return;
  }
  if (element instanceof HTMLElement) {
    applyStyleMask(element);
  }
}

function maskInputElement(input: HTMLInputElement) {
  if (input.type === "password") return;
  if (input.hasAttribute(dataTypeAttribute)) return;
  try {
    input.setAttribute(dataTypeAttribute, input.type);
    input.type = "password";
  } catch (e) {
    applyStyleMask(input);
  }
}

function applyCustomSelectors() {
  if (!customSelectors.length) return;

  for (const selector of customSelectors) {
    try {
      document.querySelectorAll(selector).forEach((element) => {
        maskElement(element);
      });
    } catch (error) {
      // ignore invalid selectors
    }
  }
}

function processSensitiveFields() {
  const fields = document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLElement
  >("input, textarea, [contenteditable=\"true\"]");

  fields.forEach((field) => {
    if (field instanceof HTMLInputElement) {
      if (shouldMaskInput(field)) {
        maskElement(field);
      }
      return;
    }

    if (field instanceof HTMLTextAreaElement) {
      if (isSensitiveField(field) || emailRegex.test(field.value)) {
        maskElement(field);
      }
      return;
    }

    if (field instanceof HTMLElement && field.isContentEditable) {
      if (isSensitiveField(field)) {
        maskElement(field);
      }
    }
  });
}

function toggleSensitive(): void {
  processSensitiveFields();
  applyCustomSelectors();

  // Process visible elements first - prioritize what the user sees
  processVisibleContent(emailRegex);

  // Then process everything else
  processAllContent(emailRegex);
}

// Process visible content first (in viewport)
function processVisibleContent(emailRegex: RegExp): void {
  // Try to find elements in the current viewport first
  try {
    const viewportHeight = window.innerHeight;
    const viewportElements = [];

    // Get all elements in the viewport
    const allElements = document.body.getElementsByTagName("*");
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];
      if (!element) continue;
      const rect = element.getBoundingClientRect();

      // Check if element is in viewport
      if (rect.top < viewportHeight && rect.bottom >= 0) {
        viewportElements.push(element);
      }
    }

    // Process viewport elements first
    viewportElements.forEach((element) => {
      replaceEmailsInTextNodes(element, emailRegex);
    });
  } catch (e) {
    // Fall back to default processing if viewport detection fails
    replaceEmailsInTextNodes(document.body, emailRegex);
  }
}

// Process all content after visible content
function processAllContent(emailRegex: RegExp): void {
  replaceEmailsInTextNodes(document.body, emailRegex);
}

// Function to safely traverse DOM and replace emails in text nodes only
function replaceEmailsInTextNodes(
  element: Element | Document | null,
  emailRegex: RegExp
): void {
  if (!element) return;

  // If this is an Element, optionally skip SCRIPT/STYLE
  if (element instanceof Element) {
    const tag = element.tagName;
    if (tag === "SCRIPT" || tag === "STYLE") return;
  }

  const childNodes = (element as Element | Document).childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    if (!node) continue;

    if (node.nodeType === Node.TEXT_NODE) {
      const current = node.nodeValue;
      if (current && emailRegex.test(current)) {
        // Create a document fragment and replace matches with span elements
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        const re = new RegExp(emailRegex.source, "gi");
        while ((match = re.exec(current)) !== null) {
          const index = match.index;
          // text before match
          if (index > lastIndex) {
            frag.appendChild(
              document.createTextNode(current.slice(lastIndex, index))
            );
          }

          const matchedText = match[0];
          const masked = matchedText
            .split("@")
            .map((part) => part.replace(/./g, "*"))
            .join("@");

          const span = document.createElement("span");
          span.setAttribute(
            textOriginalAttribute,
            encodeURIComponent(matchedText)
          );
          span.textContent = masked;
          frag.appendChild(span);

          lastIndex = index + matchedText.length;
        }

        // remaining text
        if (lastIndex < current.length) {
          frag.appendChild(document.createTextNode(current.slice(lastIndex)));
        }

        try {
          node.parentNode?.replaceChild(frag, node);
        } catch (e) {
          // ignore replacement errors
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      replaceEmailsInTextNodes(node as Element, emailRegex);
    }
  }
}
