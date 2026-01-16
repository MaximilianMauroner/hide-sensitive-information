# Hide Sensitive Information

A Chrome extension that automatically detects and masks sensitive information like passwords, emails, credit cards, and tokens on any website. Keep your screen-shares and recordings private.

## Features

- **Automatic Detection**: Identifies sensitive fields including passwords, emails, tokens, credit cards, SSNs, and phone numbers
- **Custom CSS Selectors**: Add global and per-site custom selectors to mask specific elements
- **Real-time Masking**: Monitors dynamic content changes with MutationObserver for instant protection
- **Theme Switcher**: Light and dark mode support with persistent preferences
- **Chrome Storage Sync**: Settings synchronized across all your devices
- **SPA Navigation Support**: Detects client-side navigation (pushState/replaceState) and reapplies masking
- **Toggle On/Off**: Quickly enable or disable masking via the browser popup
- **Smart Detection**: Multiple detection methods including input types, autocomplete attributes, keyword matching, and regex patterns

## Installation

### For Developers

```bash
# Clone the repository
git clone https://github.com/yourusername/hide-sensitive-information.git
cd hide-sensitive-information

# Install dependencies
bun install

# Build the extension
bun run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `build/` directory from this project

## Usage

### Toggle Masking

Click the extension icon in your Chrome toolbar to open the popup, then click the toggle button to hide or show sensitive information on the current page.

### Add Custom Selectors

**Global Selectors** (applied to all websites):
1. Click the extension icon
2. Enter CSS selectors in the "Global selectors" field
3. Separate multiple selectors with commas or newlines
4. Click "Save"

Example:
```
.billing-email, input[name='api-token'], #credit-card-field
```

**Per-Site Selectors** (applied to specific domains):
1. Navigate to the website you want to configure
2. Click the extension icon
3. Click "Add site rule"
4. Enter CSS selectors for that specific site
5. Click "Save"

### Switch Themes

Click the theme toggle button in the popup to switch between light and dark mode. Your preference is saved automatically.

## Technical Architecture

### Content Script
**Location**: `src/index.ts`

The content script runs on all pages and is responsible for:
- Detecting sensitive input fields using multiple heuristics
- Masking sensitive information in real-time
- Monitoring DOM changes with MutationObserver (throttled at 10ms)
- Detecting SPA navigation by intercepting `history.pushState` and `history.replaceState`
- Processing visible viewport content first for better perceived performance
- Finding and masking email addresses in text nodes using regex

**Key Features**:
- Runs at `document_start` for earliest possible execution
- Uses `requestAnimationFrame` for efficient DOM updates
- Throttles mutation processing to prevent performance degradation
- Prioritizes viewport content before processing entire page

### Background Service Worker
**Location**: `src/background.ts`

Manages extension state and icon switching:
- Listens for state changes from the popup
- Updates the extension icon based on enabled/disabled state
- Broadcasts state changes to all active tabs

### Popup UI
**Location**: `src/popup/index.ts`

Interactive interface providing:
- Toggle button for enabling/disabling masking
- Global selector configuration
- Per-site selector management
- Theme switcher
- Visual feedback for save operations

### Utilities
**Location**: `src/utils.ts`

Chrome storage helpers including:
- `getIsHidden()` / `setIsHidden()` - Masking state
- `getCustomSelectors()` / `setCustomSelectors()` - Global selectors
- `getSiteSelectors()` / `setSiteSelectors()` - Per-site rules
- `getTheme()` / `setTheme()` - Theme preferences
- `getCurrentTab()` - Active tab helper

### Build System

Built with modern tooling:
- **Bun**: JavaScript runtime and build tool
- **TypeScript**: Type-safe code
- **Tailwind CSS**: Utility-first styling for popup UI
- **PostCSS**: CSS processing and optimization
- **Biome**: Fast linting and formatting

## Detection Methods

The extension uses multiple strategies to identify sensitive fields:

### 1. HTML Input Types
- `type="password"`
- `type="email"`
- `type="tel"`

### 2. HTML Autocomplete Attributes
- `current-password`, `new-password`
- `one-time-code`
- `cc-number`, `cc-csc`, `cc-exp`, `cc-exp-month`, `cc-exp-year`, `cc-name`
- `email`, `tel`

### 3. Keyword Matching
Searches for sensitive keywords in element attributes (`name`, `id`, `aria-label`, `placeholder`, `data-testid`):
- password, pass, secret
- token, api, key, auth, session
- ssn, social, credit, card, cvv, cvc, pin
- email, e-mail, mail
- phone, tel

### 4. Email Regex Pattern
Detects email addresses in:
- Input field values
- Textarea content
- Text nodes throughout the page

### 5. Custom CSS Selectors
User-defined selectors for edge cases and specific applications.

## Development

### Prerequisites
- [Bun](https://bun.sh) (latest version)
- Node.js 18+ (for compatibility)

### Development Commands

```bash
# Development with hot reload and websocket auto-refresh
bun run dev

# Build for production
bun run build

# Package for distribution (creates .zip file)
bun run pack

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Lint and format code
bunx @biomejs/biome check --write src/
```

### Hot Reload During Development

The `bun run dev` command:
1. Watches `src/` and `public/` directories for changes
2. Rebuilds the extension automatically
3. Sends reload signal via WebSocket server on port 8080
4. Content script listens for reload messages (if configured)

### Code Quality

This project uses [Biome](https://biomejs.dev) for linting and formatting:
- Enforces consistent code style
- Catches common errors
- Automatically formats on commit (if git hooks configured)

### Testing

Tests are written using Bun's built-in test runner:
- Unit tests for utility functions (src/__tests__/utils.test.ts)
- Selector parsing tests (src/__tests__/selectors.test.ts)
- Masking logic tests (src/__tests__/masking.test.ts)

Run tests with `bun test` or enable watch mode with `bun test --watch`.

## Configuration

### Storage Model
All settings are stored using Chrome's `chrome.storage.sync` API, which:
- Synchronizes across devices when signed into Chrome
- Persists data across browser sessions
- Has a limit of 100KB total storage

### Custom Selectors Format
- Comma-separated or newline-separated CSS selectors
- Standard CSS selector syntax (class, ID, attribute, pseudo-selectors, etc.)
- Invalid selectors are silently ignored

### Per-Site vs Global Rules
- **Global rules**: Applied to all websites
- **Per-site rules**: Only applied to matching hostnames
- Per-site rules do not override global rules; both are applied

### Theme Persistence
Theme preference is saved to Chrome storage and reapplied on popup open.

## Known Limitations

- **Sandboxed iframes**: Cannot access content inside sandboxed iframes due to browser security restrictions
- **Some dynamic content**: Certain edge cases with heavily dynamic content may require page refresh (e.g., StackOverflow Google login popup)
- **Performance**: Large pages with frequent DOM mutations may experience slight delays (mitigated by 10ms throttling)
- **Cross-origin iframes**: Cannot mask content in iframes from different origins

## Roadmap

### Completed
- [x] Move to TypeScript
- [x] Modern build system with Bun
- [x] Icon assets
- [x] Theme switcher

### Planned
- [ ] Publish to Chrome Web Store
- [ ] Firefox Add-ons support
- [ ] Fix iframe content masking where possible
- [ ] Performance optimizations for large pages
- [ ] Additional sensitive data patterns (IP addresses, MAC addresses, etc.)
- [ ] Import/export configuration
- [ ] Keyboard shortcuts

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow code style**: Use Biome for consistent formatting
   ```bash
   bunx @biomejs/biome check --write src/
   ```
3. **Write tests**: Add tests for new functionality in `src/__tests__/`
4. **Test thoroughly**: Ensure `bun test` passes and manually test the extension
5. **Submit a pull request** with a clear description of changes

### Development Workflow
```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes and test
bun run dev

# Run tests
bun test

# Format and lint
bunx @biomejs/biome check --write src/

# Commit and push
git add .
git commit -m "Add feature: description"
git push origin feature/your-feature-name
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Privacy

This extension:
- Does NOT collect or transmit any data
- Does NOT track user behavior
- Only stores configuration locally in Chrome storage
- Runs entirely offline after installation

All sensitive information processing happens locally in your browser.
