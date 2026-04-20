/* ============================================
   Fill-in-the-Blank Game Mode
   Student types the answer to a multiplication.
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
    listeners: []
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

  function renderQuestion() {
    var q = state.questions[state.currentIndex];
    var progress = Math.round((state.currentIndex / state.total) * 100);

    state.container.innerHTML =
      '<h2>Spørgsmål ' + (state.currentIndex + 1) + ' af ' + state.total + '</h2>' +
      '<div class="progress-bar">' +
        '<div class="progress-fill" style="width:' + progress + '%"></div>' +
      '</div>' +
      '<div class="question-area" id="fb-question-area">' +
        '<div class="question-text">' + q.a + ' &times; ' + q.b + ' = ?</div>' +
        '<form id="fb-form" autocomplete="off">' +
          '<input type="number" class="answer-input" id="fb-input" inputmode="numeric" autocomplete="off" />' +
          '<br>' +
          '<button type="submit" class="submit-btn">Svar</button>' +
        '</form>' +
        '<div id="fb-feedback" style="margin-top:14px;font-size:1.2rem;font-weight:700;min-height:1.6em;"></div>' +
      '</div>';

    var form = document.getElementById('fb-form');
    var input = document.getElementById('fb-input');

    addListener(form, 'submit', handleSubmit);

    // Auto-focus the input
    setTimeout(function () { input.focus(); }, 50);
  }

  function handleSubmit(e) {
    e.preventDefault();

    var input = document.getElementById('fb-input');
    var feedback = document.getElementById('fb-feedback');
    var area = document.getElementById('fb-question-area');
    var q = state.questions[state.currentIndex];
    var userAnswer = parseInt(input.value, 10);

    if (isNaN(userAnswer)) return; // ignore empty submissions

    // Disable input to prevent double submission
    input.disabled = true;
    var btn = state.container.querySelector('.submit-btn');
    if (btn) btn.disabled = true;

    if (userAnswer === q.answer) {
      // Correct
      state.correct++;
      feedback.textContent = 'Rigtigt! \u2705';
      feedback.style.color = '#00b894';
      area.classList.add('correct-flash');
      state.config.onCorrect();

      var t1 = setTimeout(function () { nextQuestion(); }, 1000);
      state.timers.push(t1);
    } else {
      // Wrong
      feedback.textContent = 'Pr\u00f8v igen! Det rigtige svar er ' + q.answer;
      feedback.style.color = '#e17055';
      area.classList.add('wrong-shake');
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

    // Remove old listeners before rendering new question
    removeListeners();
    renderQuestion();
  }

  function completeGame() {
    var elapsed = Date.now() - state.startTime;

    // Show full progress bar
    state.container.innerHTML =
      '<div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div>';

    state.config.onComplete({
      correct: state.correct,
      total: state.total,
      time: elapsed
    });
  }

  window.GameModes = window.GameModes || {};
  window.GameModes['fill-blank'] = {
    name: 'Udfyld Svaret',
    description: 'Skriv det rigtige svar p\u00e5 gangestykket',
    icon: '\u270f\ufe0f',

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
