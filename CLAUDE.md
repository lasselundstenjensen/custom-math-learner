# Gangetabellerne - Math Practice App

Danish math practice app for 3rd graders. Single-page vanilla JS (no frameworks, no build tools). Open `index.html` in a browser to run.

## Architecture

- **`index.html`** - Entry point, loads all scripts
- **`js/app.js`** - Shared state (`window.AppState`), game mode registry (`window.GameModes`), and core app logic
- **`js/*.js`** - Each file registers one game mode via `window.GameModes`
- **`css/styles.css`** - All styles in one file

Game modes: fill-blank, multiple-choice, missing-factor, speed-challenge, memory-game, table-sequence, long-division, balloon-division.

## Conventions

- All UI text is in Danish
- TTS via Web Speech API (prefers macOS "Sara" voice)
- State persisted via localStorage
- No build step, no dependencies, no package.json
- Gold stars for correct answers, orange stars for mistakes

## Testing

No automated tests. Manual testing by opening `index.html` in a browser.
