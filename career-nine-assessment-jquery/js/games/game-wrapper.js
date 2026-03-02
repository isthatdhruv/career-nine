/**
 * game-wrapper.js
 * Global GameWrapper object — converted from AssessmentGameWrapper.tsx / GameRenderer.tsx
 *
 * Depends on:
 *   - jQuery 3.x
 *   - jungle-spot.js   (JungleSpotGame)
 *   - rabbit-path.js   (RabbitPathGame)
 *   - hydro-tube.js    (HydroTubeGame)
 *   - Global Firebase helpers:
 *       firebaseSaveAnimalReaction(data, userStudentId)
 *       firebaseSaveRabbitPath(data, userStudentId)
 *       firebaseSaveHydroTube(data, userStudentId)
 *   - A <div id="game-overlay"> that covers the full screen (position:fixed)
 *   - Global escapeHtml(str) utility
 *
 * Usage:
 *   GameWrapper.launch(gameCode, userStudentId, playerName, onComplete, onExit);
 *   GameWrapper.destroy();
 *
 * Game codes:
 *   101 = JungleSpot  (Animal Reaction vigilance task)
 *   102 = RabbitPath  (Sequential memory / backward-trace)
 *   103 = HydroTube   (Pipe-rotation spatial reasoning)
 */

'use strict';

var GameWrapper = (function() {

  // Overlay container element
  var OVERLAY_ID = 'game-overlay';

  // ---- internal helpers ----

  function getOverlay() {
    var el = document.getElementById(OVERLAY_ID);
    if (!el) {
      // Create it if it does not exist yet
      el = document.createElement('div');
      el.id = OVERLAY_ID;
      el.style.cssText =
        'position:fixed;inset:0;z-index:9999;background:#ffffff;' +
        'overflow-y:auto;width:100%;height:100%;display:none;';
      document.body.appendChild(el);
    }
    return el;
  }

  function showOverlay() {
    var el = getOverlay();
    el.style.display = 'block';
  }

  function hideOverlay() {
    var el = getOverlay();
    el.style.display = 'none';
    el.innerHTML = '';
  }

  /** Show a fullscreen spinner while the game script sets up */
  function renderLoading(container) {
    container.innerHTML =
      '<div style="min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;background:#fff;">' +
      '<div class="spinner-border text-primary" role="status">' +
      '<span class="visually-hidden">Loading game...</span>' +
      '</div></div>';
  }

  /** Show an error card for unknown game codes */
  function renderUnknown(container, gameCode, onExitCb) {
    container.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fee2e2;">' +
      '<div style="background:white;padding:2rem;border-radius:12px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<h2 style="color:#dc2626;margin-bottom:1rem;">Unknown Game</h2>' +
      '<p style="color:#4b5563;margin-bottom:1rem;">Game code <strong>' + gameCode + '</strong> is not recognized.</p>' +
      '<button id="gw-unknown-exit" style="background:#dc2626;color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;font-weight:bold;cursor:pointer;">Exit</button>' +
      '</div></div>';

    document.getElementById('gw-unknown-exit').addEventListener('click', function() {
      onExitCb();
    });
  }

  // ---- Firebase save helper ----
  function saveToFirebase(gameCode, data, userStudentId) {
    return new Promise(function(resolve) {
      try {
        switch (gameCode) {
          case 101: // Jungle-Spot (Animal Reaction)
            console.log("Saving Jungle-Spot to Firebase...");
            var p101 = firebaseSaveAnimalReaction({
              totalTrials:    data.totalTrials,
              trialMs:        data.trialMs,
              target:         data.target,
              targetsShown:   data.targetsShown,
              hits:           data.hits,
              misses:         data.misses,
              falsePositives: data.falsePositives,
              hitRTsMs:       data.hitRTsMs || []
            }, userStudentId);
            Promise.resolve(p101).then(function() {
              console.log("Jungle-Spot saved to Firebase!");
              resolve();
            }).catch(function(err) {
              console.error("Failed to save Jungle-Spot:", err);
              resolve();
            });
            break;

          case 102: // Rabbit-Path
            console.log("Saving Rabbit-Path to Firebase...");
            var p102 = firebaseSaveRabbitPath({
              score:        data.score,
              totalRounds:  data.totalRounds,
              roundsPlayed: data.roundsPlayed,
              history:      data.history
            }, userStudentId);
            Promise.resolve(p102).then(function() {
              console.log("Rabbit-Path saved to Firebase!");
              resolve();
            }).catch(function(err) {
              console.error("Failed to save Rabbit-Path:", err);
              resolve();
            });
            break;

          case 103: // Hydro-Tube
            console.log("Saving Hydro-Tube to Firebase...");
            var p103 = firebaseSaveHydroTube({
              patternsCompleted: data.patternsCompleted,
              totalPatterns:     data.totalPatterns,
              aimlessRotations:  data.aimlessRotations,
              curiousClicks:     data.curiousClicks,
              tilesCorrect:      data.tilesCorrect,
              totalTiles:        data.totalTiles,
              timeSpentSeconds:  data.timeSpentSeconds
            }, userStudentId);
            Promise.resolve(p103).then(function() {
              console.log("Hydro-Tube saved to Firebase!");
              resolve();
            }).catch(function(err) {
              console.error("Failed to save Hydro-Tube:", err);
              resolve();
            });
            break;

          default:
            console.warn("Unknown game code for Firebase save:", gameCode);
            resolve();
        }
      } catch (err) {
        console.error("Exception during Firebase save:", err);
        resolve(); // always resolve so onComplete still fires
      }
    });
  }

  // ---- Public API ----

  /**
   * Launch a game inside the #game-overlay element.
   *
   * @param {number}   gameCode      101 | 102 | 103
   * @param {string}   userStudentId Student ID (used for Firebase)
   * @param {string}   playerName    Display name shown inside the game
   * @param {Function} onComplete    Called (with no arguments) after results are saved
   * @param {Function} onExit        Called when the user explicitly exits the game
   */
  function launch(gameCode, userStudentId, playerName, onComplete, onExit) {
    console.log("=== GameWrapper.launch ===");
    console.log("gameCode:", gameCode, "| userStudentId:", userStudentId, "| player:", playerName);

    var overlay = getOverlay();
    showOverlay();
    renderLoading(overlay);

    // Callbacks that route back through the overlay
    var handleComplete = function(data) {
      console.log("=== Game Complete Handler Called ===");
      console.log("gameCode:", gameCode, "| data:", data);

      saveToFirebase(gameCode, data, userStudentId).then(function() {
        GameWrapper.destroy();
        if (typeof onComplete === 'function') onComplete();
      });
    };

    var handleExit = function() {
      console.log("=== Game Exit Handler Called ===");
      GameWrapper.destroy();
      if (typeof onExit === 'function') onExit();
    };

    // Small delay lets the loading spinner actually paint
    setTimeout(function() {
      var opts = {
        container:     overlay,
        userStudentId: userStudentId,
        playerName:    playerName,
        onComplete:    handleComplete,
        onExit:        handleExit
      };

      try {
        switch (gameCode) {
          case 101:
            JungleSpotGame(opts);
            break;
          case 102:
            RabbitPathGame(opts);
            break;
          case 103:
            HydroTubeGame(opts);
            break;
          default:
            renderUnknown(overlay, gameCode, handleExit);
        }
      } catch (err) {
        console.error("Error launching game:", err);
        renderUnknown(overlay, gameCode, handleExit);
      }
    }, 50);
  }

  /**
   * Tear down the game: hide and empty the overlay.
   * Call this when you want to close the game UI without going through the
   * normal onComplete / onExit flow (e.g. when navigating away).
   */
  function destroy() {
    hideOverlay();
  }

  return {
    launch:  launch,
    destroy: destroy
  };

}());
