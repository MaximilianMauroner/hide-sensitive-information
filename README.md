# Hide Sensitive Information

Hide Sensitive Information is a Chrome and Firefox extension that masks sensitive fields and text directly in the page. It is designed for browsing, demos, recordings, and screen shares where private data should stay visible to you but not readable at a glance.

All detection and masking runs locally in the browser. No page content is sent to a server.

## Current Status

- The extension codebase supports both Chrome and Firefox builds from the same source tree.
- The popup currently includes:
  - a global masking toggle,
  - a global auto-detect toggle,
  - global custom selectors,
  - per-site rules with optional auto-detect overrides,
  - an element picker for generating selectors from the current page,
  - theme persistence, and
  - current-page rule summaries.
- CI packages release artifacts on pushes to `main`:
  - Chrome: `.zip`
  - Firefox: `.xpi`
- The repository is currently set up primarily for unpacked/local installs and packaged release artifacts.

## Features

- Automatic masking for common sensitive form fields such as passwords, emails, telephone inputs, payment-related autocomplete fields, and fields labeled with sensitive keywords.
- Sensitive text masking for patterns currently implemented in code:
  - email addresses,
  - Stripe keys,
  - Google API keys,
  - GitHub tokens,
  - Slack tokens,
  - AWS access key IDs,
  - JWTs,
  - bearer tokens,
  - PEM private keys.
- Global custom selectors that apply on every site.
- Per-site rules that can:
  - add site-specific selectors,
  - override the global auto-detect setting for one hostname.
- Element picker that generates a selector from the page and saves it as either a global or site-specific rule.
- Live masking for dynamic DOM updates and SPA navigation.
- State-aware toolbar icons for masked vs unmasked mode.
- Theme preference stored in extension storage.
- Settings stored in `storage.sync`.

## Installation

### Prerequisites

- [Bun](https://bun.sh)
- A Chromium-based browser or Firefox

### Setup

```bash
git clone https://github.com/MaximilianMauroner/hide-sensitive-information.git
cd hide-sensitive-information
bun install
bun run build
```

### Load In Chrome

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select the [`build/`](./build) directory

### Load In Firefox

1. Run `bun run build`
2. Open `about:debugging#/runtime/this-firefox`
3. Click `Load Temporary Add-on`
4. Select [`build-firefox/manifest.json`](./build-firefox/manifest.json)

## Usage

### Toggle Masking

Open the popup and switch masking on or off.

- When masking is on, the extension applies across open tabs and future pages where the content script can run.
- When masking is off, previously masked content is restored.

### Use Auto-Detect

The `Auto-filter emails, passwords, keys` toggle controls the built-in heuristics.

- On: automatic field and text masking is enabled.
- Off: only your saved selectors are applied.

This setting can be overridden per site.

### Add Global Selectors

Use `Global selectors` when a page contains content the extension should always mask but cannot infer automatically.

Example:

```css
.billing-email,
input[name="api-token"],
[data-testid="secret-token"]
```

Selectors can be comma-separated or newline-separated.

### Add Per-Site Rules

Use `Per-site rules` when one hostname needs its own configuration.

Each site rule can contain:

- `Extra selectors` for that hostname only
- `Auto-detect sensitive fields` set to:
  - `Same as global`
  - `Always on`
  - `Off for site`

### Use The Element Picker

The element picker is available only while masking is enabled.

1. Open a normal webpage.
2. Turn masking on.
3. Click `Pick`.
4. Click an element on the page.
5. Save the generated selector as either:
   - a global selector, or
   - a selector for the current hostname.

The picker previews the mask before saving.

## What The Extension Detects

### Sensitive Fields

The extension auto-detects fields using:

- input types:
  - `password`
  - `email`
  - `tel`
- autocomplete values:
  - `current-password`
  - `new-password`
  - `one-time-code`
  - `cc-number`
  - `cc-csc`
  - `cc-exp`
  - `cc-exp-month`
  - `cc-exp-year`
  - `cc-name`
  - `email`
  - `tel`
- keyword checks in:
  - `name`
  - `id`
  - `aria-label`
  - `placeholder`
  - `data-testid`

Current keywords include:

- password
- pass
- secret
- token
- api
- key
- auth
- session
- ssn
- social
- credit
- card
- cvv
- cvc
- pin
- email
- e-mail
- mail
- phone
- tel

### Sensitive Text Nodes

The extension also scans visible text nodes and replaces matching text with masked equivalents.

Current text-pattern coverage is narrower than the field heuristics. In particular:

- plain-text emails are masked,
- several token/key formats are masked,
- generic plain-text phone numbers, SSNs, and card numbers do not currently have dedicated broad regex masking unless they are detected through field heuristics or targeted via selectors.

### Custom Selectors

Selectors are applied after built-in detection and are the most reliable way to handle site-specific edge cases.

## Architecture

### Content Script

Primary file: [`src/index.ts`](./src/index.ts)

Responsibilities:

- load current state from storage,
- apply masking early at `document_start`,
- monitor DOM mutations,
- re-run masking after SPA navigation,
- react to storage changes,
- restore masked content when masking is disabled.

Implementation details:

- DOM mutation work is batched with a `16ms` timeout.
- Sensitive text replacements are stored with reversible metadata so they can be restored later.
- Custom selectors and per-site selectors are both applied on every masking pass.

### Element Picker

Primary files:

- [`src/picker.ts`](./src/picker.ts)
- [`src/pickerRuntime.ts`](./src/pickerRuntime.ts)

Responsibilities:

- highlight the hovered element,
- generate a stable selector,
- preview the resulting mask,
- save the selector to global or per-site settings.

### Popup

Primary file: [`src/popup/index.ts`](./src/popup/index.ts)

Responsibilities:

- toggle masking,
- manage global selectors,
- manage per-site rules,
- toggle the global auto-detect setting,
- launch the picker,
- persist theme preference.

### Background Worker

Primary file: [`src/background.ts`](./src/background.ts)

Responsibilities:

- initialize default masking state on install,
- keep the toolbar icon in sync with masking state,
- react to storage changes.

### Shared Detection Utilities

Primary file: [`src/shared.ts`](./src/shared.ts)

Responsibilities:

- parse selectors safely,
- detect sensitive field metadata,
- collect text-pattern matches for masking.

## Development

### Commands

```bash
# Rebuild extension outputs
bun run build

# Watch src/public/assets and rebuild on change
bun run dev

# Package release artifacts into ./release
bun run pack

# Run automated tests
bun test

# Run tests in watch mode
bun run test:watch

# Serve the manual test page on http://localhost:4173
bun run test-page

# Format and lint
bunx @biomejs/biome check --write .
```

### Development Notes

- `bun run build` writes browser builds to:
  - [`build/`](./build)
  - [`build-firefox/`](./build-firefox)
- `bun run dev` watches `src`, `public`, and `assets`, then rebuilds when files change.
- The repo contains a small local WebSocket reload server in [`config/server.ts`](./config/server.ts), but the runtime docs should not assume full automatic extension reload behavior unless that workflow is wired into the browser setup being used.

### Tests

Automated tests cover:

- selector parsing,
- storage utilities and migration behavior,
- masking logic,
- popup picker availability,
- picker selector generation and lifecycle.

Test files live in [`src/__tests__/`](./src/__tests__).

### Manual Test Page

Use the local manual test page to verify masking behavior in a real browser session:

```bash
bun run test-page
```

Then open `http://localhost:4173` with the unpacked extension loaded.

## Limitations

- Cross-origin iframes cannot be inspected or masked by the content script.
- Sandboxed or browser-internal pages may block content scripts entirely.
- Plain-text detection is pattern-based and intentionally conservative; some sensitive text still requires explicit selectors.
- Large, highly dynamic pages can still trigger frequent reprocessing, even with mutation batching.

## Contributing

1. Create a branch for your change.
2. Keep formatting consistent with Biome.
3. Add or update tests when behavior changes.
4. Run `bun test` and manually verify the extension flow.
5. Open a pull request with a focused description of the change.

## Privacy

This extension:

- does not send webpage content to a server,
- does not include analytics or tracking,
- stores only user configuration in browser extension storage,
- performs masking locally in the browser.

See [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) for the full policy.

## License

MIT. See [`LICENSE`](./LICENSE).
