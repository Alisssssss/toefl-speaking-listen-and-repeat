(function () {
  const utils = window.LR.utils;
  const STORAGE_KEY = "LR_DATA_JSON";
  const VERSION_KEY = "LR_DATA_VERSION";

  function normalizeItem(item) {
    const date = item.date ?? item.Date ?? item.DATE ?? "";
    const set = item.set ?? item.Set ?? item.SET ?? "";
    const num =
      item.num ??
      item.Number ??
      item.number ??
      item.No ??
      item.no ??
      item["#"] ??
      item["No."] ??
      "";
    const timeValue =
      item.timeSec ??
      item.timesec ??
      item.time_sec ??
      item.Time ??
      item["Time/s"] ??
      item.time ??
      item.times ??
      "";
    const lengthValue = item.length ?? item.Length ?? "";
    const difficultyValue = item.difficulty ?? item.Difficulty ?? "";

    const dateStr = date === null || date === undefined ? "" : String(date).trim();
    const setStr = set === null || set === undefined ? "" : String(set).trim();
    const numStr = num === null || num === undefined ? "" : String(num).trim();
    const fallbackId = `${dateStr}_${setStr}_${numStr}`;

    return {
      id: item.id ? String(item.id) : fallbackId,
      date: dateStr,
      set: setStr,
      num: numStr,
      timeSec: utils.toNumber(timeValue),
      scene: item.scene ?? item.Scene ?? "",
      type: item.type ?? item.Type ?? "",
      length: utils.toNumber(lengthValue),
      difficulty: utils.toNumber(difficultyValue),
      prompt: item.prompt ?? item.Prompt ?? "",
      script: item.script ?? item.Script ?? "",
      audio: item.audio ?? item.Audio ?? "",
      picture: item.picture ?? item.Picture ?? "",
    };
  }

  function extractItems(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function normalizePayload(payload) {
    const items = extractItems(payload);
    const rows = items
      .map(normalizeItem)
      .filter((row) => row && row.id && Number.isFinite(row.timeSec) && row.timeSec > 0);
    const version = payload && payload.version ? String(payload.version) : "";
    return { rows, version };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Fetch failed");
    return response.json();
  }

  function isCacheInvalid(rows) {
    if (!Array.isArray(rows) || !rows.length) return true;
    return rows.some((row) => {
      if (!row) return true;
      if (row.Date !== undefined || row.Time !== undefined) return true;
      if (!Number.isFinite(row.timeSec) || row.timeSec <= 0) return true;
      return false;
    });
  }

  function loadCache() {
    const cached = utils.getStorage(STORAGE_KEY, null);
    if (cached && isCacheInvalid(cached)) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(VERSION_KEY);
      } catch (err) {
        // Ignore storage cleanup errors.
      }
      return null;
    }
    return cached;
  }

  function saveCache(rows, version) {
    utils.setStorage(STORAGE_KEY, rows);
    if (version) {
      utils.setStorage(VERSION_KEY, version);
    } else {
      try {
        localStorage.removeItem(VERSION_KEY);
      } catch (err) {
        // Ignore storage cleanup errors.
      }
    }
  }

  async function loadData(options) {
    const opts = options || {};
    const allowCache = opts.allowCache !== false;
    const forceFetch = Boolean(opts.forceFetch);
    const cached = allowCache ? loadCache() : null;

    if (location.protocol === "file:") {
      if (cached) {
        return { status: "ok", rows: cached, source: "cache" };
      }
      return { status: "need_import", error: "Offline mode: please import TestData.json again." };
    }

    if (!forceFetch && cached) {
      // Still attempt a fresh fetch; cached is used only as fallback.
    }

    try {
      const payload = await fetchJson(`./TestData.json?ts=${Date.now()}`);
      const normalized = normalizePayload(payload);
      const version = normalized.version || String(Date.now());
      saveCache(normalized.rows, version);
      console.log("[data] first item", normalized.rows[0]);
      console.log("[data] timeSec sample", normalized.rows.slice(0, 3).map((x) => x.timeSec));
      return { status: "ok", rows: normalized.rows, source: "fetch", version };
    } catch (err) {
      if (cached) {
        return { status: "ok", rows: cached, source: "cache" };
      }
      return {
        status: "need_import",
        error: err && err.message ? err.message : "Failed to load TestData.json",
      };
    }
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const payload = JSON.parse(reader.result);
          const normalized = normalizePayload(payload);
          const version = normalized.version || String(Date.now());
          console.log("[data] first item", normalized.rows[0]);
          console.log("[data] timeSec sample", normalized.rows.slice(0, 3).map((x) => x.timeSec));
          resolve({ rows: normalized.rows, version });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  window.LR = window.LR || {};
  window.LR.data = {
    loadData,
    parseFile,
    saveCache,
  };
})();
