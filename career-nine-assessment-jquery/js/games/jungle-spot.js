/**
 * jungle-spot.js
 * JungleSpot Game (code 101) — Animal Reaction / Vigilance task
 * Converted from JungleSpotGame.tsx (React) to vanilla JS / jQuery
 *
 * Usage:
 *   JungleSpotGame({ container, userStudentId, playerName, onComplete, onExit })
 *
 * onComplete(data) is called with the game-result object after the user
 * clicks "Continue Adventure" on the Game Over screen.
 * onExit()        is called when the user clicks the exit (✕) button.
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants (identical to the React source)
// ---------------------------------------------------------------------------
var _JS_ANIMALS       = ["lion", "elephant", "rhino", "deer", "tiger"];
var _JS_TOTAL_TRIALS  = 120;
var _JS_TRIAL_MS      = 1000;           // 1 second per trial
var _JS_PER_ANIMAL    = _JS_TOTAL_TRIALS / _JS_ANIMALS.length; // 24
var _JS_TRIAL_COUNT   = 10;             // practice-round length
var _JS_TRIAL_MIN_LIONS = 2;
var _JS_HOW_TO_PLAY_VIDEO = "/assets/game/jungle-spot-tutorial.mp4";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function _jsGetImageSrc(animal) {
  return "/assets/game/" + animal + ".webp";
}

function _jsShuffleInPlace(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = (Math.random() * (i + 1)) | 0;
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function _jsBuildMainTrials() {
  var deck = [];
  for (var ai = 0; ai < _JS_ANIMALS.length; ai++) {
    for (var k = 0; k < _JS_PER_ANIMAL; k++) {
      deck.push({ animal: _JS_ANIMALS[ai] });
    }
  }
  _jsShuffleInPlace(deck);
  return deck.slice(0, _JS_TOTAL_TRIALS);
}

function _jsBuildTrialTrials() {
  var deck = [];
  for (var i = 0; i < _JS_TRIAL_MIN_LIONS; i++) {
    deck.push({ animal: "lion" });
  }
  var remaining = _JS_TRIAL_COUNT - _JS_TRIAL_MIN_LIONS;
  for (var j = 0; j < remaining; j++) {
    var a = _JS_ANIMALS[Math.floor(Math.random() * _JS_ANIMALS.length)];
    deck.push({ animal: a });
  }
  _jsShuffleInPlace(deck);
  return deck;
}

// ---------------------------------------------------------------------------
// Image pre-loader
// ---------------------------------------------------------------------------
var _jsImageCache = {};

function _jsPreloadImages(onDone) {
  var srcs = _JS_ANIMALS.map(_jsGetImageSrc);
  var loaded = 0;
  srcs.forEach(function(src) {
    if (_jsImageCache[src]) { loaded++; if (loaded === srcs.length) onDone(); return; }
    var img = new Image();
    img.onload  = function() { _jsImageCache[src] = img; loaded++; if (loaded === srcs.length) onDone(); };
    img.onerror = function() { loaded++; if (loaded === srcs.length) onDone(); };
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------
function JungleSpotGame(opts) {
  var container    = opts.container;
  var userStudentId = opts.userStudentId;
  var playerName   = opts.playerName;
  var onComplete   = opts.onComplete;
  var onExit       = opts.onExit;

  // ---- mutable game state ----
  var mainTrials   = _jsBuildMainTrials();
  var trialTrials  = _jsBuildTrialTrials();

  var score        = { hits: 0, misses: 0, falsePositives: 0, hitRTs: [] };

  var isTrialMode          = true;
  var gameOver             = false;
  var trialModeComplete    = false;

  var currentIndex         = -1;
  var currentTrial         = null;
  var clickedThisTrial     = false;
  var onsetTime            = 0;
  var hasStarted           = false;

  var rafId                = null;
  var nextSwitchTime       = 0;

  var flashTimer           = null;

  var gameResults          = null;

  // DOM refs
  var $c = $(container);

  // -------- RENDER LOADING SCREEN --------
  function renderLoading() {
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#0d3320 0%,#071a0f 50%,#0a1f14 100%);color:white;position:relative;overflow:hidden;">' +
      '<style>@keyframes jsSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>' +
      '<div style="z-index:10;display:flex;flex-direction:column;align-items:center;">' +
      '<div style="width:80px;height:80px;border:4px solid #166534;border-top-color:#fbbf24;border-radius:50%;' +
      'animation:jsSpin 1s linear infinite;margin-bottom:24px;"></div>' +
      '<p style="font-size:24px;font-weight:700;color:#fbbf24;letter-spacing:2px;">Entering the Jungle...</p>' +
      '<p style="color:rgba(134,239,172,0.6);font-size:14px;margin-top:8px;">Preparing wildlife spotting</p>' +
      '</div></div>'
    );
  }

  // -------- RENDER HOW TO PLAY --------
  function renderHowToPlay() {
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#0d3320 0%,#071a0f 50%,#0a1f14 100%);padding:16px;position:relative;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,rgba(6,78,59,0.9),rgba(6,46,35,0.95));border-radius:24px;padding:24px;' +
      'box-shadow:0 20px 50px rgba(0,0,0,0.5);border:2px solid rgba(251,191,36,0.3);max-width:600px;width:100%;text-align:center;z-index:10;">' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;">' +
      '<span style="font-size:32px;">&#127916;</span>' +
      '<h1 style="font-size:24px;font-weight:800;color:#fbbf24;text-shadow:0 2px 4px rgba(0,0,0,0.3);margin:0;">How To Play</h1>' +
      '</div>' +
      '<p style="color:#86efac;font-size:14px;margin-bottom:20px;">Watch this short tutorial before starting, ' + escapeHtml(playerName) + '!</p>' +
      '<div style="background:#000;border-radius:16px;overflow:hidden;margin-bottom:20px;border:3px solid rgba(251,191,36,0.4);box-shadow:0 8px 30px rgba(0,0,0,0.4);">' +
      '<video id="js-htp-video" src="' + _JS_HOW_TO_PLAY_VIDEO + '" controls autoplay ' +
      'style="width:100%;max-height:300px;display:block;">Your browser does not support the video tag.</video>' +
      '</div>' +
      '<button id="js-htp-btn" style="width:100%;padding:14px 24px;font-size:16px;font-weight:700;color:#1a2e05;' +
      'background:linear-gradient(to right,#22c55e,#16a34a,#22c55e);border:2px solid rgba(134,239,172,0.5);' +
      'border-radius:14px;cursor:pointer;box-shadow:0 8px 20px rgba(34,197,94,0.3);display:flex;align-items:center;justify-content:center;gap:12px;">' +
      'I Understand, Start Practice! <span style="font-size:18px;">&#127919;</span></button>' +
      '</div></div>'
    );
    $c.find('#js-htp-video').on('ended', onVideoComplete);
    $c.find('#js-htp-btn').on('click', onVideoComplete);
  }

  // -------- RENDER TRIAL INTRO --------
  function renderTrialIntro() {
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#0d3320 0%,#071a0f 50%,#0a1f14 100%);padding:16px;position:relative;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,rgba(6,78,59,0.9),rgba(6,46,35,0.95));border-radius:24px;padding:32px;' +
      'box-shadow:0 20px 50px rgba(0,0,0,0.5);border:2px solid rgba(251,191,36,0.3);max-width:420px;width:100%;text-align:center;z-index:10;">' +
      '<div style="margin-bottom:16px;"><div style="width:80px;height:80px;margin:0 auto;background:linear-gradient(135deg,#22c55e,#16a34a);' +
      'border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(34,197,94,0.3);">' +
      '<span style="font-size:40px;">&#127919;</span></div></div>' +
      '<h1 style="font-size:28px;font-weight:800;color:#fbbf24;margin-bottom:8px;text-shadow:0 2px 4px rgba(0,0,0,0.3);">Practice Round</h1>' +
      '<p style="color:#86efac;font-size:16px;margin-bottom:20px;">Let\'s practice first, ' + escapeHtml(playerName) + '!</p>' +
      '<div style="background:rgba(21,128,61,0.3);border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid rgba(34,197,94,0.3);">' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px;"><span style="font-size:48px;">&#129409;</span></div>' +
      '<p style="color:#fcd34d;font-size:18px;font-weight:700;margin-bottom:8px;">Spot the LION!</p>' +
      '<p style="color:rgba(134,239,172,0.8);font-size:14px;line-height:1.5;">When you see a lion, tap the screen or press Space quickly!<br>Ignore other animals.</p>' +
      '</div>' +
      '<div style="background:rgba(146,64,14,0.4);border-radius:12px;padding:12px 16px;margin-bottom:24px;border:1px solid rgba(251,191,36,0.3);">' +
      '<p style="color:#fbbf24;font-size:14px;font-weight:600;">&#128203; ' + _JS_TRIAL_COUNT + ' practice animals &bull; At least ' + _JS_TRIAL_MIN_LIONS + ' lions</p>' +
      '</div>' +
      '<button id="js-start-trial-btn" style="width:100%;padding:16px 24px;font-size:18px;font-weight:700;color:#1a2e05;' +
      'background:linear-gradient(to right,#22c55e,#16a34a,#22c55e);border:2px solid rgba(134,239,172,0.5);' +
      'border-radius:14px;cursor:pointer;box-shadow:0 8px 20px rgba(34,197,94,0.3);display:flex;align-items:center;justify-content:center;gap:12px;">' +
      'Start Practice <span style="font-size:20px;">&#9654;&#65039;</span></button>' +
      '</div></div>'
    );
    $c.find('#js-start-trial-btn').on('click', onStartTrial);
  }

  // -------- RENDER TRIAL COMPLETE --------
  function renderTrialComplete() {
    var lionsInTrial = trialTrials.filter(function(t) { return t.animal === "lion"; }).length;
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#0d3320 0%,#071a0f 50%,#0a1f14 100%);padding:16px;position:relative;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,rgba(6,78,59,0.9),rgba(6,46,35,0.95));border-radius:24px;padding:32px;' +
      'box-shadow:0 20px 50px rgba(0,0,0,0.5);border:2px solid rgba(251,191,36,0.3);max-width:420px;width:100%;text-align:center;z-index:10;">' +
      '<div style="margin-bottom:16px;"><div style="width:80px;height:80px;margin:0 auto;background:linear-gradient(135deg,#22c55e,#16a34a);' +
      'border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(34,197,94,0.3);">' +
      '<span style="font-size:40px;">&#9989;</span></div></div>' +
      '<h1 style="font-size:28px;font-weight:800;color:#fbbf24;margin-bottom:4px;text-shadow:0 2px 4px rgba(0,0,0,0.3);">Practice Complete!</h1>' +
      '<p style="color:#86efac;font-size:16px;margin-bottom:24px;">Great job warming up!</p>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">' +
      '<div style="background:rgba(21,128,61,0.4);border-radius:12px;padding:12px;border:1px solid rgba(34,197,94,0.3);">' +
      '<div style="font-size:24px;font-weight:700;color:#4ade80;" id="js-tc-hits">' + score.hits + '</div>' +
      '<div style="font-size:10px;color:rgba(134,239,172,0.7);text-transform:uppercase;letter-spacing:1px;">Lions Found</div></div>' +
      '<div style="background:rgba(146,64,14,0.4);border-radius:12px;padding:12px;border:1px solid rgba(251,191,36,0.3);">' +
      '<div style="font-size:24px;font-weight:700;color:#fbbf24;">' + score.misses + '</div>' +
      '<div style="font-size:10px;color:rgba(253,230,138,0.7);text-transform:uppercase;letter-spacing:1px;">Missed</div></div>' +
      '<div style="background:rgba(127,29,29,0.4);border-radius:12px;padding:12px;border:1px solid rgba(239,68,68,0.3);">' +
      '<div style="font-size:24px;font-weight:700;color:#f87171;">' + score.falsePositives + '</div>' +
      '<div style="font-size:10px;color:rgba(252,165,165,0.7);text-transform:uppercase;letter-spacing:1px;">False Alarms</div></div>' +
      '</div>' +
      '<div style="background:rgba(146,64,14,0.4);border-radius:12px;padding:12px 16px;margin-bottom:24px;border:1px solid rgba(251,191,36,0.3);">' +
      '<p style="color:#fbbf24;font-size:14px;font-weight:600;">&#127918; Ready for the real challenge?<br>' +
      '<span style="color:rgba(253,230,138,0.8);font-weight:400;">' + _JS_TOTAL_TRIALS + ' animals await in the main game!</span></p></div>' +
      '<button id="js-start-main-btn" style="width:100%;padding:16px 24px;font-size:18px;font-weight:700;color:#1a2e05;' +
      'background:linear-gradient(to right,#fbbf24,#f59e0b,#fbbf24);border:2px solid rgba(253,230,138,0.5);' +
      'border-radius:14px;cursor:pointer;box-shadow:0 8px 20px rgba(251,191,36,0.3);display:flex;align-items:center;justify-content:center;gap:12px;">' +
      'Start Main Game <span style="font-size:20px;">&#127796;</span></button>' +
      '</div></div>'
    );
    $c.find('#js-start-main-btn').on('click', onStartMainGame);
  }

  // -------- RENDER GAME OVER --------
  function renderGameOver() {
    $c.html(
      '<div style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(135deg,#0d3320 0%,#071a0f 50%,#0a1f14 100%);padding:16px;position:relative;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,rgba(6,78,59,0.9),rgba(6,46,35,0.95));border-radius:24px;padding:32px;' +
      'box-shadow:0 20px 50px rgba(0,0,0,0.5);border:2px solid rgba(251,191,36,0.3);max-width:400px;width:100%;text-align:center;z-index:10;">' +
      '<div style="margin-bottom:16px;"><div style="width:80px;height:80px;margin:0 auto;background:linear-gradient(135deg,#fbbf24,#d97706);' +
      'border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(251,191,36,0.3);">' +
      '<span style="font-size:40px;">&#127942;</span></div></div>' +
      '<h1 style="font-size:28px;font-weight:800;color:#fbbf24;margin-bottom:4px;text-shadow:0 2px 4px rgba(0,0,0,0.3);">Safari Complete!</h1>' +
      '<p style="color:#86efac;font-size:16px;margin-bottom:24px;">Well done, ' + escapeHtml(playerName) + '!</p>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">' +
      '<div style="background:rgba(21,128,61,0.4);border-radius:12px;padding:12px;border:1px solid rgba(34,197,94,0.3);">' +
      '<div style="font-size:24px;font-weight:700;color:#4ade80;">' + score.hits + '</div>' +
      '<div style="font-size:10px;color:rgba(134,239,172,0.7);text-transform:uppercase;letter-spacing:1px;">Lions Found</div></div>' +
      '<div style="background:rgba(146,64,14,0.4);border-radius:12px;padding:12px;border:1px solid rgba(251,191,36,0.3);">' +
      '<div style="font-size:24px;font-weight:700;color:#fbbf24;">' + score.misses + '</div>' +
      '<div style="font-size:10px;color:rgba(253,230,138,0.7);text-transform:uppercase;letter-spacing:1px;">Missed</div></div>' +
      '<div style="background:rgba(127,29,29,0.4);border-radius:12px;padding:12px;border:1px solid rgba(239,68,68,0.3);">' +
      '<div style="font-size:24px;font-weight:700;color:#f87171;">' + score.falsePositives + '</div>' +
      '<div style="font-size:10px;color:rgba(252,165,165,0.7);text-transform:uppercase;letter-spacing:1px;">False Alarms</div></div>' +
      '</div>' +
      '<button id="js-continue-btn" style="width:100%;padding:16px 24px;font-size:18px;font-weight:700;color:#1a2e05;' +
      'background:linear-gradient(to right,#fbbf24,#f59e0b,#fbbf24);border:2px solid rgba(253,230,138,0.5);' +
      'border-radius:14px;cursor:pointer;box-shadow:0 8px 20px rgba(251,191,36,0.3);display:flex;align-items:center;justify-content:center;gap:12px;">' +
      'Continue Adventure <span style="font-size:20px;">&#127796;</span></button>' +
      '</div></div>'
    );
    $c.find('#js-continue-btn').on('click', onContinue);
  }

  // -------- RENDER MAIN GAME AREA --------
  function renderGame() {
    var currentTrials = isTrialMode ? trialTrials : mainTrials;
    var totalCount    = isTrialMode ? _JS_TRIAL_COUNT : _JS_TOTAL_TRIALS;
    var progress      = ((currentIndex + 1) / totalCount) * 100;

    $c.html(
      '<style>' +
      '@keyframes jsSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
      '</style>' +
      '<div id="js-game-root" style="min-height:100vh;width:100%;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;position:relative;overflow:hidden;' +
      'background:linear-gradient(135deg,#0d3320 0%,#0a1f14 30%,#071a0f 50%,#0d2818 75%,#0a1f14 100%);' +
      'font-family:system-ui,-apple-system,sans-serif;cursor:pointer;">' +

      // leaf texture overlay
      '<div style="position:absolute;inset:0;opacity:0.15;' +
      'background-image:url(\'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\'%3E%3Cpath d=\'M30 0 L60 30 L30 60 L0 30 Z\' fill=\'none\' stroke=\'%2322c55e\' stroke-width=\'1\'/%3E%3C/svg%3E\');' +
      'pointer-events:none;"></div>' +

      // progress bar track
      '<div style="position:absolute;top:0;left:0;width:100%;height:8px;background:linear-gradient(to right,#78350f,#92400e,#78350f);z-index:30;">' +
      '<div id="js-progress-fill" style="height:100%;width:' + progress + '%;background:linear-gradient(to right,#22c55e,#4ade80,#22c55e);transition:width 0.3s ease-out;box-shadow:0 0 10px rgba(34,197,94,0.5);"></div>' +
      '</div>' +

      // player info top-left
      '<div style="position:absolute;top:20px;left:16px;z-index:20;background:rgba(6,78,59,0.9);padding:10px 16px;border-radius:12px;' +
      'border:1px solid rgba(34,197,94,0.4);display:flex;align-items:center;gap:10px;box-shadow:0 4px 15px rgba(0,0,0,0.3);">' +
      '<span style="font-size:20px;">&#129517;</span>' +
      '<div><div style="font-size:10px;color:rgba(134,239,172,0.7);text-transform:uppercase;letter-spacing:1px;">Explorer</div>' +
      '<div style="color:#fcd34d;font-weight:700;font-size:14px;">' + escapeHtml(playerName) + '</div></div>' +
      '</div>' +

      // trial counter top-center
      '<div id="js-trial-counter" style="position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:20;' +
      'background:linear-gradient(to bottom,rgba(146,64,14,0.95),rgba(120,53,15,0.95));padding:10px 24px;border-radius:14px;' +
      'border:2px solid rgba(251,191,36,0.5);box-shadow:0 4px 20px rgba(0,0,0,0.4);">' +
      (isTrialMode ? '<div style="font-size:10px;color:#86efac;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;text-align:center;">Practice</div>' : '') +
      '<div style="display:flex;align-items:center;gap:8px;justify-content:center;">' +
      '<span id="js-current-num" style="color:#fbbf24;font-weight:900;font-size:22px;">' + Math.max(0, currentIndex + 1) + '</span>' +
      '<span style="color:#b45309;font-weight:700;font-size:18px;">/</span>' +
      '<span style="color:rgba(251,191,36,0.7);font-weight:600;font-size:18px;">' + totalCount + '</span>' +
      '</div></div>' +

      // restart + exit buttons top-right
      '<div style="position:absolute;top:20px;right:16px;z-index:50;display:flex;gap:10px;pointer-events:auto;">' +
      '<button id="js-restart-btn" style="background:linear-gradient(to bottom right,#15803d,#166534);color:white;padding:10px;border-radius:12px;' +
      'border:1px solid rgba(34,197,94,0.4);cursor:pointer;font-size:18px;box-shadow:0 4px 15px rgba(0,0,0,0.3);" title="Restart">&#128260;</button>' +
      '<button id="js-exit-btn" style="background:linear-gradient(to bottom right,#991b1b,#7f1d1d);color:white;padding:10px;border-radius:12px;' +
      'border:1px solid rgba(239,68,68,0.4);cursor:pointer;font-size:18px;box-shadow:0 4px 15px rgba(0,0,0,0.3);" title="Exit">&#10005;</button>' +
      '</div>' +

      // image frame (center)
      '<div style="position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;user-select:none;padding:0 16px;">' +
      '<div style="position:relative;background:linear-gradient(135deg,#b45309 0%,#92400e 50%,#78350f 100%);padding:12px;border-radius:20px;' +
      'box-shadow:0 15px 50px rgba(0,0,0,0.5),inset 0 2px 4px rgba(255,255,255,0.1);border:4px solid #d97706;">' +
      '<div style="background:linear-gradient(135deg,#78350f,#451a03);padding:6px;border-radius:14px;">' +
      '<div id="js-img-container" style="width:300px;height:300px;background:linear-gradient(135deg,#064e3b 0%,#022c22 100%);border-radius:10px;' +
      'display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;box-shadow:inset 0 4px 20px rgba(0,0,0,0.5);">' +
      // corner decorations
      '<div style="position:absolute;top:8px;left:8px;width:20px;height:20px;border-left:3px solid rgba(251,191,36,0.4);border-top:3px solid rgba(251,191,36,0.4);border-radius:4px 0 0 0;"></div>' +
      '<div style="position:absolute;top:8px;right:8px;width:20px;height:20px;border-right:3px solid rgba(251,191,36,0.4);border-top:3px solid rgba(251,191,36,0.4);border-radius:0 4px 0 0;"></div>' +
      '<div style="position:absolute;bottom:8px;left:8px;width:20px;height:20px;border-left:3px solid rgba(251,191,36,0.4);border-bottom:3px solid rgba(251,191,36,0.4);border-radius:0 0 0 4px;"></div>' +
      '<div style="position:absolute;bottom:8px;right:8px;width:20px;height:20px;border-right:3px solid rgba(251,191,36,0.4);border-bottom:3px solid rgba(251,191,36,0.4);border-radius:0 0 4px 0;"></div>' +
      '<img id="js-animal-img" src="" alt="animal" style="width:85%;height:85%;object-fit:contain;filter:drop-shadow(0 8px 20px rgba(0,0,0,0.6));display:none;" draggable="false">' +
      '<div id="js-spinner" style="width:60px;height:60px;border:4px solid rgba(34,197,94,0.3);border-top-color:#22c55e;border-radius:50%;animation:jsSpin 1s linear infinite;"></div>' +
      '<div id="js-flash" style="position:absolute;inset:0;background:rgba(255,255,255,0.9);border-radius:10px;pointer-events:none;display:none;"></div>' +
      '</div></div></div>' +

      // instructions below
      '<div style="margin-top:32px;display:flex;flex-direction:column;align-items:center;gap:16px;">' +
      '<div style="background:linear-gradient(to right,rgba(120,53,15,0.95),rgba(146,64,14,0.95),rgba(120,53,15,0.95));padding:16px 32px;border-radius:16px;border:3px solid rgba(251,191,36,0.6);box-shadow:0 8px 30px rgba(0,0,0,0.4);">' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:16px;">' +
      '<span style="font-size:40px;">&#129409;</span>' +
      '<div style="text-align:center;">' +
      '<p style="color:rgba(253,230,138,0.9);font-size:14px;font-weight:500;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Spot the</p>' +
      '<p style="color:#fcd34d;font-size:32px;font-weight:900;letter-spacing:-1px;text-shadow:0 2px 4px rgba(0,0,0,0.5);margin:0;">LION</p>' +
      '</div>' +
      '<span style="font-size:40px;">&#128070;</span>' +
      '</div></div>' +
      '<p style="color:rgba(134,239,172,0.6);font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:3px;">Tap Screen or Press Space</p>' +
      '</div></div>' +

      '</div>' // #js-game-root
    );

    // Button events (stop propagation to avoid handleInput)
    $c.find('#js-restart-btn').on('pointerdown', function(e) {
      e.stopPropagation();
      window.location.reload();
    });
    $c.find('#js-exit-btn').on('pointerdown', function(e) {
      e.stopPropagation();
      doExit();
    });

    // Global click handler for input
    $c.find('#js-game-root').on('pointerdown', function(e) {
      var tgt = e.target;
      if (tgt.tagName === 'BUTTON' || $(tgt).closest('button').length) return;
      handleInput();
    });
  }

  // -------- update progress / counter in-place --------
  function updateGameUI() {
    var currentTrials = isTrialMode ? trialTrials : mainTrials;
    var totalCount    = isTrialMode ? _JS_TRIAL_COUNT : _JS_TOTAL_TRIALS;
    var progress      = ((currentIndex + 1) / totalCount) * 100;

    $('#js-progress-fill').css('width', progress + '%');
    $('#js-current-num').text(Math.max(0, currentIndex + 1));
  }

  // -------- Game loop --------
  function stopLoop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function advanceTrial(now) {
    var currentTrials = isTrialMode ? trialTrials : mainTrials;
    var totalCount    = isTrialMode ? _JS_TRIAL_COUNT : _JS_TOTAL_TRIALS;

    // Score previous trial miss
    var prevIdx = currentIndex;
    if (prevIdx >= 0 && prevIdx < totalCount) {
      var prevTrial = currentTrials[prevIdx];
      if (prevTrial.animal === "lion" && !clickedThisTrial) {
        score.misses++;
      }
    }

    var nextIdx = prevIdx + 1;
    if (nextIdx >= totalCount) {
      endGame();
      return;
    }

    currentIndex = nextIdx;
    clickedThisTrial = false;

    var t = currentTrials[nextIdx];
    currentTrial = t;

    // Show flash
    var $flash = $('#js-flash');
    var $img   = $('#js-animal-img');
    var $spin  = $('#js-spinner');

    $img.attr('src', _jsGetImageSrc(t.animal));
    $img.show();
    $spin.hide();

    $flash.show();
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function() { $flash.hide(); }, 80);

    onsetTime = performance.now();

    updateGameUI();
  }

  function loop(now) {
    if (gameOver) return;

    if (currentIndex === -1) {
      nextSwitchTime = now;
      advanceTrial(now);
      nextSwitchTime = now + _JS_TRIAL_MS;
    } else if (now >= nextSwitchTime) {
      while (now >= nextSwitchTime) {
        nextSwitchTime += _JS_TRIAL_MS;
      }
      advanceTrial(now);
    }

    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (hasStarted) return;
    hasStarted = true;
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    stopLoop();

    // Score last trial miss if applicable
    var currentTrials = isTrialMode ? trialTrials : mainTrials;
    var totalCount    = isTrialMode ? _JS_TRIAL_COUNT : _JS_TOTAL_TRIALS;
    if (currentIndex >= 0 && currentIndex < totalCount) {
      var t = currentTrials[currentIndex];
      if (t && t.animal === "lion" && !clickedThisTrial) {
        score.misses++;
      }
    }

    if (isTrialMode) {
      trialModeComplete = true;
      renderTrialComplete();
    } else {
      gameOver = true;
      buildGameResults();
      renderGameOver();
    }
  }

  function buildGameResults() {
    var lionsShown = mainTrials.reduce(function(acc, t) {
      return acc + (t.animal === "lion" ? 1 : 0);
    }, 0);

    gameResults = {
      userStudentId:  userStudentId,
      playerName:     playerName,
      totalTrials:    _JS_TOTAL_TRIALS,
      trialMs:        _JS_TRIAL_MS,
      target:         "lion",
      targetsShown:   lionsShown,
      hits:           score.hits,
      misses:         score.misses,
      falsePositives: score.falsePositives,
      hitRTsMs:       score.hitRTs.slice(),
      timestamp:      new Date().toISOString(),
      gameType:       'jungle-spot'
    };

    console.log("Jungle Spot game completed:", gameResults);
  }

  // -------- Input handler --------
  function handleInput() {
    if (!hasStarted || gameOver || trialModeComplete) return;
    if (currentIndex < 0) return;
    if (clickedThisTrial) return;

    clickedThisTrial = true;

    var t = currentTrial;
    if (!t) return;

    var clickTime = performance.now();
    var rt        = clickTime - onsetTime;

    if (t.animal === "lion") {
      score.hits++;
      score.hitRTs.push(Math.round(Math.max(0, rt) * 100) / 100);
    } else {
      score.falsePositives++;
    }
  }

  // -------- Flow callbacks --------
  function onVideoComplete() {
    renderTrialIntro();
  }

  function onStartTrial() {
    // Reset state for trial mode
    score        = { hits: 0, misses: 0, falsePositives: 0, hitRTs: [] };
    currentIndex = -1;
    currentTrial = null;
    clickedThisTrial = false;
    hasStarted   = false;
    isTrialMode  = true;
    trialTrials  = _jsBuildTrialTrials();

    renderGame();
    startKeyListener();
    startLoop();
  }

  function onStartMainGame() {
    stopLoop();

    // Reset everything for main game
    score        = { hits: 0, misses: 0, falsePositives: 0, hitRTs: [] };
    currentIndex = -1;
    currentTrial = null;
    clickedThisTrial = false;
    hasStarted   = false;
    isTrialMode  = false;
    trialModeComplete = false;
    gameOver     = false;

    renderGame();
    startKeyListener();
    setTimeout(function() { startLoop(); }, 100);
  }

  function onContinue() {
    if (gameResults) {
      console.log("Saving game results to Firestore...");
      onComplete(gameResults);
    } else {
      onComplete({ error: "No game results available" });
    }
  }

  function doExit() {
    stopLoop();
    removeKeyListener();
    onExit();
  }

  // -------- Keyboard support --------
  var _keyHandler = null;

  function startKeyListener() {
    removeKeyListener();
    _keyHandler = function(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener('keydown', _keyHandler, { passive: false });
  }

  function removeKeyListener() {
    if (_keyHandler) {
      window.removeEventListener('keydown', _keyHandler);
      _keyHandler = null;
    }
  }

  // -------- Bootstrap --------
  renderLoading();
  _jsPreloadImages(function() {
    renderHowToPlay();
  });
}
