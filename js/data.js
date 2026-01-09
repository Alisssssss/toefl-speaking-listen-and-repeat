(function () {
  const utils = window.LR.utils;
  const STORAGE_KEY = "LR_DATA_JSON";
  const LEGACY_KEY = "LR_DATA_CACHE";

  function normalizeHeader(header) {
    if (!header) return "";
    return String(header)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9#\/]/g, "");
  }

  function headerKey(header) {
    const normalized = normalizeHeader(header);
    const map = {
      date: "Date",
      set: "Set",
      "#": "#",
      no: "#",
      number: "#",
      times: "Time/s",
      "time/s": "Time/s",
      time: "Time/s",
      scene: "Scene",
      prompt: "Prompt",
      audio: "Audio",
      script: "Script",
      type: "Type",
      length: "Length",
      difficulty: "Difficulty",
      picture: "Picture",
    };
    return map[normalized] || "";
  }

  function padValue(value) {
    const str = value === null || value === undefined ? "" : String(value).trim();
    if (!str) return "00";
    const num = Number(str);
    if (Number.isFinite(num)) {
      return Math.floor(num).toString().padStart(2, "0");
    }
    return str.padStart(2, "0");
  }

  function parseRows(rows) {
    if (!rows || !rows.length) return [];
    const headerRow = rows[0];
    const headerMap = {};
    headerRow.forEach((header, index) => {
      const key = headerKey(header);
      if (key) headerMap[key] = index;
    });

    const result = [];
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "")) {
        continue;
      }

      const date = row[headerMap.Date] || "";
      const set = row[headerMap.Set] || "";
      const num = row[headerMap["#"]] || "";
      const timeValue = row[headerMap["Time/s"]];
      const lengthValue = row[headerMap.Length];
      const difficultyValue = row[headerMap.Difficulty];

      const setPadded = padValue(set);
      const numPadded = padValue(num);
      const id = `${date}_${setPadded}_${numPadded}`;

      result.push({
        id,
        Date: date,
        Set: set,
        SetPadded: setPadded,
        Number: num,
        NumberPadded: numPadded,
        Time: utils.toNumber(timeValue),
        Scene: row[headerMap.Scene] || "",
        Prompt: row[headerMap.Prompt] || "",
        Audio: row[headerMap.Audio] || "",
        Script: row[headerMap.Script] || "",
        Type: row[headerMap.Type] || "",
        Length: utils.toNumber(lengthValue),
        Difficulty: utils.toNumber(difficultyValue),
        Picture: row[headerMap.Picture] || "",
      });
    }

    return result;
  }

  function parseWorkbook(workbook) {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    return parseRows(rows);
  }

  async function fetchExcel(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Fetch failed");
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    return parseWorkbook(workbook);
  }

  function loadCache() {
    const primary = utils.getStorage(STORAGE_KEY, null);
    if (primary) return primary;
    return utils.getStorage(LEGACY_KEY, null);
  }

  function saveCache(rows) {
    utils.setStorage(STORAGE_KEY, rows);
    utils.setStorage(LEGACY_KEY, rows);
  }

  async function loadData() {
    if (location.protocol === "file:") {
      if (Array.isArray(window.LR_DATA_SEED) && window.LR_DATA_SEED.length) {
        saveCache(window.LR_DATA_SEED);
        return { status: "ok", rows: window.LR_DATA_SEED, source: "seed" };
      }
    } else {
      try {
        const rows = await fetchExcel("./TestData.xlsx");
        saveCache(rows);
        return { status: "ok", rows, source: "fetch" };
      } catch (err) {
        const cached = loadCache();
        if (cached) {
          return { status: "ok", rows: cached, source: "cache" };
        }
        return { status: "need_import" };
      }
    }

    const cached = loadCache();
    if (cached) {
      return { status: "ok", rows: cached, source: "cache" };
    }

    return { status: "need_import" };
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const data = new Uint8Array(reader.result);
          const workbook = XLSX.read(data, { type: "array" });
          resolve(parseWorkbook(workbook));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  window.LR = window.LR || {};
  window.LR.data = {
    loadData,
    parseFile,
    saveCache,
  };
})();
