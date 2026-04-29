/* ============================================
   Balloon Division (Ballonmetoden)
   Interactive digit-by-digit division with
   the Danish balloon visual. The student can
   choose ANY valid multiplier at each step
   (not just the maximum), making the method
   more forgiving than standard long division.
   ============================================ */

(function () {
  'use strict';

  var state = {
    dividend: 0,
    divisor: 0,
    digits: [],          // individual digits of dividend
    nextDigitIdx: 0,     // index of next digit to bring down
    currentNumber: 0,    // the number currently being divided
    quotientAcc: 0,      // accumulated quotient (tracks place value)
    rows: [],            // completed rows: { number, multiplier, product, remainder, bringdownAfter }
    currentPhase: 'divide',  // 'divide' | 'bringdown' | 'done'
    bringdownInfo: null, // { remainder, digit, newNumber, digitIdx } for bringdown display
    finalRemainder: 0,
    correct: 0,
    totalSteps: 0,
    startTime: null,
    config: null,
    container: null,
    timers: [],
    listeners: [],
    difficulty: 'easy'
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

  function speak(text) {
    window.AppSpeak(text);
  }

  /* ---- Problem generation ---- */

  function generateProblem() {
    var difficulty = state.difficulty || 'easy';
    var divisor, dividend;

    if (difficulty === 'hard') {
      divisor = Math.floor(Math.random() * 15) + 11;
      var numDigits = Math.random() < 0.4 ? 3 : 4;
      var min = divisor * 2;
      var max = Math.pow(10, numDigits) - 1;
      if (min > max) min = Math.pow(10, numDigits - 1);
      dividend = Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      divisor = Math.floor(Math.random() * 8) + 2;
      var numDigits2 = Math.random() < 0.4 ? 2 : 3;
      var firstDigit = Math.floor(Math.random() * (9 - divisor + 1)) + divisor;
      dividend = firstDigit;
      for (var i = 1; i < numDigits2; i++) {
        dividend = dividend * 10 + Math.floor(Math.random() * 10);
      }
    }

    return { dividend: dividend, divisor: divisor };
  }

  /* ---- Explanations ---- */

  function getExplanation() {
    if (state.currentPhase === 'done') {
      var q = state.quotientAcc;
      var r = state.finalRemainder;
      if (r === 0) {
        return 'Fantastisk! ' + state.dividend + ' divideret med ' + state.divisor + ' giver ' + q + '. Der er ingen rest!';
      }
      return 'Fantastisk! ' + state.dividend + ' divideret med ' + state.divisor + ' giver ' + q + ' med rest ' + r + '!';
    }

    if (state.currentPhase === 'bringdown') {
      var info = state.bringdownInfo;
      var lastRow = state.rows[state.rows.length - 1];
      return lastRow.multiplier + ' gange ' + state.divisor + ' er ' + lastRow.product +
        '. Rest: ' + lastRow.number + ' minus ' + lastRow.product + ' er ' + lastRow.remainder +
        '. Vi tager n\u00e6ste ciffer (' + info.digit + ') ned til ' + lastRow.remainder +
        ' og f\u00e5r ' + info.newNumber + '. Tryk N\u00e6ste!';
    }

    // divide phase
    if (state.rows.length === 0) {
      return 'Vi starter! Hvor mange gange g\u00e5r ' + state.divisor + ' op i ' + state.currentNumber +
        '? V\u00e6lg et tal \u2014 du beh\u00f8ver ikke v\u00e6lge det st\u00f8rste!';
    }

    var lastRow = state.rows[state.rows.length - 1];
    if (lastRow.remainder >= state.divisor) {
      // Continuing same number (student picked less than max)
      return 'Resten er ' + state.currentNumber + '. ' + state.divisor +
        ' kan stadig g\u00e5 op i ' + state.currentNumber + ' \u2014 hvor mange gange?';
    }

    return 'Nu har vi ' + state.currentNumber + '. Hvor mange gange g\u00e5r ' + state.divisor + ' op i ' + state.currentNumber + '?';
  }

  /* ---- Valid option buttons (1 through max, never 0 when divisor fits) ---- */

  function getValidOptions(currentNumber, divisor) {
    var maxMult = Math.floor(currentNumber / divisor);
    var options = [];
    for (var i = 1; i <= maxMult; i++) {
      options.push(i);
    }
    return options;
  }

  /* ---- Rendering ---- */

  function render() {
    removeListeners();

    var explanation = getExplanation();

    // ---- Build the stem rows from completed rows ----
    var rowsHtml = '';
    for (var i = 0; i < state.rows.length; i++) {
      var row = state.rows[i];

      // Left: the number being divided
      var leftClass = 'bd-left-num';

      // Right: the multiplier chosen
      var rightClass = 'bd-right-digit bd-digit-filled';

      rowsHtml +=
        '<div class="bd-stem-row">' +
          '<div class="' + leftClass + '">' + row.number + '</div>' +
          '<div class="bd-stem-line"></div>' +
          '<div class="' + rightClass + '">' + row.multiplier + '</div>' +
        '</div>';

      // Underline after rows where a bringdown happened (remainder < divisor)
      if (row.bringdownAfter) {
        rowsHtml += '<div class="bd-stem-row bd-row-separator"><div class="bd-row-line-left"></div><div class="bd-stem-line"></div><div class="bd-row-line-right"></div></div>';
      }
    }

    // Current row (divide phase) or bringdown row
    if (state.currentPhase === 'divide') {
      rowsHtml +=
        '<div class="bd-stem-row">' +
          '<div class="bd-left-num bd-current-highlight">' + state.currentNumber + '</div>' +
          '<div class="bd-stem-line"></div>' +
          '<div class="bd-right-digit bd-digit-placeholder">?</div>' +
        '</div>';
    } else if (state.currentPhase === 'bringdown') {
      rowsHtml +=
        '<div class="bd-stem-row">' +
          '<div class="bd-left-num bd-bringdown-highlight">' + state.bringdownInfo.newNumber + '</div>' +
          '<div class="bd-stem-line"></div>' +
          '<div class="bd-right-digit"></div>' +
        '</div>';
    }

    // In bringdown phase, show the annotation
    var annotationHtml = '';
    if (state.currentPhase === 'bringdown') {
      var lastRow = state.rows[state.rows.length - 1];
      var info = state.bringdownInfo;
      annotationHtml =
        '<div class="bd-annotation">' +
          '<div class="bd-annotation-calc">' +
            '<span class="bd-anno-step">' + lastRow.multiplier + ' \u00d7 ' + state.divisor + ' = ' + lastRow.product + '</span>' +
            '<span class="bd-anno-arrow">\u2192</span>' +
            '<span class="bd-anno-step">' + lastRow.number + ' \u2212 ' + lastRow.product + ' = <strong>' + lastRow.remainder + '</strong></span>' +
          '</div>' +
          '<div class="bd-annotation-bring">' +
            'Tag <span class="bd-digit-bring">' + info.digit + '</span> ned \u2192 <strong>' + info.newNumber + '</strong>' +
          '</div>' +
        '</div>';
    }

    // ---- Answer display ----
    var answerHtml = '';
    if (state.currentPhase === 'done') {
      var q = state.quotientAcc;
      var r = state.finalRemainder;
      answerHtml = '<div class="bd-answer">' + state.dividend + ' : ' + state.divisor + ' = <strong>' + q + '</strong>';
      if (r > 0) answerHtml += ' <span class="bd-answer-rest">rest ' + r + '</span>';
      answerHtml += '</div>';
    }

    // ---- Input area ----
    var inputHtml = '';

    if (state.currentPhase === 'divide') {
      var options = getValidOptions(state.currentNumber, state.divisor);
      inputHtml = '<div class="bd-options">';
      options.forEach(function (opt) {
        inputHtml += '<button class="bd-option-btn" data-val="' + opt + '">' + opt + '</button>';
      });
      inputHtml += '</div>';
    } else if (state.currentPhase === 'bringdown') {
      inputHtml = '<button class="submit-btn" id="bd-next-btn">N\u00e6ste \u2192</button>';
    } else if (state.currentPhase === 'done') {
      inputHtml =
        '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">' +
          '<button class="btn-primary" id="bd-new-btn">Nyt regnestykke</button>' +
          '<button class="btn-secondary" id="bd-menu-btn">Tilbage til menu</button>' +
        '</div>';
    }

    // ---- Difficulty toggle ----
    var diffHtml =
      '<div class="bd-toolbar">' +
        '<div class="bd-diff-toggle">' +
          '<button class="bd-diff-btn' + (state.difficulty === 'easy' ? ' bd-diff-active' : '') + '" data-diff="easy">1-cifret</button>' +
          '<button class="bd-diff-btn' + (state.difficulty === 'hard' ? ' bd-diff-active' : '') + '" data-diff="hard">2-cifret</button>' +
        '</div>' +
        '<button class="bd-skip-btn" id="bd-skip-btn">\u21bb Nyt stykke</button>' +
      '</div>';

    // ---- Problem title ----
    var titleHtml;
    if (state.currentPhase === 'done') {
      titleHtml = answerHtml;
    } else if (state.currentPhase === 'bringdown') {
      // Highlight the digit being brought down in the dividend
      var dividendStr = String(state.dividend);
      var highlightIdx = state.bringdownInfo.digitIdx;
      var titleDigits = '';
      for (var d = 0; d < dividendStr.length; d++) {
        if (d === highlightIdx) {
          titleDigits += '<span class="bd-digit-bring">' + dividendStr[d] + '</span>';
        } else {
          titleDigits += dividendStr[d];
        }
      }
      titleHtml = '<div class="bd-problem-title">' + titleDigits + ' : ' + state.divisor + ' = ???</div>';
    } else {
      titleHtml = '<div class="bd-problem-title">' + state.dividend + ' : ' + state.divisor + ' = ???</div>';
    }

    // ---- Progress label ----
    var progressLabel;
    if (state.currentPhase === 'done') {
      progressLabel = 'F\u00e6rdig!';
    } else {
      var digitsLeft = state.digits.length - state.nextDigitIdx;
      progressLabel = 'Ciffer ' + state.nextDigitIdx + ' af ' + state.digits.length;
    }

    // ---- Full HTML ----
    state.container.innerHTML =
      '<div class="bd-container">' +
        diffHtml +
        '<div class="bd-paper-wrap">' +
          titleHtml +
          '<div class="bd-balloon-visual">' +
            '<div class="bd-balloon-shape">' + state.divisor + '</div>' +
            '<div class="bd-stem-connector"></div>' +
            '<div class="bd-stem-area">' + rowsHtml + '</div>' +
          '</div>' +
          annotationHtml +
        '</div>' +
        '<div class="bd-step-panel">' +
          '<div class="bd-step-indicator">' +
            '<span class="bd-step-label">' + progressLabel + '</span>' +
            '<div class="bd-progress-dots">' + buildProgressDots() + '</div>' +
          '</div>' +
          '<div class="bd-explain-box">' +
            '<p id="bd-explain-text">' + explanation + '</p>' +
            '<button class="bd-speak-btn" id="bd-voice-btn" title="H\u00f8r forklaring">\ud83d\udd0a</button>' +
          '</div>' +
          '<div class="bd-input-box">' + inputHtml + '</div>' +
          '<div id="bd-feedback" style="text-align:center;margin-top:10px;font-size:1.1rem;font-weight:700;min-height:1.4em;"></div>' +
        '</div>' +
      '</div>';

    // ---- Attach listeners ----

    // Difficulty buttons
    var diffBtns = state.container.querySelectorAll('.bd-diff-btn');
    diffBtns.forEach(function (btn) {
      addListener(btn, 'click', function () {
        var newDiff = btn.getAttribute('data-diff');
        if (newDiff !== state.difficulty) {
          state.difficulty = newDiff;
          startNewProblem();
        }
      });
    });

    // Skip button
    var skipBtn = document.getElementById('bd-skip-btn');
    if (skipBtn) addListener(skipBtn, 'click', startNewProblem);

    // Voice button
    var voiceBtn = document.getElementById('bd-voice-btn');
    if (voiceBtn) addListener(voiceBtn, 'click', function () { speak(explanation); });

    if (state.currentPhase === 'divide') {
      var optBtns = state.container.querySelectorAll('.bd-option-btn');
      optBtns.forEach(function (btn) {
        addListener(btn, 'click', function () {
          var val = parseInt(btn.getAttribute('data-val'), 10);
          handleAnswer(val);
        });
      });
    } else if (state.currentPhase === 'bringdown') {
      var nb = document.getElementById('bd-next-btn');
      if (nb) {
        addListener(nb, 'click', handleBringdown);
        nb.focus();
        addListener(document, 'keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); handleBringdown(); }
        });
      }
    } else if (state.currentPhase === 'done') {
      var newBtn = document.getElementById('bd-new-btn');
      var menuBtn = document.getElementById('bd-menu-btn');
      if (newBtn) addListener(newBtn, 'click', startNewProblem);
      if (menuBtn) addListener(menuBtn, 'click', function () {
        state.config.onComplete({ correct: state.correct, total: state.totalSteps, time: Date.now() - state.startTime });
      });
    }

    // Auto-speak
    window.App.autoSpeak(explanation);
  }

  function buildProgressDots() {
    var html = '';
    for (var i = 0; i < state.digits.length; i++) {
      var cls = 'bd-progress-dot';
      if (i < state.nextDigitIdx) {
        cls += ' bd-dot-done';
      } else if (i === state.nextDigitIdx - 1 || (i === 0 && state.nextDigitIdx === 0)) {
        // Not useful here; keep simple
      }
      html += '<span class="' + cls + '"></span>';
    }
    return html;
  }

  /* ---- Interaction ---- */

  function handleAnswer(val) {
    var product = val * state.divisor;
    var remainder = state.currentNumber - product;
    var feedback = document.getElementById('bd-feedback');

    // Disable all option buttons
    var btns = state.container.querySelectorAll('.bd-option-btn');
    btns.forEach(function (b) { b.disabled = true; });

    // Every valid pick is correct in the balloon method
    state.totalSteps++;
    state.correct++;
    state.config.onCorrect();

    if (feedback) {
      feedback.textContent = 'Godt valgt! ' + val + ' gange ' + state.divisor + ' = ' + product + ', rest ' + remainder + ' \u2705';
      feedback.style.color = '#00b894';
    }

    // Highlight the chosen button
    btns.forEach(function (b) {
      if (parseInt(b.getAttribute('data-val'), 10) === val) {
        b.classList.add('bd-option-correct');
      }
    });

    // Update quotient accumulator
    state.quotientAcc += val;

    // Record this row
    var row = {
      number: state.currentNumber,
      multiplier: val,
      product: product,
      remainder: remainder,
      bringdownAfter: false
    };
    state.rows.push(row);

    // Determine next phase
    if (remainder >= state.divisor) {
      // Remainder still large enough to divide — stay on same number, no bringdown
      state.currentNumber = remainder;
      state.currentPhase = 'divide';
    } else if (state.nextDigitIdx < state.digits.length) {
      // Need to bring down next digit
      row.bringdownAfter = true;
      var nextDigit = state.digits[state.nextDigitIdx];
      var newNumber = remainder * 10 + nextDigit;
      state.bringdownInfo = {
        remainder: remainder,
        digit: nextDigit,
        digitIdx: state.nextDigitIdx,
        newNumber: newNumber
      };
      state.currentPhase = 'bringdown';
    } else {
      // No more digits — done
      state.finalRemainder = remainder;
      state.currentPhase = 'done';
    }

    var t = setTimeout(function () { render(); }, 900);
    state.timers.push(t);
  }

  function handleBringdown() {
    var info = state.bringdownInfo;
    state.quotientAcc *= 10;
    state.currentNumber = info.newNumber;
    state.nextDigitIdx++;

    // Auto-bring-down if number is still smaller than divisor
    while (state.currentNumber < state.divisor && state.nextDigitIdx < state.digits.length) {
      var nextDigit = state.digits[state.nextDigitIdx];
      state.quotientAcc *= 10;
      state.currentNumber = state.currentNumber * 10 + nextDigit;
      state.nextDigitIdx++;
    }

    if (state.currentNumber < state.divisor && state.nextDigitIdx >= state.digits.length) {
      // Can't divide further
      state.finalRemainder = state.currentNumber;
      state.currentPhase = 'done';
    } else {
      state.currentPhase = 'divide';
    }

    state.bringdownInfo = null;
    render();
  }

  function startNewProblem() {
    var prob = generateProblem();
    state.dividend = prob.dividend;
    state.divisor = prob.divisor;
    state.digits = String(prob.dividend).split('').map(Number);
    state.nextDigitIdx = 1; // first digit is taken immediately
    state.currentNumber = state.digits[0];
    state.quotientAcc = 0;
    state.rows = [];
    state.currentPhase = 'divide';
    state.bringdownInfo = null;
    state.finalRemainder = 0;

    // If first digit is smaller than divisor, auto-bring-down
    while (state.currentNumber < state.divisor && state.nextDigitIdx < state.digits.length) {
      state.quotientAcc *= 10;
      state.currentNumber = state.currentNumber * 10 + state.digits[state.nextDigitIdx];
      state.nextDigitIdx++;
    }

    render();
  }

  /* ---- Module registration ---- */

  window.GameModes = window.GameModes || {};
  window.GameModes['balloon-division'] = {
    name: 'Ballonmetoden',
    description: 'L\u00e6r at dividere med ballonmetoden \u2014 trin for trin!',
    icon: '\ud83c\udf88',
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
