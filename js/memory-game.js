/* ============================================
   Memory Game Mode
   Match multiplication expressions with their
   answers by flipping cards in a 4x3 grid.
   ============================================ */

(function () {
  'use strict';

  var TOTAL_PAIRS = 6;

  var state = {
    config: null,
    container: null,
    cards: [],         // { id, type, pairId, content, flipped, matched }
    flippedCards: [],   // currently face-up (max 2)
    attempts: 0,
    pairsFound: 0,
    startTime: null,
    locked: false,      // prevent clicking while checking a pair
    timers: [],
    listeners: []
  };

  // --------------- Helpers ---------------

  function clearTimers() {
    state.timers.forEach(function (id) { clearTimeout(id); });
    state.timers = [];
  }

  function removeListeners() {
    state.listeners.forEach(function (entry) {
      entry.el.removeEventListener(entry.type, entry.fn);
    });
    state.listeners = [];
  }

  function addListener(el, type, fn) {
    el.addEventListener(type, fn);
    state.listeners.push({ el: el, type: type, fn: fn });
  }

  /** Shuffle an array in place (Fisher-Yates). */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  // --------------- Card Setup ---------------

  function buildCards(questions) {
    // Take up to TOTAL_PAIRS questions
    var selected = questions.slice(0, TOTAL_PAIRS);

    // If we have fewer than TOTAL_PAIRS, fill with generated questions
    while (selected.length < TOTAL_PAIRS) {
      var a = Math.floor(Math.random() * 10) + 1;
      var b = Math.floor(Math.random() * 10) + 1;
      selected.push({ a: a, b: b, answer: a * b });
    }

    var cards = [];
    selected.forEach(function (q, idx) {
      // Expression card
      cards.push({
        id: idx * 2,
        type: 'expression',
        pairId: idx,
        content: q.a + ' \u00d7 ' + q.b,
        flipped: false,
        matched: false
      });
      // Answer card
      cards.push({
        id: idx * 2 + 1,
        type: 'answer',
        pairId: idx,
        content: String(q.answer),
        flipped: false,
        matched: false
      });
    });

    return shuffle(cards);
  }

  // --------------- Rendering ---------------

  function renderUI() {
    state.container.innerHTML =
      '<h2 style="text-align:center;color:#6c5ce7;margin-bottom:8px;">Hukommelsesspil</h2>' +
      '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:16px;font-size:1.1rem;font-weight:700;">' +
        '<span id="mg-attempts">Fors\u00f8g: 0</span>' +
        '<span id="mg-pairs">Fundne par: 0 / ' + TOTAL_PAIRS + '</span>' +
      '</div>' +
      '<div id="mg-feedback" style="text-align:center;font-size:1.15rem;font-weight:700;min-height:1.6em;margin-bottom:12px;"></div>' +
      '<div class="memory-grid" id="mg-grid"></div>';

    renderCards();

    // Speak intro
    window.App.autoSpeak('Hukommelsesspil! Find de matchende par. Tryk p\u00e5 to kort for at vende dem.');
  }

  function renderCards() {
    var grid = document.getElementById('mg-grid');
    if (!grid) return;

    grid.innerHTML = '';

    state.cards.forEach(function (card) {
      var el = document.createElement('div');
      el.className = 'memory-card';
      el.setAttribute('data-card-id', card.id);

      if (card.matched) {
        el.classList.add('matched');
        el.textContent = card.content;
      } else if (card.flipped) {
        el.classList.add('flipped');
        el.textContent = card.content;
      } else {
        el.textContent = '\u2b50';
      }

      addListener(el, 'click', function () {
        handleCardClick(card.id);
      });

      grid.appendChild(el);
    });
  }

  function updateCounters() {
    var attEl = document.getElementById('mg-attempts');
    if (attEl) attEl.textContent = 'Fors\u00f8g: ' + state.attempts;

    var pairsEl = document.getElementById('mg-pairs');
    if (pairsEl) pairsEl.textContent = 'Fundne par: ' + state.pairsFound + ' / ' + TOTAL_PAIRS;
  }

  function showFeedback(msg, color) {
    var el = document.getElementById('mg-feedback');
    if (el) {
      el.textContent = msg;
      el.style.color = color || '#2d3436';
    }
  }

  function clearFeedback() {
    var el = document.getElementById('mg-feedback');
    if (el) el.textContent = '';
  }

  /** Update a single card element without re-rendering the entire grid. */
  function updateCardElement(card) {
    var el = state.container.querySelector('[data-card-id="' + card.id + '"]');
    if (!el) return;

    el.className = 'memory-card';
    if (card.matched) {
      el.classList.add('matched');
      el.textContent = card.content;
    } else if (card.flipped) {
      el.classList.add('flipped');
      el.textContent = card.content;
    } else {
      el.textContent = '\u2b50';
    }
  }

  // --------------- Game Logic ---------------

  function getCardById(id) {
    for (var i = 0; i < state.cards.length; i++) {
      if (state.cards[i].id === id) return state.cards[i];
    }
    return null;
  }

  function handleCardClick(cardId) {
    // Guard: locked, already matched, already flipped, or two cards open
    if (state.locked) return;

    var card = getCardById(cardId);
    if (!card || card.matched || card.flipped) return;
    if (state.flippedCards.length >= 2) return;

    // Flip the card
    card.flipped = true;
    state.flippedCards.push(card);
    updateCardElement(card);

    // If this is the second card, check for match
    if (state.flippedCards.length === 2) {
      state.attempts++;
      updateCounters();
      checkMatch();
    }
  }

  function checkMatch() {
    state.locked = true;

    var first = state.flippedCards[0];
    var second = state.flippedCards[1];

    if (first.pairId === second.pairId && first.type !== second.type) {
      // Match found
      first.matched = true;
      second.matched = true;
      state.pairsFound++;
      updateCounters();

      showFeedback('Rigtigt! \u2705', '#00b894');
      state.config.onCorrect();

      updateCardElement(first);
      updateCardElement(second);

      state.flippedCards = [];
      state.locked = false;

      var t1 = setTimeout(function () {
        clearFeedback();
      }, 1200);
      state.timers.push(t1);

      // Check if game is complete
      if (state.pairsFound === TOTAL_PAIRS) {
        var t2 = setTimeout(function () {
          endGame();
        }, 800);
        state.timers.push(t2);
      }
    } else {
      // No match
      showFeedback('Pr\u00f8v igen!', '#e17055');
      state.config.onWrong();

      var t3 = setTimeout(function () {
        first.flipped = false;
        second.flipped = false;
        updateCardElement(first);
        updateCardElement(second);
        state.flippedCards = [];
        state.locked = false;
        clearFeedback();
      }, 1500);
      state.timers.push(t3);
    }
  }

  function endGame() {
    var elapsed = Date.now() - state.startTime;

    showFeedback('Tillykke! Du fandt alle par! \ud83c\udf89', '#00b894');

    var t = setTimeout(function () {
      state.config.onComplete({
        correct: TOTAL_PAIRS,
        total: state.attempts,
        time: elapsed
      });
    }, 1200);
    state.timers.push(t);
  }

  // --------------- Module Registration ---------------

  window.GameModes = window.GameModes || {};
  window.GameModes['memory-game'] = {
    name: 'Hukommelsesspil',
    description: 'Find de matchende par af gangestykker og svar!',
    icon: '\ud83e\udde0',

    init: function (container, config) {
      state.container = container;
      state.config = config;
      state.cards = buildCards(config.questions);
      state.flippedCards = [];
      state.attempts = 0;
      state.pairsFound = 0;
      state.startTime = Date.now();
      state.locked = false;
      state.timers = [];
      state.listeners = [];

      renderUI();
    },

    cleanup: function () {
      clearTimers();
      removeListeners();
      state.container = null;
      state.config = null;
      state.cards = [];
      state.flippedCards = [];
      state.locked = false;
    }
  };
})();
