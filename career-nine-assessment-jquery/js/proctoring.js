/**
 * proctoring.js — Assessment Proctoring Module
 *
 * Global Proctoring object that:
 *  - Loads WebGazer (eye tracking, 250ms samples) and MediaPipe (face count, 1s intervals)
 *  - Tracks mouse clicks and tab switches
 *  - Aggregates data per question (with merge on revisit)
 *  - Submits to POST /assessment-proctoring/save
 *
 * Usage:
 *   Proctoring.init()                           — call once when assessment section starts
 *   Proctoring.startQuestion(qId)               — call when a question is rendered (DOM updated)
 *   Proctoring.finalizeCurrentQuestion()        — called automatically by startQuestion / submitProctoring
 *   Proctoring.submitProctoring(uid, aid)        — fire-and-forget after answer submission
 *   Proctoring.stop()                           — call when leaving assessment
 *
 * Deps: jQuery 3.x, axios, AppConfig.API_URL
 */
'use strict';

var Proctoring = (function () {

  // ── Internal state ─────────────────────────────────────────────────────

  var _initialized      = false;
  var _webgazerReady    = false;
  var _faceDetector     = null;
  var _faceDetectorReady = false;
  var _faceInterval     = null;
  var _videoEl          = null;

  // Current question tracking
  var _currentQId       = null;
  var _questionStartTime = null;
  var _lastGazeSampleTime = 0;

  // Rolling per-question buffers (reset on each new question)
  var _eyeGazeSnapshots = [];   // { t, x, y }
  var _faceSnapshots    = [];   // { t, faceCount }
  var _mouseClicks      = [];   // { t, x, y }
  var _tabSwitchCount   = 0;
  var _headAwayCount    = 0;
  var _wasLooking       = true; // state machine for headAwayCount

  // Aggregated storage: questionnaireQuestionId -> data object
  var _perQuestionData  = {};

  // ── Gaze direction ─────────────────────────────────────────────────────

  function _gazeDirection(x, y) {
    var w  = window.innerWidth;
    var h  = window.innerHeight;
    var thX = w * 0.25;
    var thY = h * 0.25;
    var cx  = w / 2;
    var cy  = h / 2;
    if (x < cx - thX) return 'left';
    if (x > cx + thX) return 'right';
    if (y < cy - thY) return 'up';
    if (y > cy + thY) return 'down';
    return 'center';
  }

  // ── Global event listeners ─────────────────────────────────────────────

  function _onVisibilityChange() {
    if (document.hidden) _tabSwitchCount++;
  }

  function _onMouseDown(e) {
    _mouseClicks.push({ t: Date.now(), x: e.clientX, y: e.clientY });
  }

  // ── Load WebGazer (CDN, UMD bundle) ────────────────────────────────────

  function _loadWebGazer(cb) {
    if (typeof webgazer !== 'undefined') { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/webgazer@2.1.0/src/index.bundle.js';
    s.onload  = cb;
    s.onerror = function () {
      console.warn('[Proctoring] WebGazer CDN failed, trying fallback...');
      var s2 = document.createElement('script');
      s2.src = 'https://webgazer.cs.brown.edu/webgazer.js';
      s2.onload  = cb;
      s2.onerror = function () {
        console.warn('[Proctoring] WebGazer unavailable – eye tracking disabled');
        cb();
      };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  }

  // ── Load MediaPipe via ESM module shim ─────────────────────────────────

  function _loadMediaPipe(cb) {
    if (window._mediaPipeLoaded) { cb(); return; }
    var s = document.createElement('script');
    s.type = 'module';
    s.textContent = [
      'import { FilesetResolver, FaceDetector }',
      '  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";',
      'window._mpFilesetResolver = FilesetResolver;',
      'window._mpFaceDetector    = FaceDetector;',
      'window._mediaPipeLoaded   = true;'
    ].join('\n');
    document.head.appendChild(s);

    // Poll until loaded (or 10 s timeout)
    var waited = 0;
    var poll = setInterval(function () {
      waited += 150;
      if (window._mediaPipeLoaded || waited >= 10000) {
        clearInterval(poll);
        cb();
      }
    }, 150);
  }

  // ── Init WebGazer ──────────────────────────────────────────────────────

  function _initWebGazer() {
    if (typeof webgazer === 'undefined') return;
    try {
      webgazer
        .setRegression('ridge')
        .setTracker('TFFacemesh')
        .showVideoPreview(false)
        .showPredictionPoints(false)
        .setGazeListener(function (data) {
          if (!data || !_currentQId) return;
          var now = Date.now();
          if (now - _lastGazeSampleTime < 250) return;
          _lastGazeSampleTime = now;
          _eyeGazeSnapshots.push({
            t: now,
            x: Math.round(data.x),
            y: Math.round(data.y)
          });
        });

      webgazer.begin().then(function () {
        _webgazerReady = true;
        console.log('[Proctoring] WebGazer started');
      }).catch(function (err) {
        console.warn('[Proctoring] WebGazer begin error:', err);
      });
    } catch (err) {
      console.warn('[Proctoring] WebGazer init error:', err);
    }
  }

  // ── Init MediaPipe FaceDetector ────────────────────────────────────────

  function _initFaceDetector() {
    if (!window._mpFilesetResolver || !window._mpFaceDetector) return;
    try {
      window._mpFilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      ).then(function (vision) {
        return window._mpFaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: [
              'https://storage.googleapis.com/mediapipe-models/face_detector/',
              'blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
            ].join(''),
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5
        });
      }).then(function (detector) {
        _faceDetector = detector;
        _faceDetectorReady = true;
        console.log('[Proctoring] FaceDetector ready');
        _startFaceDetection();
      }).catch(function (err) {
        console.warn('[Proctoring] FaceDetector init failed:', err);
      });
    } catch (err) {
      console.warn('[Proctoring] FaceDetector error:', err);
    }
  }

  // ── Camera video element (shared with WebGazer when possible) ──────────

  function _getVideo() {
    // Prefer WebGazer's own video feed (avoids second camera request)
    var wgVid = document.getElementById('webgazerVideoFeed');
    if (wgVid && wgVid.readyState >= 2) return wgVid;

    // Fall back to our own hidden video element
    if (!_videoEl) {
      _videoEl = document.createElement('video');
      _videoEl.id = '_proctoring_cam';
      _videoEl.style.cssText =
        'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
      _videoEl.autoplay = true;
      _videoEl.playsInline = true;
      _videoEl.muted = true;
      document.body.appendChild(_videoEl);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) { _videoEl.srcObject = stream; })
        .catch(function (err) {
          console.warn('[Proctoring] Camera access denied:', err);
        });
    }
    return _videoEl;
  }

  // ── Run face detection every 1 s ───────────────────────────────────────

  function _startFaceDetection() {
    _faceInterval = setInterval(function () {
      if (!_faceDetectorReady || !_currentQId) return;
      var video = _getVideo();
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      try {
        var result = _faceDetector.detectForVideo(video, Date.now());
        var count  = (result && result.detections) ? result.detections.length : 0;
        var t      = Date.now();
        _faceSnapshots.push({ t: t, faceCount: count });

        // Head-away state machine
        var looking = count >= 1;
        if (_wasLooking && !looking) _headAwayCount++;
        _wasLooking = looking;
      } catch (_) { /* silent */ }
    }, 1000);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function _elRect(el) {
    if (!el) return { x: 0, y: 0, width: 0, height: 0 };
    var r = el.getBoundingClientRect();
    return {
      x:      Math.round(r.left),
      y:      Math.round(r.top),
      width:  Math.round(r.width),
      height: Math.round(r.height)
    };
  }

  function _optionsRects() {
    var rects = [];
    $('[data-proctoring-option-id]').each(function () {
      var id = parseInt($(this).attr('data-proctoring-option-id'));
      var r  = _elRect(this);
      rects.push({ optionId: id, x: r.x, y: r.y, width: r.width, height: r.height });
    });
    return rects;
  }

  function _nearestFaceCount(t) {
    if (!_faceSnapshots.length) return 0;
    var best = _faceSnapshots[0];
    var bestD = Math.abs(best.t - t);
    for (var i = 1; i < _faceSnapshots.length; i++) {
      var d = Math.abs(_faceSnapshots[i].t - t);
      if (d < bestD) { bestD = d; best = _faceSnapshots[i]; }
    }
    return best.faceCount;
  }

  function _buildGazePoints() {
    return _eyeGazeSnapshots.map(function (ep) {
      var fc = _nearestFaceCount(ep.t);
      return {
        t:             ep.t,
        x:             ep.x,
        y:             ep.y,
        gazeDirection: _gazeDirection(ep.x, ep.y),
        faceDetected:  fc > 0,
        faceCount:     fc,
        headYaw:       null,
        headPitch:     null
      };
    });
  }

  function _buildEyeGazePoints() {
    return _eyeGazeSnapshots.map(function (ep) {
      var fc = _nearestFaceCount(ep.t);
      return { t: ep.t, x: ep.x, y: ep.y, faceDetected: fc > 0, faceCount: fc };
    });
  }

  function _faceStats() {
    if (!_faceSnapshots.length) return { max: 0, avg: 0 };
    var max = 0, sum = 0;
    _faceSnapshots.forEach(function (fp) {
      if (fp.faceCount > max) max = fp.faceCount;
      sum += fp.faceCount;
    });
    return { max: max, avg: parseFloat((sum / _faceSnapshots.length).toFixed(2)) };
  }

  function _buildQuestionData(qId, endTime) {
    var start    = _questionStartTime || endTime;
    var qEl      = document.querySelector('[data-proctoring="question-text"]');
    var stats    = _faceStats();

    return {
      questionnaireQuestionId: qId,
      screenWidth:             window.screen.width,
      screenHeight:            window.screen.height,
      questionRect:            _elRect(qEl),
      optionsRect:             _optionsRects(),
      gazePoints:              _buildGazePoints(),
      eyeGazePoints:           _buildEyeGazePoints(),
      timeSpentMs:             endTime - start,
      questionStartTime:       start,
      questionEndTime:         endTime,
      mouseClickCount:         _mouseClicks.length,
      mouseClicks:             _mouseClicks.slice(),
      maxFacesDetected:        stats.max,
      avgFacesDetected:        stats.avg,
      headAwayCount:           _headAwayCount,
      tabSwitchCount:          _tabSwitchCount
    };
  }

  function _mergeData(existing, incoming) {
    var total = (existing.avgFacesDetected + incoming.avgFacesDetected) / 2;
    return {
      questionnaireQuestionId: existing.questionnaireQuestionId,
      screenWidth:             incoming.screenWidth,
      screenHeight:            incoming.screenHeight,
      questionRect:            incoming.questionRect,
      optionsRect:             incoming.optionsRect,
      gazePoints:              existing.gazePoints.concat(incoming.gazePoints),
      eyeGazePoints:           existing.eyeGazePoints.concat(incoming.eyeGazePoints),
      timeSpentMs:             existing.timeSpentMs + incoming.timeSpentMs,
      questionStartTime:       existing.questionStartTime,
      questionEndTime:         incoming.questionEndTime,
      mouseClickCount:         existing.mouseClickCount + incoming.mouseClickCount,
      mouseClicks:             existing.mouseClicks.concat(incoming.mouseClicks),
      maxFacesDetected:        Math.max(existing.maxFacesDetected, incoming.maxFacesDetected),
      avgFacesDetected:        parseFloat(total.toFixed(2)),
      headAwayCount:           existing.headAwayCount + incoming.headAwayCount,
      tabSwitchCount:          existing.tabSwitchCount + incoming.tabSwitchCount
    };
  }

  function _resetRolling() {
    _eyeGazeSnapshots  = [];
    _faceSnapshots     = [];
    _mouseClicks       = [];
    _tabSwitchCount    = 0;
    _headAwayCount     = 0;
    _wasLooking        = true;
    _lastGazeSampleTime = 0;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Initialize proctoring. Safe to call multiple times — runs setup only once.
   * Call during assessment section render.
   */
  function init() {
    if (_initialized) return;
    _initialized = true;
    console.log('[Proctoring] Initializing...');

    document.addEventListener('visibilitychange', _onVisibilityChange);
    document.addEventListener('mousedown', _onMouseDown);

    _loadWebGazer(function () { _initWebGazer(); });
    _loadMediaPipe(function () { _initFaceDetector(); });
  }

  /**
   * Call immediately after a question's DOM is rendered.
   * Internally finalizes the previous question first (merge-on-revisit safe).
   * @param {number} qId — questionnaireQuestionId
   */
  function startQuestion(qId) {
    if (_currentQId !== null) finalizeCurrentQuestion();
    _currentQId        = qId;
    _questionStartTime = Date.now();
    _resetRolling();
  }

  /**
   * Finalize the current question: save its accumulated data.
   * Called automatically by startQuestion() and submitProctoring().
   */
  function finalizeCurrentQuestion() {
    if (_currentQId === null) return;
    var endTime  = Date.now();
    var incoming = _buildQuestionData(_currentQId, endTime);

    if (_perQuestionData[_currentQId]) {
      _perQuestionData[_currentQId] = _mergeData(_perQuestionData[_currentQId], incoming);
    } else {
      _perQuestionData[_currentQId] = incoming;
    }

    _currentQId        = null;
    _questionStartTime = null;
    _resetRolling();
  }

  /**
   * Returns the array of accumulated per-question data objects.
   */
  function getPerQuestionDataArray() {
    return Object.values(_perQuestionData);
  }

  /**
   * Fire-and-forget: finalize current question, then POST all data to backend.
   * Never throws / never blocks the caller.
   * @param {number} userStudentId
   * @param {number} assessmentId
   */
  function submitProctoring(userStudentId, assessmentId) {
    try {
      if (_currentQId !== null) finalizeCurrentQuestion();

      var data = getPerQuestionDataArray();
      if (!data.length) {
        console.log('[Proctoring] Nothing to submit');
        return;
      }

      var payload = {
        userStudentId:    userStudentId,
        assessmentId:     assessmentId,
        perQuestionData:  data
      };

      console.log('[Proctoring] Submitting', data.length, 'question records...');

      axios.post(AppConfig.API_URL + '/assessment-proctoring/save', payload, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
      }).then(function (res) {
        console.log('[Proctoring] Saved:', res.data);
      }).catch(function (err) {
        console.warn('[Proctoring] Save failed (non-fatal):', err);
      });
    } catch (err) {
      console.warn('[Proctoring] submitProctoring error (non-fatal):', err);
    }
  }

  /**
   * Stop all tracking and release camera.
   * Call when the assessment is completed or the student leaves.
   */
  function stop() {
    try {
      if (_faceInterval) { clearInterval(_faceInterval); _faceInterval = null; }
      document.removeEventListener('visibilitychange', _onVisibilityChange);
      document.removeEventListener('mousedown', _onMouseDown);

      if (typeof webgazer !== 'undefined' && _webgazerReady) {
        webgazer.end();
      }

      // Stop our own camera stream (if we created one)
      if (_videoEl && _videoEl.srcObject) {
        _videoEl.srcObject.getTracks().forEach(function (t) { t.stop(); });
        _videoEl.srcObject = null;
      }
    } catch (err) {
      console.warn('[Proctoring] stop error:', err);
    }

    _initialized        = false;
    _webgazerReady      = false;
    _faceDetectorReady  = false;
    _currentQId         = null;
    console.log('[Proctoring] Stopped');
  }

  return {
    init:                   init,
    startQuestion:          startQuestion,
    finalizeCurrentQuestion: finalizeCurrentQuestion,
    getPerQuestionDataArray: getPerQuestionDataArray,
    submitProctoring:       submitProctoring,
    stop:                   stop
  };

}());
