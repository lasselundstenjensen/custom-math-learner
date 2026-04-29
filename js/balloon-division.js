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
      var doneGroups = computeGroups();
      var hasMulti = hasMultiRowGroups(doneGroups);
      var base = 'Fantastisk! ' + state.dividend + ' divideret med ' + state.divisor + ' giver ' + q;
      if (r === 0) {
        base += '. Der er ingen rest!';
      } else {
        base += ' med rest ' + r + '!';
      }
      if (hasMulti) {
        var parts = buildQuotientBreakdown(doneGroups);
        var partStrs = [];
        for (var pi = 0; pi < parts.length; pi++) {
          if (parts[pi].multi) {
            partStrs.push(parts[pi].display);
          } else {
            partStrs.push(String(parts[pi].value));
          }
        }
        base += ' Ballonerne samles: ' + partStrs.join(', ') + ' giver ' + q + '.';
      }
      return base;
    }

    if (state.currentPhase === 'bringdown') {
      var info = state.bringdownInfo;
      var lastRow = state.rows[state.rows.length - 1];
      var chain = info.chain || [{ digit: info.digit }];
      var spokenChain = '';
      var running = info.remainder;
      for (var ci = 0; ci < chain.length; ci++) {
        var prevRunning = running;
        running = running * 10 + chain[ci].digit;
        if (ci === 0) {
          spokenChain += 'Vi tager ciffer ' + chain[ci].digit + ' ned og f\u00e5r ' + running;
        } else {
          spokenChain += '. ' + prevRunning + ' er mindre end ' + state.divisor +
            ', s\u00e5 vi tager ogs\u00e5 ' + chain[ci].digit + ' ned og f\u00e5r ' + running;
        }
      }
      return lastRow.multiplier + ' gange ' + state.divisor + ' er ' + lastRow.product +
        '. Rest: ' + lastRow.number + ' minus ' + lastRow.product + ' er ' + lastRow.remainder +
        '. ' + spokenChain + '. Tryk N\u00e6ste!';
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

  /* ---- Group computation for quotient breakdown ---- */

  function computeGroups() {
    var groups = [];
    var currentGroup = [];
    for (var i = 0; i < state.rows.length; i++) {
      currentGroup.push(state.rows[i]);
      if (state.rows[i].bringdownAfter || i === state.rows.length - 1) {
        var mults = [];
        var sum = 0;
        for (var j = 0; j < currentGroup.length; j++) {
          mults.push(currentGroup[j].multiplier);
          sum += currentGroup[j].multiplier;
        }
        groups.push({
          multipliers: mults,
          sum: sum,
          startIdx: i - currentGroup.length + 1,
          endIdx: i,
          autoBringdowns: state.rows[i].autoBringdowns || 0
        });
        currentGroup = [];
      }
    }
    return groups;
  }

  function hasMultiRowGroups(groups) {
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].multipliers.length > 1) return true;
    }
    return false;
  }

  function buildQuotientBreakdown(groups) {
    // Build display parts: each group's sum, plus auto-bringdown zeros
    var parts = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (g.multipliers.length > 1) {
        parts.push({
          display: g.multipliers.join(' + ') + ' = ' + g.sum,
          value: g.sum,
          multi: true
        });
      } else {
        parts.push({
          display: String(g.sum),
          value: g.sum,
          multi: false
        });
      }
      // Insert 0s for auto-bringdowns (skipped digit positions)
      if (g.autoBringdowns) {
        for (var a = 0; a < g.autoBringdowns; a++) {
          parts.push({ display: '0', value: 0, auto: true });
        }
      }
    }
    return parts;
  }

  /* ---- Rendering ---- */

  function render() {
    removeListeners();

    var explanation = getExplanation();

    // ---- Build the stem rows from completed rows ----
    var rowsHtml = '';

    // In done phase, compute groups for bracket display
    var groups = (state.currentPhase === 'done') ? computeGroups() : null;
    var showBrackets = groups && hasMultiRowGroups(groups);

    // Build a lookup: rowIndex -> { position in group, groupSize, groupSum }
    var rowGroupInfo = {};
    if (showBrackets && groups) {
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        if (g.multipliers.length > 1) {
          for (var ri = g.startIdx; ri <= g.endIdx; ri++) {
            rowGroupInfo[ri] = {
              pos: ri === g.startIdx ? 'first' : (ri === g.endIdx ? 'last' : 'mid'),
              sum: g.sum,
              isLast: ri === g.endIdx
            };
          }
        }
      }
    }

    for (var i = 0; i < state.rows.length; i++) {
      var row = state.rows[i];

      // Left: the number being divided
      var leftClass = 'bd-left-num';

      // Right: the multiplier chosen
      var rightClass = 'bd-right-digit bd-digit-filled';

      // Add group bracket class if applicable
      var rowClass = 'bd-stem-row';
      var rgi = rowGroupInfo[i];
      if (rgi) {
        rowClass += ' bd-group-' + rgi.pos;
      }

      // Group sum label (shown on last row of multi-row group)
      var sumHtml = '';
      if (rgi && rgi.isLast) {
        sumHtml = '<div class="bd-group-sum">= ' + rgi.sum + '</div>';
      } else if (showBrackets) {
        sumHtml = '<div class="bd-group-sum"></div>';
      }

      rowsHtml +=
        '<div class="' + rowClass + '">' +
          '<div class="' + leftClass + '">' + row.number + '</div>' +
          '<div class="bd-stem-line"></div>' +
          '<div class="' + rightClass + '">' + row.multiplier + '</div>' +
          sumHtml +
        '</div>';

      // Underline after rows where a bringdown happened (remainder < divisor)
      if (row.bringdownAfter) {
        var sepCols = showBrackets ? ' bd-row-separator-wide' : '';
        rowsHtml += '<div class="bd-stem-row bd-row-separator' + sepCols + '"><div class="bd-row-line-left"></div><div class="bd-stem-line"></div><div class="bd-row-line-right"></div>' + (showBrackets ? '<div></div>' : '') + '</div>';
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
      var chain = info.chain || [{ digit: info.digit }];

      // Build bring-down explanation showing each step in the chain
      var bringHtml = '';
      var running = info.remainder;
      for (var ci = 0; ci < chain.length; ci++) {
        running = running * 10 + chain[ci].digit;
        bringHtml += 'Tag <span class="bd-digit-bring">' + chain[ci].digit + '</span> ned \u2192 <strong>' + running + '</strong>';
        if (ci < chain.length - 1) {
          // Explain WHY we bring down another digit
          bringHtml += ' <span class="bd-anno-auto">(' + running + ' &lt; ' + state.divisor + ')</span><br>';
        }
      }

      annotationHtml =
        '<div class="bd-annotation">' +
          '<div class="bd-annotation-calc">' +
            '<span class="bd-anno-step">' + lastRow.multiplier + ' \u00d7 ' + state.divisor + ' = ' + lastRow.product + '</span>' +
            '<span class="bd-anno-arrow">\u2192</span>' +
            '<span class="bd-anno-step">' + lastRow.number + ' \u2212 ' + lastRow.product + ' = <strong>' + lastRow.remainder + '</strong></span>' +
          '</div>' +
          '<div class="bd-annotation-bring">' + bringHtml + '</div>' +
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

      // Show quotient breakdown if there are multi-row groups
      if (showBrackets && groups) {
        var parts = buildQuotientBreakdown(groups);
        var breakdownHtml = '<div class="bd-breakdown">';
        breakdownHtml += '<div class="bd-breakdown-label">Ballonerne samles:</div>';
        breakdownHtml += '<div class="bd-breakdown-parts">';
        for (var pi = 0; pi < parts.length; pi++) {
          var part = parts[pi];
          if (part.multi) {
            breakdownHtml += '<span class="bd-breakdown-group">(' + part.display + ')</span>';
          } else if (part.auto) {
            breakdownHtml += '<span class="bd-breakdown-zero">' + part.display + '</span>';
          } else {
            breakdownHtml += '<span class="bd-breakdown-single">' + part.display + '</span>';
          }
        }
        breakdownHtml += '<span class="bd-breakdown-eq">= <strong>' + q + '</strong></span>';
        breakdownHtml += '</div></div>';
        answerHtml += breakdownHtml;
      }
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
      // Highlight ALL digits being brought down (including auto-bringdowns)
      var dividendStr = String(state.dividend);
      var chain = state.bringdownInfo.chain || [{ digitIdx: state.bringdownInfo.digitIdx }];
      var highlightSet = {};
      for (var ci2 = 0; ci2 < chain.length; ci2++) {
        highlightSet[chain[ci2].digitIdx] = true;
      }
      var titleDigits = '';
      for (var d = 0; d < dividendStr.length; d++) {
        if (highlightSet[d]) {
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
            '<div class="bd-stem-area' + (showBrackets ? ' bd-stem-brackets' : '') + '">' + rowsHtml + '</div>' +
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

      // Pre-compute auto-bringdown chain (digits that will be auto-brought-down
      // because the intermediate number is still < divisor)
      var chain = [{ digit: nextDigit, digitIdx: state.nextDigitIdx }];
      var tempNumber = newNumber;
      var tempIdx = state.nextDigitIdx + 1;
      var autoBringdowns = 0;
      while (tempNumber < state.divisor && tempIdx < state.digits.length) {
        var autoDigit = state.digits[tempIdx];
        chain.push({ digit: autoDigit, digitIdx: tempIdx });
        tempNumber = tempNumber * 10 + autoDigit;
        tempIdx++;
        autoBringdowns++;
      }

      row.autoBringdowns = autoBringdowns;

      state.bringdownInfo = {
        remainder: remainder,
        digit: nextDigit,
        digitIdx: state.nextDigitIdx,
        newNumber: tempNumber,  // final number after all auto-bringdowns
        chain: chain            // all digits brought down (first + auto)
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
    var chain = info.chain || [{ digit: info.digit }];

    // Apply all bringdowns from the pre-computed chain
    // First digit: normal bringdown
    state.quotientAcc *= 10;
    state.nextDigitIdx++;

    // Additional auto-bringdowns (each one inserts a 0 quotient position)
    for (var ci = 1; ci < chain.length; ci++) {
      state.quotientAcc *= 10;
      state.nextDigitIdx++;
    }

    state.currentNumber = info.newNumber;

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
