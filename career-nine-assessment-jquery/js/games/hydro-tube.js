/**
 * hydro-tube.js
 * HydroTube Game (code 103) — Pipe-rotation / spatial-reasoning task
 * Converted from HydroTubeGame.tsx (React) to vanilla JS / jQuery
 *
 * Usage:
 *   HydroTubeGame({ container, userStudentId, playerName, onComplete, onExit })
 *
 * onComplete(data) is called when the timer runs out or all 2 patterns are completed.
 * onExit()        is called when the user clicks the exit (✕) button.
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
var _HT_HOW_TO_PLAY_VIDEO = "/assets/game/hydro-tube-tutorial.mp4";

// ---------------------------------------------------------------------------
// Pattern definitions (identical to the React source)
// ---------------------------------------------------------------------------
var _HT_PATTERNS = [
  {
    id: 0,
    name: "Pattern A",
    tileTypes: {
      1:"t-pipe", 2:"bend",     3:"bend",     4:"straight",
      5:"straight",6:"bend",    7:"straight", 8:"bend",
      9:"bend",   10:"bend",   11:"straight",12:"bend",
      13:"straight",14:"bend", 15:"straight",16:"bend"
    },
    solutions: [
      [90,90,0,0,0,270,90,90,270,90,90,180,0,270,90,90],
      [270,0,0,0,0,0,0,0,270,90,0,0,0,270,90,90],
      [90,90,0,0,0,270,90,90,270,90,90,180,0,270,180,90],
      [270,90,0,0,0,270,90,90,0,0,90,180,0,270,90,90]
    ]
  },
  {
    id: 1,
    name: "Pattern B",
    tileTypes: {
      1:"bend",  2:"bend",   3:"bend",   4:"straight",
      5:"bend",  6:"bend",   7:"bend",   8:"t-pipe",
      9:"bend",  10:"t-pipe",11:"straight",12:"bend",
      13:"straight",14:"straight",15:"bend",16:"straight"
    },
    solutions: [
      [270,90,0,0,0,180,0,0,270,0,90,90,0,0,0,0]
    ]
  },
  {
    id: 2,
    name: "Pattern C",
    tileTypes: {
      1:"bend",  2:"bend",   3:"straight",4:"bend",
      5:"straight",6:"bend", 7:"t-pipe", 8:"straight",
      9:"bend",  10:"straight",11:"bend",12:"straight",
      13:"bend", 14:"straight",15:"straight",16:"bend"
    },
    solutions: [
      [270,90,0,0,0,270,0,0,0,90,180,0,270,90,90,90]
    ]
  }
];

// ---------------------------------------------------------------------------
// SVG pipe renderers — returns an HTML string for each pipe type
// ---------------------------------------------------------------------------
function _htRenderPipeSVG(type) {
  if (type === "straight") {
    return '<svg viewBox="0 0 100 100" style="width:100%;height:100%;" preserveAspectRatio="none">' +
      '<rect x="35" y="0" width="30" height="100" fill="#60a5fa"/>' +
      '<rect x="37" y="0" width="8"  height="100" fill="#3b82f6" opacity="0.4"/>' +
      '<rect x="57" y="0" width="6"  height="100" fill="#93c5fd" opacity="0.6"/>' +
      '<rect x="48" y="0" width="4"  height="100" fill="#dbeafe" opacity="0.5"/>' +
      '<rect x="32" y="15" width="36" height="5" fill="#3b82f6" rx="2"/>' +
      '<rect x="32" y="47" width="36" height="5" fill="#3b82f6" rx="2"/>' +
      '<rect x="32" y="80" width="36" height="5" fill="#3b82f6" rx="2"/>' +
      '</svg>';
  } else if (type === "bend") {
    return '<svg viewBox="0 0 100 100" style="width:100%;height:100%;" preserveAspectRatio="none">' +
      '<path d="M 35 100 L 35 50 Q 35 35 50 35 L 100 35 L 100 65 L 50 65 Q 65 65 65 50 L 65 100 Z" fill="#60a5fa"/>' +
      '<path d="M 39 100 L 39 50 Q 39 39 50 39 L 100 39" stroke="#3b82f6" stroke-width="10" fill="none" opacity="0.4"/>' +
      '<path d="M 61 100 L 61 50 Q 61 46 65 46 L 100 46" stroke="#93c5fd" stroke-width="8" fill="none" opacity="0.6"/>' +
      '<path d="M 48 100 L 48 50 Q 48 42 54 42 L 100 42" stroke="#dbeafe" stroke-width="5" fill="none" opacity="0.5"/>' +
      '<rect x="32" y="82" width="36" height="5" fill="#3b82f6" rx="2"/>' +
      '<rect x="82" y="32" width="5"  height="36" fill="#3b82f6" rx="2"/>' +
      '</svg>';
  } else if (type === "t-pipe") {
    return '<svg viewBox="0 0 100 100" style="width:100%;height:100%;" preserveAspectRatio="none">' +
      '<rect x="35" y="50" width="30" height="50" fill="#60a5fa"/>' +
      '<rect x="0"  y="35" width="100" height="30" fill="#60a5fa"/>' +
      '<circle cx="50" cy="50" r="22" fill="#3b82f6"/>' +
      '<circle cx="50" cy="50" r="18" fill="#60a5fa"/>' +
      '<rect x="37" y="50"  width="8"   height="50"  fill="#3b82f6" opacity="0.4"/>' +
      '<rect x="0"  y="37"  width="100" height="8"   fill="#3b82f6" opacity="0.4"/>' +
      '<rect x="57" y="50"  width="6"   height="50"  fill="#93c5fd" opacity="0.6"/>' +
      '<rect x="0"  y="57"  width="100" height="6"   fill="#93c5fd" opacity="0.6"/>' +
      '<circle cx="46" cy="46" r="10" fill="#93c5fd" opacity="0.5"/>' +
      '<circle cx="48" cy="48" r="6"  fill="#dbeafe" opacity="0.6"/>' +
      '<rect x="32" y="80" width="36" height="5" fill="#3b82f6" rx="2"/>' +
      '<rect x="15" y="32" width="5"  height="36" fill="#3b82f6" rx="2"/>' +
      '<rect x="80" y="32" width="5"  height="36" fill="#3b82f6" rx="2"/>' +
      '</svg>';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Tap-faucet SVG (static, shown top-left of grid)
// ---------------------------------------------------------------------------
function _htTapSVG() {
  return '<svg viewBox="0 0 120 150" style="width:100px;height:120px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));">' +
    '<rect x="25" y="5" width="70" height="22" fill="#94a3b8" stroke="#64748b" stroke-width="3" rx="11"/>' +
    '<circle cx="40" cy="16" r="5" fill="#cbd5e1"/>' +
    '<circle cx="80" cy="16" r="5" fill="#cbd5e1"/>' +
    '<ellipse cx="60" cy="50" rx="32" ry="28" fill="#e0f2fe" stroke="#bae6fd" stroke-width="3"/>' +
    '<circle cx="50" cy="44" r="4" fill="#334155"/>' +
    '<circle cx="70" cy="44" r="4" fill="#334155"/>' +
    '<path d="M 48 56 Q 60 64 72 56" stroke="#334155" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<rect x="48" y="15" width="24" height="18" fill="#60a5fa" stroke="#3b82f6" stroke-width="3" rx="9"/>' +
    '<circle cx="60" cy="24" r="5" fill="#93c5fd"/>' +
    '<ellipse cx="54" cy="42" rx="14" ry="18" fill="#ffffff" opacity="0.5"/>' +
    '<path d="M 54 72 Q 54 82 60 92 Q 60 98 60 105" stroke="#bae6fd" stroke-width="16" fill="none" stroke-linecap="round"/>' +
    '<path d="M 56 72 Q 56 82 60 92 Q 60 98 60 105" stroke="#e0f2fe" stroke-width="12" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="60" cy="105" rx="10" ry="6" fill="#bae6fd" stroke="#93c5fd" stroke-width="2"/>' +
    '<defs><linearGradient id="htWFG" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.8"/>' +
    '<stop offset="100%" stop-color="#93c5fd" stop-opacity="0.1"/></linearGradient></defs>' +
    '<path d="M 60 105 L 60 160" stroke="url(#htWFG)" stroke-width="14" stroke-linecap="butt"/>' +
    '<path d="M 60 105 L 60 160" stroke="#60a5fa" stroke-width="8" stroke-opacity="0.5" stroke-linecap="butt"/>' +
    '</svg>';
}

// ---------------------------------------------------------------------------
// Bucket SVG (static, shown bottom-right of grid)
// ---------------------------------------------------------------------------
function _htBucketSVG(bouncing) {
  var anim = bouncing ? 'animation:htBounce 1s infinite;' : '';
  return '<svg viewBox="0 0 150 160" style="width:100px;height:110px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));' + anim + '">' +
    '<path d="M 32 28 Q 75 6 118 28" stroke="#94a3b8" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<circle cx="32" cy="28" r="6" fill="#64748b" stroke="#475569" stroke-width="2"/>' +
    '<circle cx="118" cy="28" r="6" fill="#64748b" stroke="#475569" stroke-width="2"/>' +
    '<path d="M 22 35 L 12 125 Q 12 142 28 148 L 122 148 Q 138 142 138 125 L 128 35 Z" fill="#f87171" stroke="#ef4444" stroke-width="3"/>' +
    '<ellipse cx="75" cy="35" rx="56" ry="14" fill="#fca5a5" stroke="#f87171" stroke-width="2"/>' +
    '<ellipse cx="75" cy="35" rx="50" ry="11" fill="#fecaca"/>' +
    '<ellipse cx="42" cy="75" rx="18" ry="40" fill="#fee2e2" opacity="0.7"/>' +
    '<circle cx="65" cy="70" r="4" fill="#7f1d1d"/>' +
    '<circle cx="85" cy="70" r="4" fill="#7f1d1d"/>' +
    '<path d="M 62 84 Q 75 92 88 84" stroke="#7f1d1d" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M 28 105 L 20 130 Q 20 138 32 142 L 118 142 Q 130 138 130 130 L 122 105 Z" fill="#60a5fa" opacity="0.9"/>' +
    '<ellipse cx="75" cy="115" rx="38" ry="10" fill="#93c5fd" opacity="0.9"/>' +
    '<ellipse cx="75" cy="122" rx="32" ry="6" fill="#bfdbfe" opacity="0.7"/>' +
    '</svg>';
}

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------
function HydroTubeGame(opts) {
  var container     = opts.container;
  var userStudentId = opts.userStudentId;
  var playerName    = opts.playerName;
  var onComplete    = opts.onComplete;
  var onExit        = opts.onExit;

  var $c = $(container);

  // ---- mutable state ----
  var showHowToPlayVideo = true;
  var isTrial            = true;
  var trialComplete      = false;

  var tileRotations      = {};   // { tileNumber: rotation(0|90|180|270) }
  var isWon              = false;
  var patternId          = 2;    // default to Pattern C for trial
  var completedPatterns  = [];
  var lastClickedTile    = null;
  var consecutiveClicks  = 0;
  var aimlessRotations   = 0;
  var timeLeft           = 180;
  var isInitialized      = false;
  var gameEnded          = false;

  var curiousClicks      = 0;
  var highlightedTile    = null;
  var tilesCorrect       = 0;
  var totalSolutionTiles = 16;

  var timerInterval      = null;
  var highlightTimeout   = null;

  // Derived helper
  function currentPattern() {
    return _HT_PATTERNS.find(function(p) { return p.id === patternId; });
  }

  // ---- Scoring helpers (identical logic from React) ----
  function checkWin(rotations) {
    var pat = currentPattern();
    var playerRots = [];
    for (var i = 1; i <= 16; i++) {
      playerRots.push(rotations[i] || 0);
    }
    return pat.solutions.some(function(solution) {
      return solution.every(function(solRot, i) {
        var pr = playerRots[i];
        return solRot === 0 || solRot === pr;
      });
    });
  }

  function calculateProgress(rotations) {
    var pat = currentPattern();
    var playerRots = [];
    for (var i = 1; i <= 16; i++) {
      playerRots.push(rotations[i] || 0);
    }

    var best = 0;
    pat.solutions.forEach(function(solution) {
      var cnt = 0;
      solution.forEach(function(solRot, i) {
        if (solRot === 0 || solRot === playerRots[i]) cnt++;
      });
      if (cnt > best) best = cnt;
    });

    return { correct: best, total: 16 };
  }

  // ---- Timer ----
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(function() {
      timeLeft--;

      // Hint: highlight a random tile at 135s, 90s, 45s remaining
      if (timeLeft === 135 || timeLeft === 90 || timeLeft === 45) {
        highlightedTile = Math.floor(Math.random() * 16) + 1;
        updateTileHighlight(highlightedTile, true);
        if (highlightTimeout) clearTimeout(highlightTimeout);
        highlightTimeout = setTimeout(function() {
          if (highlightedTile !== null) {
            updateTileHighlight(highlightedTile, false);
            highlightedTile = null;
          }
        }, 5000);
      }

      if (timeLeft <= 0) {
        timeLeft = 0;
        stopTimer();
        gameEnded = true;
        triggerGameEnd();
      }

      updateTimerUI();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function updateTimerUI() {
    var $timerEl = $c.find('.ht-timer-val');
    if (!$timerEl.length) return;
    $timerEl.text(formatTime(timeLeft));
    if (timeLeft < 30) {
      $timerEl.css({ color: '#fca5a5', animation: 'htPulse 1s infinite' });
      $c.find('.ht-timer-badge').css({
        background: 'linear-gradient(to bottom,rgba(220,38,38,0.95),rgba(185,28,28,0.95))',
        border:     '2px solid rgba(248,113,113,0.5)'
      });
    }
  }

  function formatTime(s) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ---- triggerGameEnd ----
  function triggerGameEnd() {
    stopTimer();
    var gameData = {
      userStudentId:      userStudentId,
      playerName:         playerName,
      patternsCompleted:  completedPatterns.length,
      totalPatterns:      2,
      aimlessRotations:   aimlessRotations,
      curiousClicks:      curiousClicks,
      tilesCorrect:       tilesCorrect,
      totalTiles:         totalSolutionTiles,
      timeSpentSeconds:   180 - timeLeft,
      timestamp:          new Date().toISOString(),
      gameType:           "hydro-tube"
    };
    console.log("Hydro tube game data:", gameData);
    onComplete(gameData);
  }

  // ---- loadNextPattern ----
  function loadNextPattern() {
    if (isTrial) {
      // Trial complete
      trialComplete = true;
      isWon         = false;
      renderTrialComplete();
      return;
    }

    completedPatterns.push(patternId);

    if (completedPatterns.length >= 2) {
      tilesCorrect = 16;
      gameEnded    = true;
      triggerGameEnd();
      return;
    }

    // Find next pattern (excluding Pattern C which is for trial)
    var available = _HT_PATTERNS.filter(function(p) {
      return p.id !== 2 && completedPatterns.indexOf(p.id) < 0;
    });

    if (available.length > 0) {
      patternId       = available[0].id;
      tileRotations   = {};
      isWon           = false;
      lastClickedTile = null;
      consecutiveClicks = 0;
      highlightedTile = null;
      renderGrid();
      updatePatternLabel();
    }
  }

  // ---- handleTileClick ----
  function handleTileClick(tileNumber) {
    if (isWon) return;

    if (!isTrial) {
      // Track curious clicks
      if (tileNumber === highlightedTile) {
        curiousClicks++;
        if (highlightTimeout) clearTimeout(highlightTimeout);
        updateTileHighlight(highlightedTile, false);
        highlightedTile = null;
        updateStatsUI();
      }

      // Track aimless rotations (4+ consecutive clicks on same tile)
      if (lastClickedTile === tileNumber) {
        consecutiveClicks++;
        if (consecutiveClicks === 4) {
          aimlessRotations++;
          consecutiveClicks = 0;
          updateStatsUI();
        }
      } else {
        lastClickedTile   = tileNumber;
        consecutiveClicks = 1;
      }
    }

    // Rotate tile
    var current    = tileRotations[tileNumber] || 0;
    var newRot     = (current + 90) % 360;
    tileRotations[tileNumber] = newRot;

    // Animate tile
    var $tile = $c.find('.ht-tile[data-tile="' + tileNumber + '"]');
    $tile.css('transform', 'rotate(' + newRot + 'deg)');

    // Check win (only in main game, track progress always)
    if (!isTrial) {
      var prog = calculateProgress(tileRotations);
      tilesCorrect       = prog.correct;
      totalSolutionTiles = prog.total;
    }

    if (checkWin(tileRotations)) {
      setTimeout(function() {
        isWon = true;
        showWinOverlay();
      }, 500);
    }
  }

  // ---- DOM update helpers ----
  function updateTileHighlight(tileNumber, on) {
    var $tile = $c.find('.ht-tile[data-tile="' + tileNumber + '"]');
    if (!$tile.length) return;
    if (on) {
      $tile.css({
        background: 'linear-gradient(145deg,#fef3c7 0%,#fde68a 100%)',
        border:     '3px solid #f59e0b',
        boxShadow:  'inset 0 0 15px #f59e0b,0 0 20px #f59e0b',
        animation:  'htPulse 1.5s infinite'
      });
    } else {
      $tile.css({
        background: 'linear-gradient(145deg,#ffffff 0%,#f1f5f9 100%)',
        border:     '1px solid #e2e8f0',
        boxShadow:  'inset 0 2px 6px rgba(0,0,0,0.08)',
        animation:  'none'
      });
    }
  }

  function updateStatsUI() {
    $c.find('.ht-stat-aimless').text('&#128260; ' + aimlessRotations);
    $c.find('.ht-stat-curious').text('&#10024; ' + curiousClicks);
    $c.find('.ht-pattern-label').text(currentPattern().name);
    $c.find('.ht-pattern-done').text(completedPatterns.length + '/2 Complete');
  }

  function updatePatternLabel() {
    $c.find('.ht-pattern-label').text(currentPattern().name);
    $c.find('.ht-pattern-done').text(completedPatterns.length + '/2 Complete');
  }

  function showWinOverlay() {
    var $grid = $c.find('.ht-grid-frame');
    if (!$grid.length) return;

    $grid.css({
      background: 'linear-gradient(135deg,#059669 0%,#047857 100%)',
      boxShadow:  '0 15px 50px rgba(5,150,105,0.5)',
      border:     '4px solid #10b981'
    });

    var nextLabel = (completedPatterns.length + 1 >= 2) ? 'Finish! &#127942;' : 'Next Pattern &#128167;';

    var winHTML =
      '<div class="ht-win-overlay" style="position:absolute;inset:0;background:rgba(5,150,105,0.9);backdrop-filter:blur(4px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:30;border-radius:16px;">' +
      '<span style="font-size:64px;margin-bottom:16px;animation:htBounce 1s infinite;">&#127881;</span>' +
      '<h2 style="font-size:28px;font-weight:800;color:white;margin-bottom:8px;text-shadow:0 2px 4px rgba(0,0,0,0.3);">Perfect Flow!</h2>' +
      '<p style="color:rgba(255,255,255,0.9);font-size:16px;margin-bottom:8px;">' + currentPattern().name + ' Complete!</p>' +
      '<p style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:24px;">' +
      (completedPatterns.length + 1) + ' of 2 patterns done</p>' +
      '<button class="ht-next-pattern-btn" style="padding:14px 32px;font-size:18px;font-weight:700;color:#059669;background:white;' +
      'border:none;border-radius:14px;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,0.3);">' +
      nextLabel + '</button>' +
      '</div>';

    $grid.append(winHTML);
    $c.find('.ht-next-pattern-btn').on('click', loadNextPattern);
  }

  // ---- renderGrid (redraws just the 4×4 grid inside the frame) ----
  function renderGrid() {
    var pat   = currentPattern();
    var $grid = $c.find('.ht-tile-grid');
    if (!$grid.length) return;

    $grid.empty();

    for (var i = 1; i <= 16; i++) {
      var tileType = pat.tileTypes[i];
      var rot      = tileRotations[i] || 0;
      var $tile    = $('<div>').addClass('ht-tile').attr('data-tile', i).css({
        width:      '80px',
        height:     '80px',
        background: 'linear-gradient(145deg,#ffffff 0%,#f1f5f9 100%)',
        cursor:     'pointer',
        transform:  'rotate(' + rot + 'deg)',
        transition: 'transform 0.3s cubic-bezier(0.68,-0.55,0.265,1.55)',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow:   'hidden',
        borderRadius: '8px',
        boxShadow:  'inset 0 2px 6px rgba(0,0,0,0.08)',
        border:     '1px solid #e2e8f0'
      });
      $tile.html(_htRenderPipeSVG(tileType));
      $tile.on('click', (function(tn) {
        return function() { handleTileClick(tn); };
      })(i));
      $grid.append($tile);
    }
  }

  // ===========================================================================
  // RENDER FUNCTIONS
  // ===========================================================================

  function renderHowToPlay() {
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#0c4a6e 0%,#075985 30%,#0369a1 50%,#0284c7 75%,#0ea5e9 100%);' +
      'padding:16px;position:relative;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,rgba(12,74,110,0.95),rgba(7,89,133,0.95));border-radius:24px;padding:24px;' +
      'box-shadow:0 20px 50px rgba(0,0,0,0.5);border:2px solid rgba(56,189,248,0.3);max-width:600px;width:100%;text-align:center;z-index:10;">' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;">' +
      '<span style="font-size:32px;">&#127916;</span>' +
      '<h1 style="font-size:24px;font-weight:800;color:#7dd3fc;text-shadow:0 2px 4px rgba(0,0,0,0.3);margin:0;">How To Play</h1>' +
      '</div>' +
      '<p style="color:#38bdf8;font-size:14px;margin-bottom:20px;">Watch this short tutorial before starting, ' + escapeHtml(playerName) + '!</p>' +
      '<div style="background:#000;border-radius:16px;overflow:hidden;margin-bottom:20px;border:3px solid rgba(56,189,248,0.4);">' +
      '<video id="ht-htp-video" src="' + _HT_HOW_TO_PLAY_VIDEO + '" controls autoplay style="width:100%;max-height:300px;display:block;">Your browser does not support the video tag.</video>' +
      '</div>' +
      '<div style="background:rgba(56,189,248,0.2);border-radius:12px;padding:12px 16px;margin-bottom:20px;border:1px solid rgba(56,189,248,0.3);">' +
      '<p style="color:#7dd3fc;font-size:13px;">&#128688; Rotate the pipes to connect the water flow!<br>' +
      '<span style="color:rgba(186,230,253,0.8);">After the video: <strong>1 practice pattern</strong> &rarr; <strong>2 main patterns</strong></span></p>' +
      '</div>' +
      '<button id="ht-htp-btn" style="width:100%;padding:14px 24px;font-size:16px;font-weight:700;color:#0c4a6e;' +
      'background:linear-gradient(to right,#38bdf8,#0ea5e9,#38bdf8);border:2px solid rgba(125,211,252,0.5);' +
      'border-radius:14px;cursor:pointer;box-shadow:0 8px 20px rgba(56,189,248,0.3);display:flex;align-items:center;justify-content:center;gap:12px;">' +
      'I Understand, Start Practice! <span style="font-size:18px;">&#127919;</span></button>' +
      '</div></div>'
    );
    $c.find('#ht-htp-video').on('ended', onHtpComplete);
    $c.find('#ht-htp-btn').on('click', onHtpComplete);
  }

  function onHtpComplete() {
    showHowToPlayVideo = false;
    // Initialize trial with Pattern C
    patternId       = 2;
    tileRotations   = {};
    isWon           = false;
    isInitialized   = true;
    renderMainGame();
  }

  // ---- Trial Complete screen ----
  function renderTrialComplete() {
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#0c4a6e 0%,#075985 30%,#0369a1 50%,#0284c7 75%,#0ea5e9 100%);' +
      'padding:16px;position:relative;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,rgba(12,74,110,0.95),rgba(7,89,133,0.95));border-radius:24px;padding:32px;' +
      'box-shadow:0 20px 50px rgba(0,0,0,0.5);border:2px solid rgba(34,197,94,0.4);max-width:420px;width:100%;text-align:center;z-index:10;">' +
      '<div style="margin-bottom:16px;"><div style="width:80px;height:80px;margin:0 auto;background:linear-gradient(135deg,#22c55e,#16a34a);' +
      'border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(34,197,94,0.3);">' +
      '<span style="font-size:40px;">&#9989;</span></div></div>' +
      '<h1 style="font-size:28px;font-weight:800;color:#4ade80;margin-bottom:4px;text-shadow:0 2px 4px rgba(0,0,0,0.3);">Practice Complete!</h1>' +
      '<p style="color:#86efac;font-size:16px;margin-bottom:24px;">Great job solving Pattern C!</p>' +
      '<div style="background:rgba(56,189,248,0.2);border-radius:12px;padding:12px 16px;margin-bottom:24px;border:1px solid rgba(56,189,248,0.3);">' +
      '<p style="color:#7dd3fc;font-size:14px;font-weight:600;">&#127918; Ready for the real challenge?<br>' +
      '<span style="color:rgba(186,230,253,0.8);font-weight:400;">2 patterns await! You have 3 minutes.</span></p></div>' +
      '<button id="ht-start-main-btn" style="width:100%;padding:16px 24px;font-size:18px;font-weight:700;color:#0c4a6e;' +
      'background:linear-gradient(to right,#38bdf8,#0ea5e9,#38bdf8);border:2px solid rgba(125,211,252,0.5);' +
      'border-radius:14px;cursor:pointer;box-shadow:0 8px 20px rgba(56,189,248,0.3);display:flex;align-items:center;justify-content:center;gap:12px;">' +
      'Start Main Game <span style="font-size:20px;">&#128167;</span></button>' +
      '</div></div>'
    );
    $c.find('#ht-start-main-btn').on('click', handleStartMainGame);
  }

  function handleStartMainGame() {
    trialComplete     = false;
    isTrial           = false;
    tileRotations     = {};
    isWon             = false;
    lastClickedTile   = null;
    consecutiveClicks = 0;
    highlightedTile   = null;
    timeLeft          = 180;
    completedPatterns = [];
    aimlessRotations  = 0;
    curiousClicks     = 0;
    tilesCorrect      = 0;

    // Pick random non-C pattern
    var available = _HT_PATTERNS.filter(function(p) { return p.id !== 2; });
    var randomIdx = Math.floor(Math.random() * available.length);
    patternId = available[randomIdx].id;

    renderMainGame();
    startTimer();
  }

  // ---- Main game render ----
  function renderMainGame() {
    var pat = currentPattern();

    var statsHTML = '';
    if (!isTrial) {
      statsHTML =
        '<div style="position:absolute;top:80px;left:16px;z-index:20;display:flex;flex-direction:column;gap:12px;">' +
        '<div style="background:rgba(12,74,110,0.9);padding:12px 16px;border-radius:12px;border:1px solid rgba(251,191,36,0.4);">' +
        '<div style="font-size:10px;color:rgba(253,230,138,0.7);text-transform:uppercase;letter-spacing:1px;">Aimless Rotations</div>' +
        '<div class="ht-stat-aimless" style="color:#fbbf24;font-weight:700;font-size:20px;">&#128260; 0</div></div>' +
        '<div style="background:rgba(12,74,110,0.9);padding:12px 16px;border-radius:12px;border:1px solid rgba(192,132,252,0.4);">' +
        '<div style="font-size:10px;color:rgba(216,180,254,0.7);text-transform:uppercase;letter-spacing:1px;">Curious Clicks</div>' +
        '<div class="ht-stat-curious" style="color:#c084fc;font-weight:700;font-size:20px;">&#10024; 0</div></div>' +
        '<div style="background:rgba(12,74,110,0.9);padding:12px 16px;border-radius:12px;border:1px solid rgba(74,222,128,0.4);">' +
        '<div style="font-size:10px;color:rgba(134,239,172,0.7);text-transform:uppercase;letter-spacing:1px;">Pattern</div>' +
        '<div class="ht-pattern-label" style="color:#4ade80;font-weight:700;font-size:16px;">' + pat.name + '</div>' +
        '<div class="ht-pattern-done" style="font-size:11px;color:rgba(134,239,172,0.6);margin-top:2px;">0/2 Complete</div>' +
        '</div></div>';
    } else {
      statsHTML =
        '<div style="position:absolute;top:80px;left:16px;z-index:20;">' +
        '<div style="background:rgba(12,74,110,0.9);padding:12px 16px;border-radius:12px;border:1px solid rgba(253,224,71,0.4);">' +
        '<div style="font-size:10px;color:rgba(253,224,71,0.7);text-transform:uppercase;letter-spacing:1px;">Practice Pattern</div>' +
        '<div style="color:#fef08a;font-weight:700;font-size:16px;">Pattern C</div>' +
        '<div style="font-size:11px;color:rgba(253,224,71,0.6);margin-top:2px;">No time limit</div>' +
        '</div></div>';
    }

    // Timer / trial badge
    var timerBadge = '';
    if (isTrial) {
      timerBadge =
        '<div class="ht-timer-badge" style="position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:20;' +
        'background:linear-gradient(to bottom,rgba(234,179,8,0.95),rgba(202,138,4,0.95));padding:10px 24px;border-radius:14px;' +
        'border:2px solid rgba(253,224,71,0.5);box-shadow:0 4px 20px rgba(0,0,0,0.4);">' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:20px;">&#127919;</span>' +
        '<span style="color:#fef08a;font-weight:700;font-size:18px;text-transform:uppercase;letter-spacing:1px;">Practice</span>' +
        '</div></div>';
    } else {
      timerBadge =
        '<div class="ht-timer-badge" style="position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:20;' +
        'background:linear-gradient(to bottom,rgba(12,74,110,0.95),rgba(7,89,133,0.95));padding:10px 24px;border-radius:14px;' +
        'border:2px solid rgba(56,189,248,0.5);box-shadow:0 4px 20px rgba(0,0,0,0.4);">' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:20px;">&#9201;&#65039;</span>' +
        '<span class="ht-timer-val" style="color:#7dd3fc;font-weight:900;font-size:24px;">' + formatTime(timeLeft) + '</span>' +
        '</div></div>';
    }

    // Progress bar
    var progressBar = '';
    if (!isTrial) {
      var pct = (completedPatterns.length / 2) * 100;
      progressBar =
        '<div style="position:absolute;top:0;left:0;width:100%;height:8px;' +
        'background:linear-gradient(to right,#0c4a6e,#075985,#0c4a6e);z-index:30;">' +
        '<div class="ht-progress-fill" style="height:100%;width:' + pct + '%;' +
        'background:linear-gradient(to right,#38bdf8,#7dd3fc,#38bdf8);transition:width 0.3s ease-out;' +
        'box-shadow:0 0 10px rgba(56,189,248,0.5);"></div></div>';
    }

    var html =
      '<style>' +
      '@keyframes htPulse{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(0deg) scale(1.05)}100%{transform:rotate(0deg) scale(1)}}' +
      '@keyframes htBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}' +
      '</style>' +
      '<div id="ht-root" style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;position:relative;overflow:hidden;' +
      'background:linear-gradient(135deg,#0c4a6e 0%,#075985 30%,#0369a1 50%,#0284c7 75%,#0ea5e9 100%);' +
      'font-family:system-ui,-apple-system,sans-serif;padding:16px;">' +

      // pattern overlay
      '<div style="position:absolute;inset:0;opacity:0.1;' +
      'background-image:url(\'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\'%3E' +
      '%3Ccircle cx=\'30\' cy=\'30\' r=\'20\' fill=\'none\' stroke=\'%2338bdf8\' stroke-width=\'2\'/%3E%3C/svg%3E\');' +
      'pointer-events:none;"></div>' +

      // floating water drops
      '<div style="position:absolute;top:10%;left:5%;font-size:48px;opacity:0.3;animation:htBounce 2s infinite;">&#128167;</div>' +
      '<div style="position:absolute;bottom:15%;right:8%;font-size:40px;opacity:0.25;animation:htBounce 2.5s infinite;">&#128167;</div>' +

      progressBar +

      // player info
      '<div style="position:absolute;top:20px;left:16px;z-index:20;background:rgba(12,74,110,0.9);padding:10px 16px;border-radius:12px;' +
      'border:1px solid rgba(56,189,248,0.4);display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:20px;">&#128688;</span>' +
      '<div><div style="font-size:10px;color:rgba(186,230,253,0.7);text-transform:uppercase;letter-spacing:1px;">Plumber</div>' +
      '<div style="color:#7dd3fc;font-weight:700;font-size:14px;">' + escapeHtml(playerName) + '</div></div>' +
      '</div>' +

      timerBadge +

      // exit button
      '<div style="position:absolute;top:20px;right:16px;z-index:50;">' +
      '<button id="ht-exit-btn" style="background:linear-gradient(to bottom right,#991b1b,#7f1d1d);color:white;padding:10px;' +
      'border-radius:12px;border:1px solid rgba(239,68,68,0.4);cursor:pointer;font-size:18px;" title="Exit">&#10005;</button>' +
      '</div>' +

      statsHTML +

      // main area: tap + grid + bucket
      '<div style="position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;">' +

      // tap SVG
      '<div style="position:absolute;top:-100px;left:-10px;z-index:15;">' + _htTapSVG() + '</div>' +

      // game frame
      '<div class="ht-grid-frame" style="position:relative;background:linear-gradient(135deg,#475569 0%,#334155 100%);' +
      'padding:16px;border-radius:20px;box-shadow:0 15px 50px rgba(0,0,0,0.4);border:4px solid #64748b;transition:all 0.5s ease;">' +

      // tile grid
      '<div class="ht-tile-grid" style="display:grid;grid-template-columns:repeat(4,80px);grid-template-rows:repeat(4,80px);gap:4px;">' +
      '</div></div>' +

      // bucket SVG
      '<div style="margin-top:-10px;display:flex;justify-content:flex-end;width:100%;padding-right:20px;">' +
      _htBucketSVG(false) + '</div>' +

      '</div>' + // main area

      '</div>'; // ht-root

    $c.html(html);

    // Wire exit
    $c.find('#ht-exit-btn').on('click', function() { doExit(); });

    // Render tile grid
    renderGrid();
  }

  // ---- doExit ----
  function doExit() {
    stopTimer();
    onExit();
  }

  // ===========================================================================
  // BOOTSTRAP
  // ===========================================================================
  renderHowToPlay();
}
