/* ============================================
   Long Division - Interactive Step-by-Step
   Visual pen-and-paper style with Danish voice
   explanations at every step.
   ============================================ */

(function () {
  'use strict';

  var CELL_SIZE = 44;

  var state = {
    dividend: 0,
    divisor: 0,
    digits: [],
    solution: null,
    currentIter: 0,
    currentPhase: 'divide',
    revealedQ: [],
    workRows: [],
    correct: 0,
    totalSteps: 0,
    startTime: null,
    config: null,
    container: null,
    timers: [],
    listeners: [],
    difficulty: 'easy' // 'easy' = 1-digit divisor, 'hard' = 2-digit divisor
  };

  function clearTimers() {
    state.timers.forEach(function (id) { clearTimeout(id); });
    state.timers = [];
  }

  function removeListeners() {
    state.listeners.forEach(function (e) {
      e.el.removeEventListener(e.type, e.fn);
    });
    state.listeners = [];
  }

  function addListener(el, type, fn) {
    el.addEventListener(type, fn);
    state.listeners.push({ el: el, type: type, fn: fn });
  }

  /* ---- TTS (uses shared App service) ---- */

  function speak(text) {
    window.AppSpeak(text);
  }

  /* ---- Problem generation ---- */

  // difficulty: 'easy' (1-digit divisor, 2-3 digit dividend)
  //             'hard' (2-digit divisor, 3-4 digit dividend)
  function generateProblem() {
    var difficulty = state.difficulty || 'easy';

    var divisor, dividend;

    if (difficulty === 'hard') {
      // 2-digit divisor (11-25), 3-4 digit dividend
      divisor = Math.floor(Math.random() * 15) + 11; // 11-25
      var numDigits = Math.random() < 0.4 ? 3 : 4;
      // Ensure the dividend is large enough so the quotient has numDigits - 1 or more digits
      var min = divisor * 2;
      var max = Math.pow(10, numDigits) - 1;
      if (min > max) min = Math.pow(10, numDigits - 1);
      dividend = Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      // 1-digit divisor (2-9), 2-3 digit dividend
      divisor = Math.floor(Math.random() * 8) + 2; // 2-9
      var numDigits2 = Math.random() < 0.4 ? 2 : 3;
      var firstDigit = Math.floor(Math.random() * (9 - divisor + 1)) + divisor;
      dividend = firstDigit;
      for (var i = 1; i < numDigits2; i++) {
        dividend = dividend * 10 + Math.floor(Math.random() * 10);
      }
    }

    return { dividend: dividend, divisor: divisor };
  }

  function computeSolution(dividend, divisor) {
    var digits = String(dividend).split('').map(Number);
    var iterations = [];
    var carry = 0;
    for (var i = 0; i < digits.length; i++) {
      var current = carry * 10 + digits[i];
      var qd = Math.floor(current / divisor);
      var prod = qd * divisor;
      var rem = current - prod;
      iterations.push({
        digitIndex: i,
        currentNumber: current,
        quotientDigit: qd,
        product: prod,
        remainder: rem
      });
      carry = rem;
    }
    var qStr = iterations.map(function (it) { return it.quotientDigit; }).join('');
    return {
      digits: digits,
      iterations: iterations,
      quotient: parseInt(qStr, 10),
      quotientStr: qStr,
      finalRemainder: carry
    };
  }

  /* ---- Explanations ---- */

  function getExplanation() {
    if (state.currentPhase === 'done') {
      var q = state.solution.quotient;
      var r = state.solution.finalRemainder;
      if (r === 0) {
        return 'Fantastisk! Vi er f\u00e6rdige! ' + state.dividend + ' divideret med ' + state.divisor + ' giver ' + q + '. Der er ingen rest!';
      }
      return 'Fantastisk! Vi er f\u00e6rdige! ' + state.dividend + ' divideret med ' + state.divisor + ' giver ' + q + ' med rest ' + r + '!';
    }

    var iter = state.solution.iterations[state.currentIter];

    switch (state.currentPhase) {
      case 'divide':
        if (state.currentIter === 0) {
          return 'Vi starter med det f\u00f8rste tal: ' + iter.currentNumber + '. Hvor mange gange kan ' + state.divisor + ' g\u00e5 op i ' + iter.currentNumber + '? T\u00e6nk p\u00e5 din ' + state.divisor + '-tabel!';
        }
        return 'Nu har vi tallet ' + iter.currentNumber + '. Hvor mange gange kan ' + state.divisor + ' g\u00e5 op i ' + iter.currentNumber + '?';
      case 'multiply':
        return 'Du skrev ' + iter.quotientDigit + ' \u2014 godt! Nu skal vi gange: Hvad er ' + iter.quotientDigit + ' gange ' + state.divisor + '?';
      case 'subtract':
        return 'Godt! Nu tr\u00e6kker vi fra: Hvad er ' + iter.currentNumber + ' minus ' + iter.product + '?';
      case 'bringdown':
        var nextDigit = state.digits[state.currentIter + 1];
        var newNum = iter.remainder * 10 + nextDigit;
        return 'Resten er ' + iter.remainder + '. Vi tager det n\u00e6ste ciffer ned: ' + nextDigit + '. S\u00e5 f\u00e5r vi tallet ' + newNum + '. Tryk N\u00e6ste for at forts\u00e6tte.';
    }
    return '';
  }

  function getStepLabel() {
    switch (state.currentPhase) {
      case 'divide': return 'Divid\u00e9r';
      case 'multiply': return 'Gang';
      case 'subtract': return 'Tr\u00e6k fra';
      case 'bringdown': return 'Tag ned';
      case 'done': return 'F\u00e6rdig!';
    }
    return '';
  }

  /* ---- Number placement helper ---- */

  function placeNumber(value, endCol, numCols) {
    var cells = [];
    for (var i = 0; i < numCols; i++) cells.push('');
    var digs = String(value).split('');
    var start = endCol - digs.length + 1;
    if (start < 0) start = 0;
    for (var j = 0; j < digs.length && start + j < numCols; j++) {
      cells[start + j] = digs[j];
    }
    return cells;
  }

  /* ---- Rendering ---- */

  function render() {
    removeListeners();
    var numCols = state.digits.length;
    var iter = state.currentPhase !== 'done' ? state.solution.iterations[state.currentIter] : null;

    // ---- Quotient cells ----
    var qCells = '';
    for (var i = 0; i < numCols; i++) {
      if (i < state.revealedQ.length) {
        qCells += '<div class="ld-cell ld-q-filled">' + state.revealedQ[i] + '</div>';
      } else if (iter && i === state.currentIter && state.currentPhase === 'divide') {
        qCells += '<div class="ld-cell ld-q-placeholder">?</div>';
      } else {
        qCells += '<div class="ld-cell ld-q-empty">\u00a0</div>';
      }
    }

    // ---- Dividend cells ----
    var dCells = '';
    for (var j = 0; j < numCols; j++) {
      var hlClass = '';
      if (iter && state.currentPhase === 'divide') {
        var nd = String(iter.currentNumber).length;
        var sc = iter.digitIndex - nd + 1;
        if (j >= sc && j <= iter.digitIndex) {
          hlClass = ' ld-d-highlight';
        }
      }
      dCells += '<div class="ld-cell ld-d-digit' + hlClass + '">' + state.digits[j] + '</div>';
    }

    // ---- Work rows ----
    var workHtml = '';
    state.workRows.forEach(function (row) {
      if (row.type === 'line') {
        var lw = (row.endCol - row.startCol + 1) * CELL_SIZE;
        var ll = row.startCol * CELL_SIZE;
        workHtml += '<div class="ld-work-line" style="margin-left:' + ll + 'px;width:' + lw + 'px;"></div>';
      } else {
        var placed = placeNumber(row.value, row.endCol, numCols);
        var rc = '';
        for (var k = 0; k < numCols; k++) {
          if (placed[k] !== '') {
            var cls = 'ld-cell ld-w-digit';
            if (row.highlight === 'subtract') cls += ' ld-w-subtract';
            if (row.highlight === 'result') cls += ' ld-w-result';
            if (row.highlight === 'bringdown') cls += ' ld-w-bringdown';
            rc += '<div class="' + cls + '">' + placed[k] + '</div>';
          } else {
            rc += '<div class="ld-cell ld-w-empty"></div>';
          }
        }
        workHtml += '<div class="ld-work-row">' + rc + '</div>';
      }
    });

    // ---- Explanation ----
    var explanation = getExplanation();
    var stepLabel = getStepLabel();

    // ---- Step indicator ----
    var phases = ['divide', 'multiply', 'subtract'];
    var stepDots = '';
    phases.forEach(function (p) {
      var cls = 'ld-step-dot';
      if (p === state.currentPhase) cls += ' ld-step-active';
      var label = p === 'divide' ? 'Divid\u00e9r' : p === 'multiply' ? 'Gang' : 'Tr\u00e6k fra';
      stepDots += '<span class="' + cls + '">' + label + '</span>';
    });

    // ---- Input area ----
    var inputHtml;
    if (state.currentPhase === 'bringdown') {
      inputHtml = '<button class="submit-btn" id="ld-next-btn">N\u00e6ste \u2192</button>';
    } else if (state.currentPhase === 'done') {
      inputHtml =
        '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">' +
          '<button class="btn-primary" id="ld-new-btn">Nyt regnestykke</button>' +
          '<button class="btn-secondary" id="ld-menu-btn">Tilbage til menu</button>' +
        '</div>';
    } else {
      inputHtml =
        '<form id="ld-form" autocomplete="off">' +
          '<div style="display:flex;align-items:center;justify-content:center;gap:12px;">' +
            '<input type="number" inputmode="numeric" class="answer-input" id="ld-input" autocomplete="off" style="width:100px;" />' +
            '<button type="submit" class="submit-btn">Svar</button>' +
          '</div>' +
        '</form>';
    }

    // ---- Difficulty toggle ----
    var diffHtml =
      '<div class="ld-toolbar">' +
        '<div class="ld-diff-toggle">' +
          '<button class="ld-diff-btn' + (state.difficulty === 'easy' ? ' ld-diff-active' : '') + '" data-diff="easy">1-cifret</button>' +
          '<button class="ld-diff-btn' + (state.difficulty === 'hard' ? ' ld-diff-active' : '') + '" data-diff="hard">2-cifret</button>' +
        '</div>' +
        '<button class="ld-skip-btn" id="ld-skip-btn">\u21bb Nyt stykke</button>' +
      '</div>';

    // ---- Full HTML ----
    state.container.innerHTML =
      '<div class="ld-container">' +
        diffHtml +
        // Paper area
        '<div class="ld-paper-wrap">' +
          '<div class="ld-problem-title">' + state.dividend + ' \u00f7 ' + state.divisor + '</div>' +
          '<div class="ld-frame">' +
            '<div class="ld-divisor-area">' +
              '<div class="ld-divisor-spacer"></div>' +
              '<div class="ld-divisor-num">' + state.divisor + '</div>' +
            '</div>' +
            '<div class="ld-main-area">' +
              '<div class="ld-quotient-row">' + qCells + '</div>' +
              '<div class="ld-bracket-content">' +
                '<div class="ld-dividend-row">' + dCells + '</div>' +
                '<div class="ld-work-area">' + workHtml + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        // Step panel
        '<div class="ld-step-panel">' +
          '<div class="ld-step-indicator">' +
            '<span class="ld-step-label">' + stepLabel + '</span>' +
            '<div class="ld-step-dots">' + stepDots + '</div>' +
          '</div>' +
          '<div class="ld-explain-box">' +
            '<p id="ld-explain-text">' + explanation + '</p>' +
            '<button class="ld-speak-btn" id="ld-voice-btn" title="H\u00f8r forklaring">\ud83d\udd0a</button>' +
          '</div>' +
          '<div class="ld-input-box">' + inputHtml + '</div>' +
          '<div id="ld-feedback" style="text-align:center;margin-top:10px;font-size:1.1rem;font-weight:700;min-height:1.4em;"></div>' +
        '</div>' +
      '</div>';

    // ---- Attach listeners ----

    // Difficulty buttons
    var diffBtns = state.container.querySelectorAll('.ld-diff-btn');
    diffBtns.forEach(function (btn) {
      addListener(btn, 'click', function () {
        var newDiff = btn.getAttribute('data-diff');
        if (newDiff !== state.difficulty) {
          state.difficulty = newDiff;
          startNewProblem();
        }
      });
    });

    // Skip / new problem button
    var skipBtn = document.getElementById('ld-skip-btn');
    if (skipBtn) addListener(skipBtn, 'click', startNewProblem);

    var voiceBtn = document.getElementById('ld-voice-btn');
    if (voiceBtn) addListener(voiceBtn, 'click', function () { speak(explanation); });

    if (state.currentPhase === 'bringdown') {
      var nb = document.getElementById('ld-next-btn');
      if (nb) {
        addListener(nb, 'click', handleBringdown);
        nb.focus();
        addListener(document, 'keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); handleBringdown(); }
        });
      }
    } else if (state.currentPhase === 'done') {
      var newBtn = document.getElementById('ld-new-btn');
      var menuBtn = document.getElementById('ld-menu-btn');
      if (newBtn) addListener(newBtn, 'click', startNewProblem);
      if (menuBtn) addListener(menuBtn, 'click', function () {
        state.config.onComplete({ correct: state.correct, total: state.totalSteps, time: Date.now() - state.startTime });
      });
    } else {
      var form = document.getElementById('ld-form');
      if (form) addListener(form, 'submit', handleSubmit);
      var input = document.getElementById('ld-input');
      if (input) setTimeout(function () { input.focus(); }, 60);
    }

    // Auto-speak (uses global toggle)
    window.App.autoSpeak(explanation);
  }

  /* ---- Interaction ---- */

  function handleSubmit(e) {
    e.preventDefault();
    var input = document.getElementById('ld-input');
    var feedback = document.getElementById('ld-feedback');
    if (!input) return;
    var val = input.value.trim();
    if (val === '') return;
    var userAnswer = parseInt(val, 10);
    if (isNaN(userAnswer)) return;

    var iter = state.solution.iterations[state.currentIter];
    var correctAnswer;
    switch (state.currentPhase) {
      case 'divide': correctAnswer = iter.quotientDigit; break;
      case 'multiply': correctAnswer = iter.product; break;
      case 'subtract': correctAnswer = iter.remainder; break;
    }

    input.disabled = true;
    var submitBtn = state.container.querySelector('.submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    state.totalSteps++;

    if (userAnswer === correctAnswer) {
      state.correct++;
      state.config.onCorrect();
      feedback.textContent = 'Rigtigt! \u2705';
      feedback.style.color = '#00b894';
      advancePhase();
      var t = setTimeout(function () { render(); }, 900);
      state.timers.push(t);
    } else {
      state.config.onWrong();
      feedback.textContent = 'Det rigtige svar er ' + correctAnswer + '. Husk det til n\u00e6ste gang!';
      feedback.style.color = '#e17055';
      advancePhase();
      var t2 = setTimeout(function () { render(); }, 2200);
      state.timers.push(t2);
    }
  }

  function advancePhase() {
    var iter = state.solution.iterations[state.currentIter];

    switch (state.currentPhase) {
      case 'divide':
        state.revealedQ.push(iter.quotientDigit);
        state.currentPhase = 'multiply';
        break;

      case 'multiply':
        state.workRows.push({
          type: 'number',
          value: iter.product,
          endCol: iter.digitIndex,
          highlight: 'subtract'
        });
        state.currentPhase = 'subtract';
        break;

      case 'subtract':
        var nd = String(iter.currentNumber).length;
        var sc = iter.digitIndex - nd + 1;
        state.workRows.push({ type: 'line', startCol: sc, endCol: iter.digitIndex });

        if (state.currentIter < state.solution.iterations.length - 1) {
          state.workRows.push({
            type: 'number',
            value: iter.remainder,
            endCol: iter.digitIndex,
            isRemainder: true
          });
          state.currentPhase = 'bringdown';
        } else {
          state.workRows.push({
            type: 'number',
            value: iter.remainder,
            endCol: iter.digitIndex,
            highlight: 'result'
          });
          state.currentPhase = 'done';
        }
        break;
    }
  }

  function handleBringdown() {
    var iter = state.solution.iterations[state.currentIter];
    var nextDigit = state.digits[state.currentIter + 1];
    var newValue = iter.remainder * 10 + nextDigit;

    // Update last work row to show the combined number
    var last = state.workRows[state.workRows.length - 1];
    if (last && last.isRemainder) {
      last.value = newValue;
      last.endCol = iter.digitIndex + 1;
      last.isRemainder = false;
      last.highlight = 'bringdown';
    }

    state.currentIter++;
    state.currentPhase = 'divide';
    render();
  }

  function startNewProblem() {
    var prob = generateProblem();
    state.dividend = prob.dividend;
    state.divisor = prob.divisor;
    state.digits = String(prob.dividend).split('').map(Number);
    state.solution = computeSolution(prob.dividend, prob.divisor);
    state.currentIter = 0;
    state.currentPhase = 'divide';
    state.revealedQ = [];
    state.workRows = [];
    render();
  }

  /* ---- Module registration ---- */

  window.GameModes = window.GameModes || {};
  window.GameModes['long-division'] = {
    name: 'Lang Division',
    description: 'L\u00e6r at dividere trin for trin \u2014 med forklaringer og lyd!',
    icon: '\u2797',
    skipTableSelector: true,

    init: function (container, config) {
      state.container = container;
      state.config = config;
      state.correct = 0;
      state.totalSteps = 0;
      state.startTime = Date.now();
      state.timers = [];
      state.listeners = [];

      startNewProblem();
    },

    cleanup: function () {
      clearTimers();
      removeListeners();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      state.container = null;
      state.config = null;
    }
  };
})();
