// Lightweight mouse tracker & per-question timing
(function (global) {
  const MouseTracker = {
    _log: [], // {questionId, durationMs, samples: [{x,y,t}], startedAt, endedAt}
    _current: null,
    _handler: null,
    startQuestion(questionId) {
      // stop previous if any
      if (this._current) this.endQuestion(this._current.questionId);
      this._current = { questionId, samples: [], startedAt: Date.now() };
      this._handler = (e) => {
        const t = Date.now() - this._current.startedAt;
        this._current.samples.push({ x: e.clientX, y: e.clientY, t });
      };
      window.addEventListener('mousemove', this._handler);
    },
    endQuestion(questionId) {
      if (!this._current || this._current.questionId !== questionId) return null;
      window.removeEventListener('mousemove', this._handler);
      this._current.endedAt = Date.now();
      this._current.durationMs = this._current.endedAt - this._current.startedAt;
      const entry = { questionId: this._current.questionId, durationMs: this._current.durationMs, samples: this._current.samples.slice(), startedAt: this._current.startedAt, endedAt: this._current.endedAt };
      this._log.push(entry);
      this._current = null;
      this._handler = null;
      return entry;
    },
    getLog() { return this._log.slice(); },
    clearLog() { this._log = []; },
  };
  global.MouseTracker = MouseTracker;
})(window);