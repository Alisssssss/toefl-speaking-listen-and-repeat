(function () {
  const utils = {};

  utils.qs = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };

  utils.qsa = function (selector, scope) {
    return Array.from((scope || document).querySelectorAll(selector));
  };

  utils.formatTime = function (seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  utils.toNumber = function (value) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  utils.getStorage = function (key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  };

  utils.setStorage = function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  };

  utils.uniqueInOrder = function (items) {
    const seen = new Set();
    const result = [];
    items.forEach((item) => {
      const key = item === null || item === undefined ? "" : String(item);
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    });
    return result;
  };

  utils.clampRange = function (value, min, max) {
    if (value === null) return null;
    if (min !== null && value < min) return min;
    if (max !== null && value > max) return max;
    return value;
  };

  window.LR = window.LR || {};
  window.LR.utils = utils;
})();
