/* ============================================
   Table Sequence Game Mode
   Shows a full multiplication table row with
   one value missing. The student fills in the gap.
   ============================================ */

(function () {
  'use strict';

  var CELLS_PER_ROW = 10;

  var state = {
    config: null,
    container: null,
    rounds: [],        // { table, missingPos, answer }
    currentIndex: 0,
    correct: 0,
    total: 0,
    startTime: null,
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

  /** Shuffle array in place (Fisher-Yates). */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  /**
   * Build the list of rounds.
   * Each round: pick a table and a position (1-10) to hide.
   * For a specific table: use the same table every round, hide each position once (shuffled).
   * For 'mix': pick a random table each round with a random position.
   */
  function buildRounds(table, count) {
    var rounds = [];

    if (table === 'mix') {
      for (var i = 0; i < count; i++) {
        var t = Math.floor(Math.random() * 10) + 1;
        var pos = Math.floor(Math.random() * CELLS_PER_ROW) + 1;
        rounds.push({ table: t, missingPos: pos, answer: t * pos });
      }
    } else {
      // For a specific table, hide each position exactly once (shuffled order)
      var positions = [];
      for (var p = 1; p <= CELLS_PER_ROW; p++) {
        positions.push(p);
      }
      shuffle(positions);
      for (var j = 0; j < count; j++) {
        var pos2 = positions[j % positions.length];
        rounds.push({ table: table, missingPos: pos2, answer: table * pos2 });
      }
    }

    return rounds;
  }

  function renderRound() {
    var round = state.rounds[state.currentIndex];
    var progress = Math.round((state.currentIndex / state.total) * 100);

    // Build the sequence cells
    var cellsHtml = '';
    for (var i = 1; i <= CELLS_PER_ROW; i++) {
      var value = round.table * i;
      if (i === round.missingPos) {
        cellsHtml +=
          '<div class="seq-cell seq-missing">' +
            '<input type="number" inputmode="numeric" class="seq-input" id="ts-input" autocomplete="off" />' +
          '</div>';
      } else {
        cellsHtml += '<div class="seq-cell">' + value + '</div>';
      }
    }

    // Build position labels (×1, ×2, ... ×10)
    var labelsHtml = '';
    for (var k = 1; k <= CELLS_PER_ROW; k++) {
      labelsHtml += '<div class="seq-label">\u00d7' + k + '</div>';
    }

    state.container.innerHTML =
      '<h2>Spørgsmål ' + (state.currentIndex + 1) + ' af ' + state.total + '</h2>' +
      '<div class="progress-bar">' +
        '<div class="progress-fill" style="width:' + progress + '%"></div>' +
      '</div>' +
      '<div class="question-area">' +
        '<div class="seq-table-label">' + round.table + '-tabellen</div>' +
        '<div class="seq-row" id="ts-row">' + cellsHtml + '</div>' +
        '<div class="seq-labels-row">' + labelsHtml + '</div>' +
        '<form id="ts-form" autocomplete="off">' +
          '<button type="submit" class="submit-btn" style="margin-top:20px;">Svar</button>' +
        '</form>' +
        '<div id="ts-feedback" style="margin-top:14px;font-size:1.2rem;font-weight:700;min-height:1.6em;"></div>' +
      '</div>';

    var form = document.getElementById('ts-form');
    addListener(form, 'submit', handleSubmit);

    // Also submit on Enter in the input
    var input = document.getElementById('ts-input');
    if (input) {
      addListener(input, 'keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
      setTimeout(function () { input.focus(); }, 50);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();

    var input = document.getElementById('ts-input');
    var feedback = document.getElementById('ts-feedback');
    var row = document.getElementById('ts-row');
    var round = state.rounds[state.currentIndex];
    var userAnswer = parseInt(input.value, 10);

    if (isNaN(userAnswer)) return;

    // Disable input
    input.disabled = true;
    var btn = state.container.querySelector('.submit-btn');
    if (btn) btn.disabled = true;

    if (userAnswer === round.answer) {
      state.correct++;
      // Show the correct value in the cell
      var missingCell = state.container.querySelector('.seq-missing');
      if (missingCell) {
        missingCell.innerHTML = '<span class="seq-revealed">' + round.answer + '</span>';
        missingCell.classList.add('seq-correct');
      }
      feedback.textContent = 'Rigtigt! \u2705';
      feedback.style.color = '#00b894';
      if (row) row.classList.add('correct-flash');
      state.config.onCorrect();

      var t1 = setTimeout(function () { nextRound(); }, 1200);
      state.timers.push(t1);
    } else {
      // Show the correct answer in the cell
      var missingCell2 = state.container.querySelector('.seq-missing');
      if (missingCell2) {
        missingCell2.innerHTML = '<span class="seq-revealed">' + round.answer + '</span>';
        missingCell2.classList.add('seq-wrong');
      }
      feedback.textContent = 'Ikke helt! Det rigtige svar er ' + round.answer;
      feedback.style.color = '#e17055';
      if (row) row.classList.add('wrong-shake');
      state.config.onWrong();

      var t2 = setTimeout(function () { nextRound(); }, 2000);
      state.timers.push(t2);
    }
  }

  function nextRound() {
    state.currentIndex++;

    if (state.currentIndex >= state.total) {
      completeGame();
      return;
    }

    removeListeners();
    renderRound();
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

  // --------------- Module Registration ---------------

  window.GameModes = window.GameModes || {};
  window.GameModes['table-sequence'] = {
    name: 'Hele Tabellen',
    description: 'Se hele rækken \u2014 find det manglende tal!',
    icon: '\ud83e\udde9',

    init: function (container, config) {
      state.container = container;
      state.config = config;
      state.total = config.questions.length;
      state.currentIndex = 0;
      state.correct = 0;
      state.startTime = Date.now();
      state.timers = [];
      state.listeners = [];
      state.rounds = buildRounds(config.table, state.total);

      renderRound();
    },

    cleanup: function () {
      clearTimers();
      removeListeners();
      state.container = null;
      state.config = null;
      state.rounds = [];
    }
  };
})();
