/* ============================================
   Multiple Choice Game Mode
   Student picks the correct answer from four
   options in a 2x2 grid.
   ============================================ */

(function () {
  'use strict';

  var state = {
    questions: [],
    currentIndex: 0,
    correct: 0,
    total: 0,
    startTime: null,
    config: null,
    container: null,
    timers: [],
    listeners: [],
    answered: false
  };

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

  /**
   * Generate three plausible distractors for a given correct answer.
   * They are close to the correct answer, unique, never equal to the
   * correct answer, and always positive (>= 1).
   */
  function generateDistractors(correctAnswer) {
    var distractors = [];
    var used = {};
    used[correctAnswer] = true;

    var attempts = 0;
    while (distractors.length < 3 && attempts < 100) {
      attempts++;
      // Offset between -10 and +10 (excluding 0)
      var offset = Math.floor(Math.random() * 10) + 1;
      if (Math.random() < 0.5) offset = -offset;

      var candidate = correctAnswer + offset;

      // Must be positive, non-zero, and unique
      if (candidate < 1 || used[candidate]) continue;

      used[candidate] = true;
      distractors.push(candidate);
    }

    // Fallback: fill remaining with sequential values if needed
    var fallback = correctAnswer + 11;
    while (distractors.length < 3) {
      if (!used[fallback] && fallback >= 1) {
        used[fallback] = true;
        distractors.push(fallback);
      }
      fallback++;
    }

    return distractors;
  }

  /** Shuffle an array in place (Fisher-Yates) */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  function renderQuestion() {
    var q = state.questions[state.currentIndex];
    var progress = Math.round((state.currentIndex / state.total) * 100);

    // Build choices
    var distractors = generateDistractors(q.answer);
    var choices = shuffle([q.answer].concat(distractors));

    state.answered = false;

    var choicesHtml = '';
    choices.forEach(function (val) {
      choicesHtml += '<button class="choice-btn" data-value="' + val + '">' + val + '</button>';
    });

    state.container.innerHTML =
      '<h2>Spørgsmål ' + (state.currentIndex + 1) + ' af ' + state.total + '</h2>' +
      '<div class="progress-bar">' +
        '<div class="progress-fill" style="width:' + progress + '%"></div>' +
      '</div>' +
      '<div class="question-area" id="mc-question-area">' +
        '<div class="question-text">' + q.a + ' &times; ' + q.b + ' = ?</div>' +
        '<div class="choices-grid" id="mc-choices">' +
          choicesHtml +
        '</div>' +
        '<div id="mc-feedback" style="margin-top:14px;font-size:1.2rem;font-weight:700;min-height:1.6em;"></div>' +
      '</div>';

    // Attach listeners to each choice button
    var buttons = state.container.querySelectorAll('.choice-btn');
    buttons.forEach(function (btn) {
      addListener(btn, 'click', handleChoice);
    });
  }

  function handleChoice(e) {
    if (state.answered) return; // prevent double clicks
    state.answered = true;

    var clickedBtn = e.currentTarget;
    var chosenValue = parseInt(clickedBtn.getAttribute('data-value'), 10);
    var q = state.questions[state.currentIndex];
    var feedback = document.getElementById('mc-feedback');

    // Disable all buttons
    var buttons = state.container.querySelectorAll('.choice-btn');
    buttons.forEach(function (btn) {
      btn.style.pointerEvents = 'none';
    });

    if (chosenValue === q.answer) {
      // Correct
      state.correct++;
      clickedBtn.classList.add('correct');
      feedback.textContent = 'Rigtigt! \u2705';
      feedback.style.color = '#00b894';
      state.config.onCorrect();

      var t1 = setTimeout(function () { nextQuestion(); }, 1000);
      state.timers.push(t1);
    } else {
      // Wrong — highlight clicked as wrong, show correct
      clickedBtn.classList.add('wrong');
      buttons.forEach(function (btn) {
        if (parseInt(btn.getAttribute('data-value'), 10) === q.answer) {
          btn.classList.add('correct');
        }
      });
      feedback.textContent = 'Ikke helt! Svaret er ' + q.answer;
      feedback.style.color = '#e17055';
      state.config.onWrong();

      var t2 = setTimeout(function () { nextQuestion(); }, 2000);
      state.timers.push(t2);
    }
  }

  function nextQuestion() {
    state.currentIndex++;

    if (state.currentIndex >= state.total) {
      completeGame();
      return;
    }

    removeListeners();
    renderQuestion();
  }

  function completeGame() {
    var elapsed = Date.now() - state.startTime;

    state.container.innerHTML =
      '<div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div>';

    state.config.onComplete({
      correct: state.correct,
      total: state.total,
      time: elapsed
    });
  }

  window.GameModes = window.GameModes || {};
  window.GameModes['multiple-choice'] = {
    name: 'V\u00e6lg det Rigtige Svar',
    description: 'V\u00e6lg det rigtige svar blandt fire muligheder',
    icon: '\ud83c\udfaf',

    init: function (container, config) {
      state.container = container;
      state.config = config;
      state.questions = config.questions;
      state.total = config.questions.length;
      state.currentIndex = 0;
      state.correct = 0;
      state.startTime = Date.now();
      state.timers = [];
      state.listeners = [];
      state.answered = false;

      renderQuestion();
    },

    cleanup: function () {
      clearTimers();
      removeListeners();
      state.container = null;
      state.config = null;
      state.questions = [];
    }
  };
})();
