/**
 * rabbit-path.js
 * RabbitPath Game (code 102) — Sequential Memory / Backward-trace task
 * Converted from RabbitPathGame.tsx (React) to vanilla JS / jQuery
 *
 * Usage:
 *   RabbitPathGame({ container, userStudentId, playerName, onComplete, onExit })
 *
 * onComplete(data) is called automatically when the game ends (phase "done").
 * onExit()        is called when the user clicks the exit (✕) button.
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants (identical to the React source)
// ---------------------------------------------------------------------------
var _RP_SCENE_SRC          = "/game-scenes/2nd/game-scene-2nd.png";
var _RP_RABBIT_FORWARD_SRC = "/game-scenes/2nd/rabbit-nobg-old.png";
var _RP_RABBIT_REVERSE_SRC = "/game-scenes/2nd/rabbit-nobg.png";
var _RP_HOW_TO_PLAY_VIDEO  = "/assets/game/rabbit-path-tutorial.mp4";

var _RP_ROUND_SHOW_MS   = 10000;
var _RP_ROUND_INPUT_MS  = 20000;
var _RP_BUFFER_MS       = 10000;
var _RP_GAME_MAX_TIME   = 150000;
var _RP_TOTAL_ROUNDS    = 12;
var _RP_HOME_POS        = { xPct: 21.4, yPct: 81.3 };

// ---------------------------------------------------------------------------
// Stone definitions (identical positions from the React source)
// ---------------------------------------------------------------------------
var _RP_STONES_DEFAULT = [
  { id: 0,  xPct: 21.4, yPct: 81.3, rPct: 4,   rabbitScale: 3,   rabbitYOffset: -5  },
  { id: 1,  xPct: 50.1, yPct: 79.2, rPct: 4.8, rabbitScale: 2.6, rabbitYOffset: -11 },
  { id: 2,  xPct: 39.1, yPct: 70.2, rPct: 4,   rabbitScale: 2.3, rabbitYOffset: -10 },
  { id: 3,  xPct: 56.8, yPct: 68,   rPct: 4.4, rabbitScale: 2.2, rabbitYOffset: -9  },
  { id: 4,  xPct: 47,   yPct: 60.3, rPct: 4,   rabbitScale: 2,   rabbitYOffset: -8  },
  { id: 5,  xPct: 72.4, yPct: 62.8, rPct: 3.5, rabbitScale: 1.6, rabbitYOffset: -6.5},
  { id: 6,  xPct: 61.3, yPct: 56.1, rPct: 3.2, rabbitScale: 1.4, rabbitYOffset: -5.5},
  { id: 7,  xPct: 80,   yPct: 55.9, rPct: 3.1, rabbitScale: 1.4, rabbitYOffset: -6.5},
  { id: 8,  xPct: 70.9, yPct: 51.6, rPct: 2.4, rabbitScale: 1.2, rabbitYOffset: -5.5},
  { id: 9,  xPct: 86.7, yPct: 50.9, rPct: 2.3, rabbitScale: 1.1, rabbitYOffset: -5.5},
  { id: 10, xPct: 78,   yPct: 49.5, rPct: 2,   rabbitScale: 1.1, rabbitYOffset: -5  },
  { id: 11, xPct: 76.3, yPct: 41.6, rPct: 4,   rabbitScale: 1,   rabbitYOffset: -1.5}
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function _rpShuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function _rpDeepCopyStones(stones) {
  return stones.map(function(s) { return Object.assign({}, s); });
}

/**
 * Grade-4 Sequence Generator (identical logic to the React source)
 */
function _rpGenerateSequence(stones, roundIndex, history, isTrial) {
  var length = 4;

  if (!isTrial) {
    var set1Passed = history.filter(function(h) {
      return h.round >= 0 && h.round <= 3 && h.correct;
    }).length === 4;

    if (roundIndex >= 4) {
      if (set1Passed) length = 5;
    }

    if (roundIndex >= 8) {
      var set2Passed = history.filter(function(h) {
        return h.round >= 4 && h.round <= 7 && h.correct;
      }).length === 4;

      if (set1Passed && set2Passed) {
        length = 6;
      } else if (set1Passed && !set2Passed) {
        length = 5;
      } else {
        length = 4;
      }
    }
  }

  var validIds = stones.filter(function(s) {
    return s.id !== 0 && s.id !== 11;
  }).map(function(s) { return s.id; });

  var candidates = [];
  var attempts = 0;

  while (attempts < 500) {
    var potential = _rpShuffle(validIds).slice(0, length).sort(function(a, b) { return a - b; });

    var consecutivePairs = 0;
    for (var i = 0; i < potential.length - 1; i++) {
      if (potential[i + 1] === potential[i] + 1) consecutivePairs++;
    }

    var isValid = false;
    if (length === 6) {
      if (consecutivePairs <= 2) isValid = true;
    } else if (length === 5) {
      if (consecutivePairs <= 1) isValid = true;
    } else {
      if (consecutivePairs === 0) isValid = true;
    }

    if (isValid) {
      candidates = potential;
      break;
    }
    attempts++;
  }

  if (candidates.length === 0) {
    candidates = _rpShuffle(validIds).slice(0, length).sort(function(a, b) { return a - b; });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------
function RabbitPathGame(opts) {
  var container     = opts.container;
  var userStudentId = opts.userStudentId;
  var playerName    = opts.playerName;
  var onComplete    = opts.onComplete;
  var onExit        = opts.onExit;

  var $c = $(container);

  // ---- mutable game state ----
  var stonesState   = _rpDeepCopyStones(_RP_STONES_DEFAULT);
  var showHowToPlayVideo = true;
  var isTrial       = true;
  var trialRound    = 0;
  var round         = 0;
  var score         = 0;
  var phase         = "ready";  // "ready"|"show"|"input"|"feedback"|"paused"|"trial_done"|"done"
  var sequence      = [];
  var playerInput   = [];
  var activeStone   = null;
  var bufferActivated = false;
  var history       = [];
  var trialSequence = [];
  var phaseMsLeft   = 0;
  var gameMsLeft    = _RP_GAME_MAX_TIME;
  var imagesLoaded  = false;

  // Rabbit position
  var rabbitPos   = { x: _RP_HOME_POS.xPct, y: _RP_HOME_POS.yPct };
  var rabbitScale = 1;
  var rabbitVisible = true;

  // Timers
  var timers         = [];
  var phaseTickTimer = null;
  var gameTickTimer  = null;

  // ---- DOM refs (populated after renderGame) ----
  var $sceneContainer = null;
  var $rabbitEl       = null;
  var $rabbitImg      = null;
  var $counterEl      = null;
  var $progressFill   = null;
  var $phaseLabel     = null;
  var $phaseSecs      = null;
  var $phaseBar       = null;
  var $gameControlBtn = null;
  var $readyOverlay   = null;
  var $doneOverlay    = null;
  var $pausedModal    = null;
  var $trialDoneModal = null;

  // ---- Pre-load images ----
  function preloadImages(cb) {
    var srcs = [_RP_SCENE_SRC, _RP_RABBIT_FORWARD_SRC, _RP_RABBIT_REVERSE_SRC];
    var loaded = 0;
    srcs.forEach(function(src) {
      var img = new Image();
      img.onload  = function() { loaded++; if (loaded === srcs.length) cb(); };
      img.onerror = function() { loaded++; if (loaded === srcs.length) cb(); };
      img.src = src;
    });
  }

  // ---- Clear pending timers ----
  function clearTimers() {
    timers.forEach(function(t) { clearTimeout(t); });
    timers = [];
  }

  function addTimer(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  // ---- Rabbit positioning ----
  function moveRabbitTo(stoneId) {
    var stone = null;
    if (stoneId === null || stoneId === undefined || stoneId === 0) {
      stone = stonesState.find(function(s) { return s.id === 0; });
      if (stone) {
        rabbitPos   = { x: stone.xPct, y: stone.yPct + (stone.rabbitYOffset || -5) };
        rabbitScale = stone.rabbitScale || 1.2;
      } else {
        rabbitPos   = { x: _RP_HOME_POS.xPct, y: _RP_HOME_POS.yPct };
        rabbitScale = 1.2;
      }
      rabbitVisible = true;
    } else if (stoneId === 11) {
      stone = stonesState.find(function(s) { return s.id === 11; });
      if (stone) {
        rabbitPos   = { x: stone.xPct, y: stone.yPct + (stone.rabbitYOffset || -5) };
        rabbitScale = stone.rabbitScale || 0;
        rabbitVisible = true;
      }
    } else {
      stone = stonesState.find(function(s) { return s.id === stoneId; });
      if (stone) {
        rabbitPos   = { x: stone.xPct, y: stone.yPct + (stone.rabbitYOffset || -5) };
        rabbitScale = stone.rabbitScale || 1;
        rabbitVisible = true;
      }
    }
    applyRabbitPos();
  }

  function applyRabbitPos() {
    if (!$rabbitEl) return;
    $rabbitEl.css({
      left:      rabbitPos.x + '%',
      top:       rabbitPos.y + '%',
      transform: 'translate(-50%,-50%) scale(' + rabbitScale + ')',
      opacity:   rabbitVisible ? 1 : 0
    });

    // Swap forward/reverse image based on phase
    if ($rabbitImg) {
      $rabbitImg.attr('src', phase === "input" ? _RP_RABBIT_REVERSE_SRC : _RP_RABBIT_FORWARD_SRC);
    }
  }

  // ---- Phase countdown ----
  function startPhaseCountdown() {
    stopPhaseCountdown();
    phaseTickTimer = setInterval(function() {
      phaseMsLeft = Math.max(0, phaseMsLeft - 100);
      updatePhaseBar();
    }, 100);
  }

  function stopPhaseCountdown() {
    if (phaseTickTimer) { clearInterval(phaseTickTimer); phaseTickTimer = null; }
  }

  // ---- Global game timer ----
  function startGameTimer() {
    stopGameTimer();
    gameTickTimer = setInterval(function() {
      if (gameMsLeft <= 100) {
        gameMsLeft = 0;
        setPhase("done");
      } else {
        gameMsLeft -= 100;
      }
    }, 100);
  }

  function stopGameTimer() {
    if (gameTickTimer) { clearInterval(gameTickTimer); gameTickTimer = null; }
  }

  // ---- Phase management ----
  function setPhase(p) {
    phase = p;

    stopPhaseCountdown();
    stopGameTimer();

    updateActiveStoneHighlights();
    applyRabbitPos();
    updateCounterUI();

    // Show/hide phase bar
    if (p === "show" || p === "input") {
      updatePhaseBar();
      showPhaseBar(true);
      startPhaseCountdown();
    } else {
      showPhaseBar(false);
    }

    // Global game timer (main game only, not ready/done/trial)
    if (!isTrial && p !== "ready" && p !== "done" && p !== "trial_done") {
      startGameTimer();
    }

    // Overlays
    if ($readyOverlay)    $readyOverlay.toggle(p === "ready");
    if ($doneOverlay)     $doneOverlay.toggle(p === "done");
    if ($pausedModal)     $pausedModal.toggle(p === "paused");
    if ($trialDoneModal)  $trialDoneModal.toggle(p === "trial_done");

    if (p === "done") {
      onGameDone();
    }
  }

  function updatePhaseBar() {
    if (!$phaseBar) return;
    var secs = Math.ceil(phaseMsLeft / 1000);
    if ($phaseSecs) $phaseSecs.text(secs + 's');
    if ($phaseLabel) {
      var lbl = "";
      if (phase === "show")  lbl = "Watch carefully";
      if (phase === "input") lbl = "Trace backwards!";
      $phaseLabel.text(lbl);
    }
  }

  function showPhaseBar(visible) {
    if (!$phaseBar) return;
    if (visible) {
      var isShow = (phase === "show");
      $phaseBar.css({
        display: 'flex',
        background: isShow
          ? 'linear-gradient(to right,rgba(234,179,8,0.95),rgba(202,138,4,0.95))'
          : 'linear-gradient(to right,rgba(22,163,74,0.95),rgba(21,128,61,0.95))',
        border: isShow ? '2px solid rgba(253,224,71,0.6)' : '2px solid rgba(74,222,128,0.6)'
      });
      var icon = isShow ? "&#128064;" : "&#128070;";
      $phaseBar.find('.js-phase-icon').html(icon);
    } else {
      $phaseBar.hide();
    }
  }

  function updateCounterUI() {
    if (!$counterEl) return;
    var isTr    = isTrial;
    var curNum  = isTr ? trialRound + 1 : round + 1;
    var total   = isTr ? 2 : _RP_TOTAL_ROUNDS;
    var bgColor = isTr
      ? 'linear-gradient(to bottom,rgba(234,179,8,0.95),rgba(202,138,4,0.95))'
      : 'linear-gradient(to bottom,rgba(30,58,95,0.95),rgba(15,31,51,0.95))';
    var borderColor = isTr ? 'rgba(253,224,71,0.5)' : 'rgba(59,130,246,0.5)';

    $counterEl.css({
      background:   bgColor,
      border:       '2px solid ' + borderColor
    });
    $counterEl.find('.js-counter-current').text(curNum);
    $counterEl.find('.js-counter-label').text(isTr ? 'Trial' : 'Round')
      .css('color', isTr ? '#fde047' : '#60a5fa');
    $counterEl.find('.js-counter-total').text(total);
  }

  function updateProgressBar() {
    if (!$progressFill) return;
    if (isTrial || phase === "ready") {
      $progressFill.closest('.js-progress-track').hide();
      return;
    }
    $progressFill.closest('.js-progress-track').show();
    var pct = ((round + 1) / _RP_TOTAL_ROUNDS) * 100;
    $progressFill.css('width', pct + '%');
  }

  function updateActiveStoneHighlights() {
    if (!$sceneContainer) return;
    $sceneContainer.find('.js-stone-btn').each(function() {
      var id = parseInt($(this).data('stone-id'));
      var isActive  = (activeStone === id && phase === "show");
      var wasClicked = playerInput.indexOf(id) >= 0;
      $(this).css({
        boxShadow: isActive
          ? '0 0 0 4px rgba(255,255,255,0.4),0 0 12px rgba(255,255,255,0.6)'
          : wasClicked && phase !== 'show'
          ? '0 0 0 4px rgba(255,255,255,0.3)'
          : 'none',
        background: isActive ? 'rgba(255,255,255,0.25)' : 'transparent'
      });
    });
  }

  // ---- Game control handler (Start / Restart) ----
  function handleGameControl() {
    if (phase === "ready") {
      if (isTrial) {
        startRound(0);
      } else {
        gameMsLeft = _RP_GAME_MAX_TIME;
        startRound(0);
      }
    } else {
      // Restart
      clearTimers();
      stopPhaseCountdown();
      stopGameTimer();
      isTrial      = true;
      trialRound   = 0;
      round        = 0;
      score        = 0;
      sequence     = [];
      playerInput  = [];
      activeStone  = null;
      gameMsLeft   = _RP_GAME_MAX_TIME;
      history      = [];
      trialSequence = [];
      bufferActivated = false;
      moveRabbitTo(0);
      setPhase("ready");
    }
  }

  // ---- startRound ----
  function startRound(nextRoundIndex) {
    clearTimers();
    playerInput     = [];
    bufferActivated = false;
    activeStone     = null;
    moveRabbitTo(0);

    var seq = _rpGenerateSequence(stonesState, nextRoundIndex, history, isTrial);
    sequence = seq;

    if (isTrial) {
      trialSequence = seq.slice();
      trialRound    = nextRoundIndex;
    } else {
      round = nextRoundIndex;
    }

    phaseMsLeft = _RP_ROUND_SHOW_MS;
    setPhase("show");

    var stepMs = Math.floor(_RP_ROUND_SHOW_MS / (seq.length + 2));

    addTimer(function() { moveRabbitTo(0); }, 100);

    seq.forEach(function(stoneId, idx) {
      addTimer(function() {
        activeStone = stoneId;
        moveRabbitTo(stoneId);
        updateActiveStoneHighlights();
      }, (idx + 1) * stepMs);
    });

    addTimer(function() {
      activeStone = null;
      moveRabbitTo(11);
      updateActiveStoneHighlights();
    }, (seq.length + 1) * stepMs);

    addTimer(function() {
      phaseMsLeft = _RP_ROUND_INPUT_MS;
      activeStone = null;
      moveRabbitTo(11);
      applyRabbitPos();
      setPhase("input");
    }, _RP_ROUND_SHOW_MS);

    addTimer(function() {
      finishInputAndScore();
    }, _RP_ROUND_SHOW_MS + _RP_ROUND_INPUT_MS);
  }

  // ---- retryWithSameSequence ----
  function retryWithSameSequence() {
    clearTimers();
    playerInput     = [];
    bufferActivated = false;
    moveRabbitTo(0);

    var seq = trialSequence.slice();
    sequence = seq;

    phaseMsLeft = _RP_ROUND_SHOW_MS;
    setPhase("show");

    var stepMs = Math.floor(_RP_ROUND_SHOW_MS / (seq.length + 2));

    addTimer(function() { moveRabbitTo(0); }, 100);

    seq.forEach(function(stoneId, idx) {
      addTimer(function() {
        activeStone = stoneId;
        moveRabbitTo(stoneId);
        updateActiveStoneHighlights();
      }, (idx + 1) * stepMs);
    });

    addTimer(function() {
      activeStone = null;
      moveRabbitTo(11);
      updateActiveStoneHighlights();
    }, (seq.length + 1) * stepMs);

    addTimer(function() {
      phaseMsLeft = _RP_ROUND_INPUT_MS;
      activeStone = null;
      moveRabbitTo(11);
      applyRabbitPos();
      setPhase("input");
    }, _RP_ROUND_SHOW_MS);

    addTimer(function() {
      finishInputAndScore();
    }, _RP_ROUND_SHOW_MS + _RP_ROUND_INPUT_MS);
  }

  // ---- evaluateAndAdvance ----
  function evaluateAndAdvance(input, seq) {
    var reversedSeq = seq.slice().reverse();
    var correct = input.length === reversedSeq.length &&
      input.every(function(v, i) { return v === reversedSeq[i]; });

    if (correct) {
      if (!isTrial) score++;
      moveRabbitTo(0);
    }

    if (!isTrial) {
      history.push({ round: round, sequence: seq.slice(), input: input.slice(), correct: correct });
    }

    clearTimers();

    if (isTrial && !correct) {
      addTimer(function() { retryWithSameSequence(); }, 500);
    } else {
      addTimer(function() { handleNextRound(); }, 500);
    }

    updateCounterUI();
  }

  // ---- finishAfterBuffer ----
  function finishAfterBuffer() {
    if (phase !== "input") return;
    evaluateAndAdvance(playerInput.slice(), sequence.slice());
    phase = "feedback";
  }

  // ---- finishInputAndScore ----
  function finishInputAndScore() {
    if (phase !== "input") return;

    var input = playerInput.slice();
    var seq   = sequence.slice();

    if (input.length === 0) {
      clearTimers();
      setPhase("paused");
      return;
    }

    var reversedSeq    = seq.slice().reverse();
    var isPartialRight = input.length > 0 && input.every(function(v, i) { return v === reversedSeq[i]; });

    if (isPartialRight && !bufferActivated) {
      bufferActivated = true;
      phaseMsLeft     = _RP_BUFFER_MS;
      addTimer(function() { finishAfterBuffer(); }, _RP_BUFFER_MS);
      return;
    }

    evaluateAndAdvance(input, seq);
    phase = "feedback";
  }

  // ---- handleNextRound ----
  function handleNextRound() {
    if (isTrial) {
      var nextTR = trialRound + 1;
      if (nextTR >= 2) {
        setPhase("trial_done");
      } else {
        trialRound = nextTR;
        setTimeout(function() { startRound(nextTR); }, 100);
      }
      return;
    }

    var nextR = round + 1;
    if (nextR >= _RP_TOTAL_ROUNDS) {
      setPhase("done");
    } else {
      round = nextR;
      setTimeout(function() { startRound(nextR); }, 100);
    }
  }

  // ---- onStoneClick ----
  function onStoneClick(stoneId) {
    if (phase !== "input") return;
    if (stoneId === 0 || stoneId === 11) return;

    moveRabbitTo(stoneId);
    playerInput.push(stoneId);

    var idx         = playerInput.length - 1;
    var reversedSeq = sequence.slice().reverse();

    if (stoneId !== reversedSeq[idx]) {
      evaluateAndAdvance(playerInput.slice(), sequence.slice());
    } else {
      if (playerInput.length === reversedSeq.length) {
        setTimeout(function() {
          evaluateAndAdvance(playerInput.slice(), sequence.slice());
        }, 500);
      }
    }

    updateActiveStoneHighlights();
  }

  // ---- handleContinueGame (after paused) ----
  function handleContinueGame() {
    setPhase("ready");
    setTimeout(function() { startRound(round); }, 50);
  }

  // ---- onGameDone ----
  function onGameDone() {
    stopPhaseCountdown();
    stopGameTimer();

    var gameData = {
      userStudentId: userStudentId,
      playerName:    playerName,
      score:         score,
      totalRounds:   _RP_TOTAL_ROUNDS,
      roundsPlayed:  round + 1,
      history:       history.slice(),
      timestamp:     new Date().toISOString(),
      gameType:      'rabbit-path'
    };
    console.log("Rabbit Path game completed:", gameData);
    onComplete(gameData);
  }

  // ---- doExit ----
  function doExit() {
    clearTimers();
    stopPhaseCountdown();
    stopGameTimer();
    onExit();
  }

  // ===========================================================================
  // RENDER FUNCTIONS
  // ===========================================================================

  function renderLoadingScreen() {
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#1e3a5f 0%,#0f1f33 50%,#1a2d47 100%);color:white;">' +
      '<style>@keyframes rpSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>' +
      '<div style="display:flex;flex-direction:column;align-items:center;">' +
      '<div style="width:80px;height:80px;border:4px solid #3b82f6;border-top-color:#93c5fd;border-radius:50%;animation:rpSpin 1s linear infinite;margin-bottom:24px;"></div>' +
      '<p style="font-size:24px;font-weight:700;color:#93c5fd;letter-spacing:2px;">Preparing Adventure...</p>' +
      '<p style="color:rgba(147,197,253,0.6);font-size:14px;margin-top:8px;">Loading river crossing</p>' +
      '</div></div>'
    );
  }

  function renderHowToPlay() {
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#1e3a5f 0%,#0f1f33 50%,#1a2d47 100%);padding:16px;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,rgba(30,58,95,0.9),rgba(15,31,51,0.95));border-radius:24px;padding:24px;' +
      'box-shadow:0 20px 50px rgba(0,0,0,0.5);border:2px solid rgba(59,130,246,0.3);max-width:600px;width:100%;text-align:center;z-index:10;">' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;">' +
      '<span style="font-size:32px;">&#127916;</span>' +
      '<h1 style="font-size:24px;font-weight:800;color:#93c5fd;text-shadow:0 2px 4px rgba(0,0,0,0.3);margin:0;">How To Play</h1>' +
      '</div>' +
      '<p style="color:#60a5fa;font-size:14px;margin-bottom:20px;">Watch this short tutorial before starting, ' + escapeHtml(playerName) + '!</p>' +
      '<div style="background:#000;border-radius:16px;overflow:hidden;margin-bottom:20px;border:3px solid rgba(59,130,246,0.4);">' +
      '<video id="rp-htp-video" src="' + _RP_HOW_TO_PLAY_VIDEO + '" controls autoplay style="width:100%;max-height:300px;display:block;">Your browser does not support the video tag.</video>' +
      '</div>' +
      '<div style="background:rgba(59,130,246,0.2);border-radius:12px;padding:12px 16px;margin-bottom:20px;border:1px solid rgba(59,130,246,0.3);">' +
      '<p style="color:#93c5fd;font-size:13px;">&#128032; Watch the rabbit hop on stones, then trace the path backwards!<br>' +
      '<span style="color:rgba(147,197,253,0.8);">After the video: <strong>2 practice rounds</strong> &rarr; <strong>' + _RP_TOTAL_ROUNDS + ' main rounds</strong></span></p>' +
      '</div>' +
      '<button id="rp-htp-btn" style="width:100%;padding:14px 24px;font-size:16px;font-weight:700;color:#0f1f33;' +
      'background:linear-gradient(to right,#60a5fa,#3b82f6,#60a5fa);border:2px solid rgba(147,197,253,0.5);' +
      'border-radius:14px;cursor:pointer;box-shadow:0 8px 20px rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center;gap:12px;">' +
      'I Understand, Start Practice! <span style="font-size:18px;">&#127919;</span></button>' +
      '</div></div>'
    );
    $c.find('#rp-htp-video').on('ended', onHtpComplete);
    $c.find('#rp-htp-btn').on('click', onHtpComplete);
  }

  function onHtpComplete() {
    showHowToPlayVideo = false;
    renderGame();
  }

  // ---- renderGame: main game scene ----
  function renderGame() {
    var html =
      '<style>' +
      '@keyframes rpSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
      '</style>' +
      // root container
      '<div id="rp-root" style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;position:relative;overflow:hidden;' +
      'background:linear-gradient(135deg,#1e3a5f 0%,#0f1f33 30%,#071520 50%,#1a2d47 75%,#0f1f33 100%);' +
      'font-family:system-ui,-apple-system,sans-serif;padding:16px;">' +

      // pattern overlay
      '<div style="position:absolute;inset:0;opacity:0.1;' +
      'background-image:url(\'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\'%3E' +
      '%3Cpath d=\'M30 0 L60 30 L30 60 L0 30 Z\' fill=\'none\' stroke=\'%233b82f6\' stroke-width=\'1\'/%3E%3C/svg%3E\');' +
      'pointer-events:none;"></div>' +

      // progress bar (hidden initially)
      '<div class="js-progress-track" style="display:none;position:absolute;top:0;left:0;width:100%;height:8px;' +
      'background:linear-gradient(to right,#1e3a5f,#2d4a6f,#1e3a5f);z-index:30;">' +
      '<div class="js-progress-fill" style="height:100%;width:0%;background:linear-gradient(to right,#3b82f6,#60a5fa,#3b82f6);transition:width 0.3s ease-out;"></div>' +
      '</div>' +

      // player info top-left
      '<div style="position:absolute;top:20px;left:16px;z-index:20;background:rgba(30,58,95,0.9);padding:10px 16px;border-radius:12px;' +
      'border:1px solid rgba(59,130,246,0.4);display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:20px;">&#128032;</span>' +
      '<div><div style="font-size:10px;color:rgba(147,197,253,0.7);text-transform:uppercase;letter-spacing:1px;">Explorer</div>' +
      '<div style="color:#93c5fd;font-weight:700;font-size:14px;">' + escapeHtml(playerName) + '</div></div>' +
      '</div>' +

      // counter top-center
      '<div class="js-counter" style="position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:20;' +
      'background:linear-gradient(to bottom,rgba(234,179,8,0.95),rgba(202,138,4,0.95));' +
      'padding:10px 24px;border-radius:14px;border:2px solid rgba(253,224,71,0.5);box-shadow:0 4px 20px rgba(0,0,0,0.4);">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
      '<span class="js-counter-label" style="color:#fde047;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Trial</span>' +
      '<span class="js-counter-current" style="color:#fef08a;font-weight:900;font-size:22px;">1</span>' +
      '<span style="color:#ca8a04;font-weight:700;font-size:18px;">/</span>' +
      '<span class="js-counter-total" style="color:rgba(253,224,71,0.7);font-weight:600;font-size:18px;">2</span>' +
      '</div></div>' +

      // controls top-right
      '<div style="position:absolute;top:20px;right:16px;z-index:50;display:flex;gap:10px;">' +
      '<button id="rp-ctrl-btn" style="background:linear-gradient(to bottom right,#2563eb,#1d4ed8);color:white;padding:10px 16px;' +
      'border-radius:12px;border:1px solid rgba(59,130,246,0.4);cursor:pointer;font-size:14px;font-weight:600;">' +
      '&#128640; Start</button>' +
      '<button id="rp-exit-btn" style="background:linear-gradient(to bottom right,#991b1b,#7f1d1d);color:white;padding:10px;' +
      'border-radius:12px;border:1px solid rgba(239,68,68,0.4);cursor:pointer;font-size:18px;" title="Exit">&#10005;</button>' +
      '</div>' +

      // phase bar (bottom-center, hidden initially)
      '<div class="js-phase-bar" style="display:none;position:absolute;bottom:20px;left:50%;transform:translateX(-50%);' +
      'z-index:20;padding:12px 32px;border-radius:16px;align-items:center;gap:16px;">' +
      '<span class="js-phase-icon" style="font-size:24px;">&#128064;</span>' +
      '<div style="text-align:center;">' +
      '<p class="js-phase-lbl" style="color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;margin-bottom:2px;"></p>' +
      '<p class="js-phase-secs" style="color:#fff;font-size:24px;font-weight:900;margin:0;"></p>' +
      '</div></div>' +

      // game area wrapper
      '<div class="js-game-area" style="position:relative;z-index:10;width:100%;max-width:900px;user-select:none;">' +

      // game frame
      '<div style="position:relative;background:linear-gradient(135deg,#1e3a5f 0%,#0f1f33 50%,#1a2d47 100%);' +
      'padding:12px;border-radius:20px;box-shadow:0 15px 50px rgba(0,0,0,0.5);border:4px solid #3b82f6;">' +
      '<div style="background:linear-gradient(135deg,#0f1f33,#071520);padding:6px;border-radius:14px;">' +

      // scene container (16:9)
      '<div class="js-scene" style="position:relative;width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;' +
      'box-shadow:inset 0 4px 20px rgba(0,0,0,0.5);">' +

      // bg image
      '<img src="' + _RP_SCENE_SRC + '" alt="Jungle river scene" ' +
      'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;" draggable="false">' +

      // rabbit
      '<div class="js-rabbit" style="position:absolute;z-index:10;width:14%;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;' +
      'left:' + rabbitPos.x + '%;top:' + rabbitPos.y + '%;transform:translate(-50%,-50%) scale(' + rabbitScale + ');">' +
      '<img class="js-rabbit-img" src="' + _RP_RABBIT_FORWARD_SRC + '" alt="Rabbit" ' +
      'style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 20px rgba(0,0,0,0.6));" draggable="false">' +
      '</div>' +

      // stones will be inserted here
      buildStonesHTML() +

      // ready overlay
      '<div class="js-ready-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);">' +
      '<div style="padding:24px 32px;border-radius:24px;background:rgba(30,58,95,0.95);border:2px solid rgba(59,130,246,0.4);text-align:center;max-width:400px;">' +
      '<span style="font-size:48px;">&#128032;</span>' +
      '<h2 style="font-size:24px;font-weight:800;color:#93c5fd;margin-top:12px;">Rabbit\'s Path</h2>' +
      '<p style="color:rgba(147,197,253,0.8);font-size:14px;margin-top:8px;">Watch the rabbit jump on stones, then trace the path backwards!</p>' +
      '<button id="rp-ready-start" style="margin-top:20px;padding:12px 32px;font-size:18px;font-weight:700;color:#0f1f33;' +
      'background:linear-gradient(to right,#60a5fa,#3b82f6);border:2px solid rgba(147,197,253,0.5);border-radius:14px;cursor:pointer;">Start Trial &#127919;</button>' +
      '</div></div>' +

      // done overlay (hidden)
      '<div class="js-done-overlay" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);">' +
      '<div style="padding:32px;border-radius:24px;background:linear-gradient(135deg,rgba(30,58,95,0.95),rgba(15,31,51,0.95));' +
      'border:2px solid rgba(59,130,246,0.4);text-align:center;max-width:400px;">' +
      '<div style="width:80px;height:80px;margin:0 auto;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;"><span style="font-size:40px;">&#127942;</span></div>' +
      '<h2 style="font-size:28px;font-weight:800;color:#93c5fd;margin-top:16px;">Game Complete!</h2>' +
      '<p style="color:rgba(147,197,253,0.8);font-size:16px;margin-top:8px;">Well done, ' + escapeHtml(playerName) + '!</p>' +
      '<div style="margin-top:20px;padding:16px;background:rgba(59,130,246,0.2);border-radius:12px;border:1px solid rgba(59,130,246,0.3);">' +
      '<div class="js-done-score" style="font-size:32px;font-weight:700;color:#60a5fa;">0</div>' +
      '<div style="font-size:12px;color:rgba(147,197,253,0.7);text-transform:uppercase;letter-spacing:1px;">Correct out of ' + _RP_TOTAL_ROUNDS + '</div>' +
      '</div>' +
      '<button id="rp-done-exit" style="margin-top:20px;padding:12px 32px;font-size:16px;font-weight:700;color:#0f1f33;' +
      'background:linear-gradient(to right,#60a5fa,#3b82f6);border:2px solid rgba(147,197,253,0.5);border-radius:14px;cursor:pointer;">' +
      'Continue &#127775;</button>' +
      '</div></div>' +

      '</div></div></div>' + // scene, inner frame, game frame

      '</div>' + // game area

      // paused modal
      '<div class="js-paused-modal" style="display:none;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);">' +
      '<div style="background:linear-gradient(135deg,rgba(30,58,95,0.95),rgba(15,31,51,0.95));border-radius:24px;padding:32px;' +
      'max-width:400px;width:90%;text-align:center;border:3px solid rgba(234,179,8,0.5);">' +
      '<span style="font-size:48px;">&#129488;</span>' +
      '<h2 style="font-size:24px;font-weight:800;color:#fcd34d;margin-top:12px;">Please Focus!</h2>' +
      '<p style="color:rgba(253,224,71,0.8);font-size:14px;margin-top:8px;">It seems you\'re distracted. Ready to try again?</p>' +
      '<button id="rp-continue-btn" style="margin-top:24px;padding:12px 32px;font-size:16px;font-weight:700;color:#1a2e05;' +
      'background:linear-gradient(to right,#22c55e,#16a34a);border:2px solid rgba(74,222,128,0.5);border-radius:14px;cursor:pointer;">Continue Game</button>' +
      '</div></div>' +

      // trial_done modal
      '<div class="js-trial-done-modal" style="display:none;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);">' +
      '<div style="background:linear-gradient(135deg,rgba(30,58,95,0.95),rgba(15,31,51,0.95));border-radius:24px;padding:32px;' +
      'max-width:450px;width:90%;text-align:center;border:3px solid rgba(34,197,94,0.5);">' +
      '<span style="font-size:48px;">&#127881;</span>' +
      '<h2 style="font-size:24px;font-weight:800;color:#4ade80;margin-top:12px;">Trial Complete!</h2>' +
      '<p style="color:rgba(134,239,172,0.8);font-size:14px;margin-top:8px;">You\'ve finished the practice rounds. Ready for the real game?</p>' +
      '<div style="display:flex;gap:12px;margin-top:24px;justify-content:center;">' +
      '<button id="rp-retry-trial-btn" style="padding:12px 24px;font-size:14px;font-weight:700;color:#374151;' +
      'background:linear-gradient(to right,#e5e7eb,#d1d5db);border:2px solid rgba(156,163,175,0.5);border-radius:12px;cursor:pointer;">Retry Trial</button>' +
      '<button id="rp-start-main-btn" style="padding:12px 24px;font-size:14px;font-weight:700;color:#1a2e05;' +
      'background:linear-gradient(to right,#22c55e,#16a34a);border:2px solid rgba(74,222,128,0.5);border-radius:12px;cursor:pointer;">Start Game &#128640;</button>' +
      '</div></div></div>' +

      '</div>'; // rp-root

    $c.html(html);

    // Cache DOM refs
    $progressFill   = $c.find('.js-progress-fill');
    $counterEl      = $c.find('.js-counter');
    $phaseBar       = $c.find('.js-phase-bar');
    $phaseLabel     = $c.find('.js-phase-lbl');
    $phaseSecs      = $c.find('.js-phase-secs');
    $sceneContainer = $c.find('.js-scene');
    $rabbitEl       = $c.find('.js-rabbit');
    $rabbitImg      = $c.find('.js-rabbit-img');
    $readyOverlay   = $c.find('.js-ready-overlay');
    $doneOverlay    = $c.find('.js-done-overlay');
    $pausedModal    = $c.find('.js-paused-modal');
    $trialDoneModal = $c.find('.js-trial-done-modal');
    $gameControlBtn = $c.find('#rp-ctrl-btn');

    // Wire events
    $c.find('#rp-ctrl-btn').on('click', handleGameControl);
    $c.find('#rp-exit-btn').on('click', function() { doExit(); });
    $c.find('#rp-ready-start').on('click', handleGameControl);
    $c.find('#rp-continue-btn').on('click', handleContinueGame);
    $c.find('#rp-done-exit').on('click', function() { doExit(); });
    $c.find('#rp-retry-trial-btn').on('click', function() {
      // Retry trial
      setPhase("ready");
      trialRound = 0;
      isTrial    = true;
      if ($readyOverlay) $readyOverlay.show();
      setTimeout(function() { startRound(0); }, 500);
    });
    $c.find('#rp-start-main-btn').on('click', function() {
      // Start main game
      isTrial    = false;
      round      = 0;
      score      = 0;
      history    = [];
      setPhase("ready");
      if ($readyOverlay) {
        $readyOverlay.show();
        $readyOverlay.find('button').text('Start Game 🚀');
      }
      setTimeout(function() {
        gameMsLeft = _RP_GAME_MAX_TIME;
        startRound(0);
      }, 500);
    });

    // Stone click events
    $c.find('.js-stone-btn').on('click', function() {
      var id = parseInt($(this).data('stone-id'));
      onStoneClick(id);
    });

    // Initial UI state
    updateCounterUI();
    updateProgressBar();
    applyRabbitPos();
  }

  function buildStonesHTML() {
    var html = '';
    stonesState.forEach(function(s) {
      html +=
        '<div style="position:absolute;left:' + s.xPct + '%;top:' + s.yPct + '%;' +
        'width:' + (s.rPct * 2) + '%;height:' + (s.rPct * 2) + '%;transform:translate(-50%,-50%);">' +
        '<button class="js-stone-btn" data-stone-id="' + s.id + '" ' +
        'aria-label="Stone ' + s.id + '" ' +
        'style="width:100%;height:100%;border-radius:50%;border:none;background:transparent;' +
        'cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;"></button>' +
        '</div>';
    });
    return html;
  }

  // ===========================================================================
  // BOOTSTRAP
  // ===========================================================================
  renderLoadingScreen();
  preloadImages(function() {
    imagesLoaded = true;
    renderHowToPlay();
  });
}
