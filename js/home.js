(function () {
  const utils = window.LR.utils;
  const dataApi = window.LR.data;
  const SELECTED_KEY = "LR_SELECTED_IDS";
  const DATA_KEY = "LR_DATA_JSON";

  const state = {
    rows: [],
    selected: new Set(utils.getStorage(SELECTED_KEY, [])),
  };

  const elements = {
    importArea: utils.qs("#import-area"),
    importButton: utils.qs("#import-button"),
    importFile: utils.qs("#import-file"),
    importStatus: utils.qs("#import-status"),
    resultsCount: utils.qs("#results-count"),
    resultsList: utils.qs("#results-list"),
    removeSelected: utils.qs("#remove-selected"),
    practiceSelected: utils.qs("#practice-selected"),
    selectAllFiltered: utils.qs("#select-all-filtered"),
    clearSelection: utils.qs("#clear-selection"),
    confirmModal: utils.qs("#confirm-modal"),
    confirmText: utils.qs("#confirm-text"),
    confirmCancel: utils.qs("#confirm-cancel"),
    confirmOk: utils.qs("#confirm-ok"),
    refreshData: utils.qs("#refresh-data"),
    dataSourceBadge: utils.qs("#data-source-badge"),
    refreshBanner: utils.qs("#refresh-banner"),
    filterDate: utils.qs("#filter-date"),
    filterSet: utils.qs("#filter-set"),
    filterScene: utils.qs("#filter-scene"),
    filterType: utils.qs("#filter-type"),
    filterTimeMin: utils.qs("#filter-time-min"),
    filterTimeMax: utils.qs("#filter-time-max"),
    filterLengthMin: utils.qs("#filter-length-min"),
    filterLengthMax: utils.qs("#filter-length-max"),
    filterDifficultyMin: utils.qs("#filter-difficulty-min"),
    filterDifficultyMax: utils.qs("#filter-difficulty-max"),
  };

  let filtersBound = false;

  function saveSelected() {
    utils.setStorage(SELECTED_KEY, Array.from(state.selected));
  }

  function pruneSelected(rows) {
    const ids = new Set(rows.map((row) => row.id));
    state.selected = new Set(Array.from(state.selected).filter((id) => ids.has(id)));
    saveSelected();
  }

  function buildCheckboxList(container, items) {
    container.innerHTML = "";
    items.forEach((item) => {
      const label = document.createElement("label");
      label.className = "checkbox-row";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = item;
      label.appendChild(input);
      label.appendChild(document.createTextNode(item));
      container.appendChild(label);
    });
  }

  function getCheckedValues(container) {
    return utils
      .qsa("input[type='checkbox']", container)
      .filter((input) => input.checked)
      .map((input) => input.value);
  }

  function applyFilters() {
    const dateVals = getCheckedValues(elements.filterDate);
    const setVals = getCheckedValues(elements.filterSet);
    const sceneVals = getCheckedValues(elements.filterScene);
    const typeVals = getCheckedValues(elements.filterType);

    const timeMin = utils.toNumber(elements.filterTimeMin.value);
    const timeMax = utils.toNumber(elements.filterTimeMax.value);
    const lengthMin = utils.toNumber(elements.filterLengthMin.value);
    const lengthMax = utils.toNumber(elements.filterLengthMax.value);
    const difficultyMin = utils.toNumber(elements.filterDifficultyMin.value);
    const difficultyMax = utils.toNumber(elements.filterDifficultyMax.value);

    return state.rows.filter((row) => {
      if (dateVals.length && !dateVals.includes(String(row.date))) return false;
      if (setVals.length && !setVals.includes(String(row.set))) return false;
      if (sceneVals.length && !sceneVals.includes(String(row.scene))) return false;
      if (typeVals.length && !typeVals.includes(String(row.type))) return false;
      if (timeMin !== null && (row.timeSec === null || row.timeSec < timeMin)) return false;
      if (timeMax !== null && (row.timeSec === null || row.timeSec > timeMax)) return false;
      if (lengthMin !== null && (row.length === null || row.length < lengthMin)) return false;
      if (lengthMax !== null && (row.length === null || row.length > lengthMax)) return false;
      if (difficultyMin !== null && (row.difficulty === null || row.difficulty < difficultyMin)) return false;
      if (difficultyMax !== null && (row.difficulty === null || row.difficulty > difficultyMax)) return false;
      return true;
    });
  }

  function renderResults(rows) {
    elements.resultsList.innerHTML = "";
    rows.forEach((row) => {
      const wrapper = document.createElement("div");
      wrapper.className = "result-row";
      wrapper.dataset.id = row.id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selected.has(row.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.selected.add(row.id);
        } else {
          state.selected.delete(row.id);
        }
        updateSelectedCount();
        saveSelected();
      });

      const content = document.createElement("div");
      content.className = "result-main";

      const script = document.createElement("div");
      script.className = "result-script";
      script.textContent = row.script || row.prompt || "(No script)";

      const meta = document.createElement("div");
      meta.className = "result-meta";
      meta.textContent = `${row.scene || ""} / ${row.type || ""} / ${row.length ?? ""} / ${row.difficulty ?? ""} / ${row.timeSec ?? ""}`;

      content.appendChild(script);
      content.appendChild(meta);

      wrapper.appendChild(checkbox);
      wrapper.appendChild(content);
      elements.resultsList.appendChild(wrapper);
    });

    elements.resultsCount.textContent = `Showing ${rows.length} / ${state.rows.length}`;
  }

  function updateSelectedCount() {
    const count = state.selected.size;
    elements.practiceSelected.textContent = `Practice selected (${count})`;
    elements.practiceSelected.disabled = count === 0;
  }

  function openModal() {
    elements.confirmModal.classList.remove("hidden");
    elements.confirmModal.setAttribute("aria-hidden", "false");
    console.log("[home] modal open", state.selected.size);
    console.log("[home] selectedIds", Array.from(state.selected));
  }

  function closeModal() {
    elements.confirmModal.classList.add("hidden");
    elements.confirmModal.setAttribute("aria-hidden", "true");
  }

  function refresh() {
    const filtered = applyFilters();
    renderResults(filtered);
    updateSelectedCount();
  }

  function setDataSourceLabel(source) {
    if (!elements.dataSourceBadge) return;
    const label = source === "cache" ? "cached" : "JSON";
    elements.dataSourceBadge.textContent = `Data source: ${label}`;
  }

  function showBanner(message, type) {
    if (!elements.refreshBanner) return;
    if (!message) {
      elements.refreshBanner.classList.add("hidden");
      elements.refreshBanner.textContent = "";
      elements.refreshBanner.classList.remove("banner-success", "banner-error");
      return;
    }
    elements.refreshBanner.textContent = message;
    elements.refreshBanner.classList.remove("hidden");
    elements.refreshBanner.classList.toggle("banner-success", type === "success");
    elements.refreshBanner.classList.toggle("banner-error", type === "error");
  }

  function resetFilterInputs() {
    elements.filterTimeMin.value = "";
    elements.filterTimeMax.value = "";
    elements.filterLengthMin.value = "";
    elements.filterLengthMax.value = "";
    elements.filterDifficultyMin.value = "";
    elements.filterDifficultyMax.value = "";
  }

  function initFilters() {
    const dates = utils.uniqueInOrder(state.rows.map((row) => row.date));
    const sets = utils.uniqueInOrder(state.rows.map((row) => row.set));
    const scenes = utils.uniqueInOrder(state.rows.map((row) => row.scene));
    const types = utils.uniqueInOrder(state.rows.map((row) => row.type));

    buildCheckboxList(elements.filterDate, dates);
    buildCheckboxList(elements.filterSet, sets);
    buildCheckboxList(elements.filterScene, scenes);
    buildCheckboxList(elements.filterType, types);

    const times = state.rows.map((row) => row.timeSec).filter((val) => val !== null);
    const lengths = state.rows.map((row) => row.length).filter((val) => val !== null);
    const diffs = state.rows.map((row) => row.difficulty).filter((val) => val !== null);

    elements.filterTimeMin.placeholder = times.length ? Math.min(...times) : "";
    elements.filterTimeMax.placeholder = times.length ? Math.max(...times) : "";
    elements.filterLengthMin.placeholder = lengths.length ? Math.min(...lengths) : "";
    elements.filterLengthMax.placeholder = lengths.length ? Math.max(...lengths) : "";
    elements.filterDifficultyMin.placeholder = diffs.length ? Math.min(...diffs) : "";
    elements.filterDifficultyMax.placeholder = diffs.length ? Math.max(...diffs) : "";

    const filterContainers = [
      elements.filterDate,
      elements.filterSet,
      elements.filterScene,
      elements.filterType,
    ];

    if (!filtersBound) {
      filterContainers.forEach((container) => {
        container.addEventListener("change", refresh);
      });

      [
        elements.filterTimeMin,
        elements.filterTimeMax,
        elements.filterLengthMin,
        elements.filterLengthMax,
        elements.filterDifficultyMin,
        elements.filterDifficultyMax,
      ].forEach((input) => {
        input.addEventListener("input", refresh);
      });
      filtersBound = true;
    }
  }

  function setupImport() {
    elements.importButton.addEventListener("click", () => {
      elements.importFile.click();
    });

    elements.importFile.addEventListener("change", async () => {
      const file = elements.importFile.files[0];
      if (!file) return;
      try {
        const parsed = await dataApi.parseFile(file);
        const rows = parsed.rows || [];
        window.LR_DATA = rows;
        localStorage.setItem("LR_DATA_JSON", JSON.stringify(rows));
        state.rows = rows;
        dataApi.saveCache(rows, parsed.version || "");
        elements.importStatus.textContent = `Loaded ${rows.length} items from ${file.name}.`;
        showBanner(`Data refreshed. Loaded ${rows.length} items.`, "success");
        setDataSourceLabel("json");
        initFilters();
        refresh();
        elements.importFile.value = "";
      } catch (err) {
        showBanner("Failed to read TestData.json. Please try again.", "error");
      }
    });
  }

  function setupActions() {
    elements.removeSelected.addEventListener("click", () => {
      const current = utils.qsa(".result-row input[type='checkbox']", elements.resultsList);
      current.forEach((input) => {
        if (input.checked) {
          const row = input.closest(".result-row");
          if (row) state.selected.delete(row.dataset.id);
        }
      });
      saveSelected();
      refresh();
    });

    if (elements.selectAllFiltered) {
      elements.selectAllFiltered.addEventListener("click", () => {
        const filtered = applyFilters();
        filtered.forEach((row) => state.selected.add(row.id));
        saveSelected();
        refresh();
      });
    }

    if (elements.clearSelection) {
      elements.clearSelection.addEventListener("click", () => {
        state.selected.clear();
        saveSelected();
        refresh();
      });
    }

    elements.practiceSelected.addEventListener("click", () => {
      const count = state.selected.size;
      if (count === 0) return;
      elements.confirmText.textContent = `You are about to practice ${count} selected item(s).`;
      openModal();
    });

    elements.confirmCancel.addEventListener("click", () => {
      closeModal();
    });

    elements.confirmOk.addEventListener("click", () => {
      if (state.selected.size === 0) return;
      closeModal();
      localStorage.setItem("LR_SELECTED_IDS", JSON.stringify(Array.from(state.selected)));
      window.location.href = "./practice.html";
    });

    elements.confirmModal.addEventListener("click", (event) => {
      if (event.target === elements.confirmModal) closeModal();
    });

    if (elements.refreshData) {
      elements.refreshData.addEventListener("click", async () => {
        console.log("[refresh] clicked");
        console.log("[refresh] protocol", location.protocol);
        localStorage.removeItem(DATA_KEY);
        localStorage.removeItem(SELECTED_KEY);
        localStorage.removeItem("LR_DATA_VERSION");
        state.selected = new Set();
        updateSelectedCount();

        resetFilterInputs();
        showBanner("", "");

        if (location.protocol === "file:") {
          elements.importArea.classList.remove("hidden");
          elements.importStatus.textContent = "Offline mode: please import TestData.json again.";
          showBanner("Offline mode: please import TestData.json again.", "error");
          elements.importFile.value = "";
          state.rows = [];
          initFilters();
          refresh();
          setDataSourceLabel("json");
          return;
        }

        const data = await dataApi.loadData({ forceFetch: true, allowCache: false });
        if (data.status !== "ok") {
          elements.importArea.classList.remove("hidden");
          elements.importStatus.textContent = "Unable to load TestData.json. Please try again.";
          showBanner(`Refresh failed: ${data.error || "Unable to load TestData.json."}`, "error");
          return;
        }
        state.rows = data.rows || [];
        window.LR_DATA = state.rows;
        initFilters();
        refresh();
        console.log("[refresh] reloaded items", state.rows.length);
        showBanner(`Data refreshed. Loaded ${state.rows.length} items.`, "success");
        setDataSourceLabel(data.source === "cache" ? "cache" : "json");
      });
    }
  }

  async function init() {
    setupImport();
    setupActions();
    closeModal();

    const data = await dataApi.loadData();
    if (data.status !== "ok") {
      elements.importArea.classList.remove("hidden");
      elements.importStatus.textContent =
        location.protocol === "file:"
          ? "Offline mode: please import TestData.json again."
          : "Unable to load TestData.json. Please import it.";
      showBanner(data.error ? `Load failed: ${data.error}` : "", "error");
      return;
    }

    state.rows = data.rows || [];
    pruneSelected(state.rows);
    window.LR_DATA = state.rows;
    initFilters();
    refresh();
    setDataSourceLabel(data.source === "cache" ? "cache" : "json");
    if (location.protocol === "file:") {
      elements.importArea.classList.remove("hidden");
      elements.importStatus.textContent = "Offline mode: import TestData.json to refresh.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
