/* ============================================
   Gangetabellerne - App Controller
   Main application logic for the multiplication
   tables practice app.
   ============================================ */

// --------------- Global State ---------------
window.AppState = {
  totalStars: 0,
  selectedTable: null, // number 1-10 or 'mix'
  currentMode: null,   // key string of active game mode
  scores: {}           // per-mode high scores: { modeKey: { best: n, lastPlayed: date } }
};

// --------------- Game Mode Registry ---------------
window.GameModes = {};

// --------------- Encouraging footer messages ---------------
const footerMessages = [
  'Du er fantastisk! Bliv ved med at lære!',
  'Matematik er sjovt - du klarer det!',
  'Hver stjerne gør dig klogere!',
  'Øvelse gør mester!',
  'Du bliver bedre og bedre!',
  'Godt gået - fortsæt!',
  'Tal er dine venner!',
  'Du er en sand regnehelt!'
];

// --------------- TTS (shared) ---------------
window.AppState.autoVoice = true;

(function () {
  var cachedVoice = null;

  function findDanishVoice() {
    if (cachedVoice) return cachedVoice;
    var voices = speechSynthesis.getVoices();
    var candidates = [];
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if (v.lang && (v.lang === 'da-DK' || v.lang === 'da_DK' || v.lang === 'da')) {
        candidates.push(v);
      }
    }
    if (candidates.length === 0) return null;
    // Prefer macOS "Sara" voice
    for (var j = 0; j < candidates.length; j++) {
      if (candidates[j].name && candidates[j].name.indexOf('Sara') !== -1) {
        cachedVoice = candidates[j];
        return cachedVoice;
      }
    }
    // Prefer local (native) voices over network
    for (var k = 0; k < candidates.length; k++) {
      if (candidates[k].localService) {
        cachedVoice = candidates[k];
        return cachedVoice;
      }
    }
    cachedVoice = candidates[0];
    return cachedVoice;
  }

  window.AppSpeak = function (text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'da-DK';
    u.rate = 0.9;
    var voice = findDanishVoice();
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  };

  // Preload voices
  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = function () {
        cachedVoice = null;
        speechSynthesis.getVoices();
      };
    }
  }
})();

// --------------- App Controller ---------------
window.App = {

  /** Initialise the app on page load */
  init() {
    this.loadState();
    this.updateStarDisplay();
    this.rotateFooterMessage();
    this.showMenu();
  },

  // ========== PERSISTENCE ==========

  /** Load persisted state from localStorage */
  loadState() {
    try {
      const saved = localStorage.getItem('gangetabeller_state');
      if (saved) {
        const data = JSON.parse(saved);
        window.AppState.totalStars = data.totalStars || 0;
        window.AppState.scores = data.scores || {};
      }
    } catch (_) { /* ignore parse errors */ }
  },

  /** Persist state to localStorage */
  saveState() {
    try {
      localStorage.setItem('gangetabeller_state', JSON.stringify({
        totalStars: window.AppState.totalStars,
        scores: window.AppState.scores
      }));
    } catch (_) { /* storage full or disabled */ }
  },

  // ========== NAVIGATION ==========

  /** Show the main menu with game mode cards */
  showMenu() {
    window.AppState.currentMode = null;
    const main = document.getElementById('main-content');

    const modeKeys = Object.keys(window.GameModes);

    let cardsHtml = '';
    modeKeys.forEach(function (key) {
      const mode = window.GameModes[key];
      cardsHtml += `
        <div class="game-card" data-mode="${key}" tabindex="0" role="button" aria-label="${mode.name}">
          <span class="card-icon">${mode.icon || '🎮'}</span>
          <div class="card-title">${mode.name}</div>
          <div class="card-desc">${mode.description}</div>
        </div>
      `;
    });

    if (modeKeys.length === 0) {
      cardsHtml = '<p class="text-center" style="grid-column:1/-1">Spiltyper indlæses...</p>';
    }

    main.innerHTML = `
      <div class="menu-screen">
        <h2>Vælg en leg!</h2>
        <p class="subtitle">Tryk på en leg for at komme i gang</p>
        <div class="game-modes-grid">
          ${cardsHtml}
        </div>
      </div>
    `;

    // Attach click listeners to cards
    main.querySelectorAll('.game-card').forEach(function (card) {
      card.addEventListener('click', function () {
        const modeKey = card.getAttribute('data-mode');
        const mode = window.GameModes[modeKey];
        if (mode && mode.skipTableSelector) {
          window.App.startGame(modeKey, 'mix');
        } else {
          window.App.showTableSelector(modeKey);
        }
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  },

  /** Show the table selector grid for a specific game mode */
  showTableSelector(modeKey) {
    window.AppState.currentMode = modeKey;
    const main = document.getElementById('main-content');
    const mode = window.GameModes[modeKey];

    let buttonsHtml = '';
    for (let i = 1; i <= 10; i++) {
      buttonsHtml += `<button class="table-btn" data-table="${i}">${i}</button>`;
    }
    // "Blandet" (mix) button spans 2 columns
    buttonsHtml += `<button class="table-btn mix-btn" data-table="mix">Blandet</button>`;

    main.innerHTML = `
      <div class="table-selector">
        <h2>${mode ? mode.name : 'Spil'}</h2>
        <p class="subtitle">Hvilken tabel vil du øve?</p>
        <div class="table-grid">
          ${buttonsHtml}
        </div>
        <button class="back-btn" id="back-to-menu">&#8592; Tilbage</button>
      </div>
    `;

    // Table button listeners
    main.querySelectorAll('.table-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tableVal = btn.getAttribute('data-table');
        const table = tableVal === 'mix' ? 'mix' : parseInt(tableVal, 10);
        window.App.startGame(modeKey, table);
      });
    });

    // Back button
    document.getElementById('back-to-menu').addEventListener('click', function () {
      window.App.showMenu();
    });
  },

  /** Start a game round */
  startGame(modeKey, table) {
    window.AppState.selectedTable = table;
    window.AppState.currentMode = modeKey;

    const main = document.getElementById('main-content');
    main.innerHTML =
      '<div class="game-topbar">' +
        '<button class="back-btn" id="game-back-btn">&#8592; Tilbage</button>' +
        '<label class="voice-toggle">' +
          '<input type="checkbox" id="auto-voice-chk" ' + (window.AppState.autoVoice ? 'checked' : '') + ' /> ' +
          '\ud83d\udd0a Opl\u00e6sning' +
        '</label>' +
      '</div>' +
      '<div class="game-screen" id="game-container"></div>';

    document.getElementById('auto-voice-chk').addEventListener('change', function () {
      window.AppState.autoVoice = this.checked;
      if (!this.checked && 'speechSynthesis' in window) speechSynthesis.cancel();
    });

    document.getElementById('game-back-btn').addEventListener('click', function () {
      // Cleanup current game mode
      const currentMode = window.GameModes[modeKey];
      if (currentMode && typeof currentMode.cleanup === 'function') {
        currentMode.cleanup();
      }
      window.App.showMenu();
    });

    const container = document.getElementById('game-container');

    const questions = this.getQuestions(table, 10);

    const config = {
      table: table,
      questions: questions,
      onCorrect: function () {
        window.App.addStars(1);
        window.App.showFeedback(true);
      },
      onWrong: function () {
        window.App.showFeedback(false);
      },
      onComplete: function (stats) {
        window.App.endGame(stats);
      }
    };

    const mode = window.GameModes[modeKey];
    if (mode && typeof mode.init === 'function') {
      mode.init(container, config);
    }
  },

  /** Show end-of-round results */
  endGame(stats) {
    const main = document.getElementById('main-content');
    const correct = stats.correct || 0;
    const total = stats.total || 10;
    const pct = Math.round((correct / total) * 100);
    const timeStr = stats.time != null ? Math.round(stats.time / 1000) : null;

    // Determine message
    let message, icon;
    if (pct === 100) {
      message = 'Fantastisk! Du er en gangemester! 🌟';
      icon = '🏆';
      this.showConfetti();
    } else if (pct >= 80) {
      message = 'Rigtig flot! Du er næsten i mål! ⭐';
      icon = '🌟';
    } else if (pct >= 60) {
      message = 'Godt gået! Øv dig lidt mere! 💪';
      icon = '💪';
    } else {
      message = 'Bliv ved med at øve! Du kan gøre det! 🎯';
      icon = '🎯';
    }

    // Star display
    const starsHtml = '⭐'.repeat(correct);

    // Save high score
    const modeKey = window.AppState.currentMode;
    if (!window.AppState.scores[modeKey] || correct > (window.AppState.scores[modeKey].best || 0)) {
      window.AppState.scores[modeKey] = { best: correct, lastPlayed: new Date().toISOString() };
    }
    this.saveState();

    let timeRow = '';
    if (timeStr != null) {
      timeRow = `
        <div class="stat-row">
          <span class="stat-label">Tid</span>
          <span class="stat-value">${timeStr} sek</span>
        </div>
      `;
    }

    main.innerHTML = `
      <div class="result-screen">
        <span class="result-icon">${icon}</span>
        <h2>Resultat</h2>
        <p class="result-message">${message}</p>
        <div class="result-stats">
          <div class="stat-row">
            <span class="stat-label">Rigtige</span>
            <span class="stat-value">${correct} / ${total}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Procent</span>
            <span class="stat-value">${pct}%</span>
          </div>
          ${timeRow}
          <div class="stat-row">
            <span class="stat-label">Stjerner optjent</span>
            <span class="stat-value">${correct} ⭐</span>
          </div>
        </div>
        <div class="result-stars star-burst">${starsHtml}</div>
        <div class="result-actions">
          <button class="btn-primary" id="retry-btn">Prøv igen</button>
          <button class="btn-secondary" id="menu-btn">Vælg en anden leg</button>
        </div>
      </div>
    `;

    document.getElementById('retry-btn').addEventListener('click', function () {
      window.App.startGame(window.AppState.currentMode, window.AppState.selectedTable);
    });

    document.getElementById('menu-btn').addEventListener('click', function () {
      window.App.showMenu();
    });
  },

  // ========== STARS ==========

  /** Add stars and animate the counter */
  addStars(count) {
    window.AppState.totalStars += count;
    this.updateStarDisplay();
    this.saveState();

    // Trigger pulse animation on the star counter
    const counter = document.getElementById('star-counter');
    counter.classList.remove('pulse-active');
    // Force reflow to restart animation
    void counter.offsetWidth;
    counter.classList.add('pulse-active');
  },

  /** Update the star counter display */
  updateStarDisplay() {
    const el = document.getElementById('star-count');
    if (el) {
      el.textContent = window.AppState.totalStars;
    }
  },

  // ========== QUESTION GENERATOR ==========

  /**
   * Generate multiplication questions.
   * @param {number|string} table - The table number (1-10) or 'mix' for random.
   * @param {number} count - How many questions to generate.
   * @returns {Array<{a: number, b: number, answer: number}>}
   */
  getQuestions(table, count) {
    const questions = [];
    const used = new Set();

    while (questions.length < count) {
      let a, b;
      if (table === 'mix') {
        a = Math.floor(Math.random() * 10) + 1;
        b = Math.floor(Math.random() * 10) + 1;
      } else {
        a = table;
        b = Math.floor(Math.random() * 10) + 1;
      }

      // Try to avoid duplicates if possible (but don't loop forever)
      const key = a + 'x' + b;
      if (used.has(key) && used.size < (table === 'mix' ? 100 : 10)) {
        continue;
      }
      used.add(key);

      questions.push({ a: a, b: b, answer: a * b });
    }

    return questions;
  },

  // ========== VOICE ==========

  /** Speak text if auto-voice is enabled */
  autoSpeak(text) {
    if (window.AppState.autoVoice && text) {
      window.AppSpeak(text);
    }
  },

  // ========== FEEDBACK ==========

  /** Show a quick feedback overlay (checkmark or cross) */
  showFeedback(isCorrect) {
    const overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    overlay.textContent = isCorrect ? '✅' : '❌';
    document.body.appendChild(overlay);

    setTimeout(function () {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 900);
  },

  // ========== CONFETTI ==========

  /** Trigger a confetti celebration */
  showConfetti() {
    const container = document.getElementById('confetti-container');
    const colors = ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#00b894', '#a29bfe', '#fd79a8', '#ffeaa7'];
    const pieceCount = 60;

    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.top = '-10px';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 1.2) + 's';
      piece.style.animationDuration = (1.8 + Math.random() * 1.5) + 's';
      piece.style.width = (8 + Math.random() * 10) + 'px';
      piece.style.height = (8 + Math.random() * 10) + 'px';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '3px';
      container.appendChild(piece);
    }

    // Clean up after animations
    setTimeout(function () {
      container.innerHTML = '';
    }, 4000);
  },

  // ========== FOOTER ==========

  /** Rotate encouraging footer messages */
  rotateFooterMessage() {
    const el = document.getElementById('footer-message');
    if (!el) return;

    setInterval(function () {
      const msg = footerMessages[Math.floor(Math.random() * footerMessages.length)];
      el.style.opacity = '0';
      setTimeout(function () {
        el.textContent = msg;
        el.style.opacity = '1';
      }, 300);
    }, 8000);
  }
};

// --------------- Boot ---------------
document.addEventListener('DOMContentLoaded', function () {
  window.App.init();
});
