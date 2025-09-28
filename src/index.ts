import { getIsHidden } from "./utils";

const dataTypeAttribute = "data-hide-sensitive-information-type";
const textOriginalAttribute = "data-hide-sensitive-original";

let isHiddenGlobal: boolean = false;
let throttleTimer: ReturnType<typeof setTimeout> | null = null;

// Run as soon as possible - even before DOM is fully loaded
executeEarly();

// Create an observer instance that will run only once for initial load
const initialObserver = new MutationObserver((_mutations) => {
  try {
    // Process immediately without disconnecting first for speed
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
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
      toggleEmail(); // Process any new content
    }, 10);
  }
});

// Execute as early as possible
function executeEarly() {
  // Try to get the state immediately
  (async () => {
    const isHidden = await getIsHidden();
    handleState(isHidden);

    // Execute immediately if we can
    if (isHidden && document.body) {
      requestAnimationFrame(() => {
        toggleEmail();
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
          toggleEmail();
        });
      }
    })();
  });
}

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
        toggleEmail();
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
        toggleEmail();
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
        toggleEmail();
      });
    }
  };

  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ) {
    originalReplaceState.apply(this, args as any);
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
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
      if (hidden) toggleEmail();
      else restoreEmail();
    });
  }
}

function restoreEmail(): void {
  try {
    restoreInputTypes();
    restoreTextNodes(document.body);
  } catch (e) {
    console.log("Error restoring email content:", e);
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

function toggleEmail(): void {
  // email regex: https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression
  const emailRegex = RegExp(
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g
  );

  // Process visible elements first - prioritize what the user sees
  processVisibleContent(emailRegex);

  // Then process everything else
  processAllContent(emailRegex);
}

// Process visible content first (in viewport)
function processVisibleContent(emailRegex: RegExp): void {
  // get email inputs by id, name and obviously type. this can include duplicates but we don't care
  const possibleEmailInputs = [
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[id="mail"]`)
    ),
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[id="email"]`)
    ),
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[id="mail_address"]`)
    ),
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[id="email_address"]`)
    ),
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[name="mail"]`)
    ),
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[name="email"]`)
    ),
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[name="mail_address"]`)
    ),
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[name="email_address"]`)
    ),
    ...Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[type="email"]`)
    ),
  ];

  // Handle input fields immediately
  for (const email of possibleEmailInputs) {
    const value = email.value;
    if (emailRegex.test(value)) {
      // Only change the type if not already processed
      if (!email.hasAttribute(dataTypeAttribute)) {
        email.setAttribute(dataTypeAttribute, email.type);
        email.type = "password";
      }
    }
  }

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
        const re = new RegExp(
          emailRegex.source,
          emailRegex.flags + (emailRegex.flags.includes("g") ? "" : "g")
        );
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
