/* ============================================
   Missing Factor Game Mode
   Student figures out which number is missing
   from the multiplication expression.
   ============================================ */

(function () {
  'use strict';

  var encouragements = [
    'Rigtigt! \u2705',
    'Godt t\u00e6nkt! \ud83e\udde0',
    'Rigtigt! \u2705',
    'S\u00e5dan! \ud83e\udde0',
    'Rigtigt! \u2705',
    'Godt t\u00e6nkt! \ud83e\udde0'
  ];

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
    hideFirst: false // whether the first factor is hidden for the current question
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

    // Randomly decide whether to hide the first or second factor
    state.hideFirst = Math.random() < 0.5;

    var questionStr;
    if (state.hideFirst) {
      // ? x b = answer
      questionStr = '? &times; ' + q.b + ' = ' + q.answer;
    } else {
      // a x ? = answer
      questionStr = q.a + ' &times; ? = ' + q.answer;
    }

    state.container.innerHTML =
      '<h2>Spørgsmål ' + (state.currentIndex + 1) + ' af ' + state.total + '</h2>' +
      '<div class="progress-bar">' +
        '<div class="progress-fill" style="width:' + progress + '%"></div>' +
      '</div>' +
      '<div class="question-area" id="mf-question-area">' +
        '<div class="question-text">' + questionStr + '</div>' +
        '<form id="mf-form" autocomplete="off">' +
          '<input type="number" class="answer-input" id="mf-input" inputmode="numeric" autocomplete="off" />' +
          '<br>' +
          '<button type="submit" class="submit-btn">Svar</button>' +
        '</form>' +
        '<div id="mf-feedback" style="margin-top:14px;font-size:1.2rem;font-weight:700;min-height:1.6em;"></div>' +
      '</div>';

    var form = document.getElementById('mf-form');
    var input = document.getElementById('mf-input');

    addListener(form, 'submit', handleSubmit);

    // Auto-focus the input
    setTimeout(function () { input.focus(); }, 50);

    // Speak the question
    var spokenText;
    if (state.hideFirst) {
      spokenText = 'Hvilket tal gange ' + q.b + ' giver ' + q.answer + '?';
    } else {
      spokenText = q.a + ' gange hvilket tal giver ' + q.answer + '?';
    }
    window.App.autoSpeak(spokenText);
  }

  function handleSubmit(e) {
    e.preventDefault();

    var input = document.getElementById('mf-input');
    var feedback = document.getElementById('mf-feedback');
    var area = document.getElementById('mf-question-area');
    var q = state.questions[state.currentIndex];
    var userAnswer = parseInt(input.value, 10);

    if (isNaN(userAnswer)) return; // ignore empty submissions

    // Determine the correct missing factor
    var correctFactor = state.hideFirst ? q.a : q.b;

    // Disable input to prevent double submission
    input.disabled = true;
    var btn = state.container.querySelector('.submit-btn');
    if (btn) btn.disabled = true;

    if (userAnswer === correctFactor) {
      // Correct — pick a random encouragement
      state.correct++;
      var msg = encouragements[Math.floor(Math.random() * encouragements.length)];
      feedback.textContent = msg;
      feedback.style.color = '#00b894';
      area.classList.add('correct-flash');
      state.config.onCorrect();

      var t1 = setTimeout(function () { nextQuestion(); }, 1000);
      state.timers.push(t1);
    } else {
      // Wrong
      feedback.textContent = 'Ikke helt! Det manglende tal er ' + correctFactor;
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
  window.GameModes['missing-factor'] = {
    name: 'Find den Manglende Faktor',
    description: 'Hvilket tal mangler i gangestykket?',
    icon: '\ud83d\udd0d',

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
      state.hideFirst = false;

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
