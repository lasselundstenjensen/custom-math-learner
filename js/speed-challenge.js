/* ============================================
   Speed Challenge Game Mode
   Answer as many multiplication questions as
   possible within 60 seconds.
   ============================================ */

(function () {
  'use strict';

  var TOTAL_TIME = 60; // seconds

  var state = {
    config: null,
    container: null,
    correct: 0,
    totalAttempted: 0,
    timeLeft: TOTAL_TIME,
    running: false,
    timers: [],
    intervals: [],
    listeners: [],
    currentQuestion: null
  };

  // --------------- Helpers ---------------

  function clearAllTimers() {
    state.timers.forEach(function (id) { clearTimeout(id); });
    state.timers = [];
    state.intervals.forEach(function (id) { clearInterval(id); });
    state.intervals = [];
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

  /** Generate a single question for the selected table. */
  function generateQuestion() {
    var a, b;
    var table = state.config.table;

    if (table === 'mix') {
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
    } else {
      a = table;
      b = Math.floor(Math.random() * 10) + 1;
    }

    return { a: a, b: b, answer: a * b };
  }

  /** Return the appropriate CSS class for the timer bar based on seconds left. */
  function timerColor(secondsLeft) {
    if (secondsLeft > 30) return '#00b894';   // green
    if (secondsLeft > 10) return '#fdcb6e';   // yellow
    return '#e17055';                          // red
  }

  // --------------- Rendering ---------------

  function renderUI() {
    var pct = Math.max(0, (state.timeLeft / TOTAL_TIME) * 100);
    var displayTime = Math.max(0, Math.ceil(state.timeLeft));

    state.container.innerHTML =
      '<div class="timer-display" id="sc-timer">' + displayTime + ' sek</div>' +
      '<div class="progress-bar" style="margin-bottom:12px;">' +
        '<div class="progress-fill" id="sc-timer-bar" style="width:' + pct + '%;background:' + timerColor(state.timeLeft) + ';transition:width 0.1s linear;"></div>' +
      '</div>' +
      '<div id="sc-encouragement" style="text-align:center;font-size:1.2rem;font-weight:700;min-height:1.8em;margin-bottom:8px;"></div>' +
      '<div class="question-area" id="sc-question-area">' +
        '<div class="question-text" id="sc-question"></div>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:12px;">' +
          '<input type="number" inputmode="numeric" class="answer-input" id="sc-input" autocomplete="off" />' +
        '</div>' +
        '<div id="sc-feedback" style="margin-top:14px;font-size:1.2rem;font-weight:700;min-height:1.6em;"></div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:16px;font-size:1.3rem;font-weight:700;color:#6c5ce7;" id="sc-score">' +
        'Rigtige: ' + state.correct +
      '</div>';

    showQuestion();
    focusInput();

    // Attach input listener
    var input = document.getElementById('sc-input');
    if (input) {
      addListener(input, 'keydown', handleKeyDown);
    }

    // Speak intro
    window.App.autoSpeak('Tidsudfordring! Svar s\u00e5 hurtigt du kan. Du har 60 sekunder.');
  }

  function showQuestion() {
    state.currentQuestion = generateQuestion();
    var qEl = document.getElementById('sc-question');
    if (qEl) {
      qEl.textContent = state.currentQuestion.a + ' \u00d7 ' + state.currentQuestion.b + ' = ?';
    }
    focusInput();
  }

  function focusInput() {
    var input = document.getElementById('sc-input');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  function updateTimerDisplay() {
    var displayTime = Math.max(0, Math.ceil(state.timeLeft));
    var pct = Math.max(0, (state.timeLeft / TOTAL_TIME) * 100);

    var timerEl = document.getElementById('sc-timer');
    if (timerEl) {
      timerEl.textContent = displayTime + ' sek';
      // Add warning class when under 10 seconds
      if (state.timeLeft <= 10) {
        timerEl.classList.add('warning');
      } else {
        timerEl.classList.remove('warning');
      }
    }

    var barEl = document.getElementById('sc-timer-bar');
    if (barEl) {
      barEl.style.width = pct + '%';
      barEl.style.background = timerColor(state.timeLeft);
    }
  }

  function updateScore() {
    var scoreEl = document.getElementById('sc-score');
    if (scoreEl) {
      scoreEl.textContent = 'Rigtige: ' + state.correct;
    }
  }

  function showEncouragement(msg) {
    var el = document.getElementById('sc-encouragement');
    if (el) {
      el.textContent = msg;
      var t = setTimeout(function () {
        if (el) el.textContent = '';
      }, 1500);
      state.timers.push(t);
    }
  }

  // --------------- Event Handling ---------------

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!state.running) return;

      var input = document.getElementById('sc-input');
      if (!input) return;

      var value = input.value.trim();
      if (value === '') return;

      var answer = parseInt(value, 10);
      if (isNaN(answer)) return;

      state.totalAttempted++;

      if (answer === state.currentQuestion.answer) {
        handleCorrect();
      } else {
        handleWrong();
      }
    }
  }

  function handleCorrect() {
    state.correct++;
    state.config.onCorrect();
    updateScore();

    // Flash green on question area
    var area = document.getElementById('sc-question-area');
    if (area) {
      area.classList.add('correct-flash');
      var t = setTimeout(function () {
        if (area) area.classList.remove('correct-flash');
      }, 500);
      state.timers.push(t);
    }

    // Show encouragement messages at milestones
    if (state.correct > 0 && state.correct % 10 === 0) {
      showEncouragement('Du er en raket! \ud83d\ude80');
    } else if (state.correct > 0 && state.correct % 5 === 0) {
      showEncouragement('Flot tempo! \ud83d\udd25');
    }

    // Show next question immediately
    showQuestion();
  }

  function handleWrong() {
    state.config.onWrong();

    // Shake the question area
    var area = document.getElementById('sc-question-area');
    if (area) {
      area.classList.add('wrong-shake');
      var t1 = setTimeout(function () {
        if (area) area.classList.remove('wrong-shake');
      }, 300);
      state.timers.push(t1);
    }

    // Show correct answer briefly
    var feedback = document.getElementById('sc-feedback');
    if (feedback) {
      feedback.textContent = 'Svaret er ' + state.currentQuestion.answer;
      feedback.style.color = '#e17055';
    }

    // Disable input during feedback
    var input = document.getElementById('sc-input');
    if (input) {
      input.disabled = true;
    }

    var t2 = setTimeout(function () {
      if (feedback) feedback.textContent = '';
      if (input) {
        input.disabled = false;
      }
      if (state.running) {
        showQuestion();
      }
    }, 800);
    state.timers.push(t2);
  }

  // --------------- Timer ---------------

  function startTimer() {
    state.timeLeft = TOTAL_TIME;
    state.running = true;

    var lastTick = Date.now();

    var intervalId = setInterval(function () {
      if (!state.running) return;

      var now = Date.now();
      var delta = (now - lastTick) / 1000;
      lastTick = now;

      state.timeLeft -= delta;
      updateTimerDisplay();

      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.running = false;
        updateTimerDisplay();
        endGame();
      }
    }, 100);

    state.intervals.push(intervalId);
  }

  function endGame() {
    state.running = false;
    clearAllTimers();
    removeListeners();

    // Show "time's up" message
    state.container.innerHTML =
      '<div style="text-align:center;padding:40px 20px;">' +
        '<div style="font-size:3rem;margin-bottom:16px;">\u23f0</div>' +
        '<h2 style="color:#6c5ce7;margin-bottom:12px;">Tiden er g\u00e5et!</h2>' +
        '<p style="font-size:1.3rem;font-weight:700;margin-bottom:8px;">Du svarede rigtigt p\u00e5 ' + state.correct + ' ud af ' + state.totalAttempted + ' sp\u00f8rgsm\u00e5l!</p>' +
      '</div>';

    // Brief pause before showing results
    var t = setTimeout(function () {
      state.config.onComplete({
        correct: state.correct,
        total: state.totalAttempted,
        time: TOTAL_TIME * 1000
      });
    }, 1500);
    state.timers.push(t);
  }

  // --------------- Module Registration ---------------

  window.GameModes = window.GameModes || {};
  window.GameModes['speed-challenge'] = {
    name: 'Tidsudfordring',
    description: 'Svar p\u00e5 s\u00e5 mange gangestykker som muligt p\u00e5 60 sekunder!',
    icon: '\u26a1',

    init: function (container, config) {
      state.container = container;
      state.config = config;
      state.correct = 0;
      state.totalAttempted = 0;
      state.timeLeft = TOTAL_TIME;
      state.running = false;
      state.timers = [];
      state.intervals = [];
      state.listeners = [];
      state.currentQuestion = null;

      renderUI();
      startTimer();
    },

    cleanup: function () {
      state.running = false;
      clearAllTimers();
      removeListeners();
      state.container = null;
      state.config = null;
      state.currentQuestion = null;
    }
  };
})();
