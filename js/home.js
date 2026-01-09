(function () {
  const utils = window.LR.utils;
  const dataApi = window.LR.data;
  const SELECTED_KEY = "LR_SELECTED_IDS";

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
    confirmModal: utils.qs("#confirm-modal"),
    confirmText: utils.qs("#confirm-text"),
    confirmCancel: utils.qs("#confirm-cancel"),
    confirmOk: utils.qs("#confirm-ok"),
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
      if (dateVals.length && !dateVals.includes(String(row.Date))) return false;
      if (setVals.length && !setVals.includes(String(row.Set))) return false;
      if (sceneVals.length && !sceneVals.includes(String(row.Scene))) return false;
      if (typeVals.length && !typeVals.includes(String(row.Type))) return false;
      if (timeMin !== null && (row.Time === null || row.Time < timeMin)) return false;
      if (timeMax !== null && (row.Time === null || row.Time > timeMax)) return false;
      if (lengthMin !== null && (row.Length === null || row.Length < lengthMin)) return false;
      if (lengthMax !== null && (row.Length === null || row.Length > lengthMax)) return false;
      if (difficultyMin !== null && (row.Difficulty === null || row.Difficulty < difficultyMin)) return false;
      if (difficultyMax !== null && (row.Difficulty === null || row.Difficulty > difficultyMax)) return false;
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
      script.textContent = row.Script || row.Prompt || "(No script)";

      const meta = document.createElement("div");
      meta.className = "result-meta";
      meta.textContent = `${row.Scene || ""} / ${row.Type || ""} / ${row.Length ?? ""} / ${row.Difficulty ?? ""} / ${row.Time ?? ""}`;

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

  function initFilters() {
    const dates = utils.uniqueInOrder(state.rows.map((row) => row.Date));
    const sets = utils.uniqueInOrder(state.rows.map((row) => row.Set));
    const scenes = utils.uniqueInOrder(state.rows.map((row) => row.Scene));
    const types = utils.uniqueInOrder(state.rows.map((row) => row.Type));

    buildCheckboxList(elements.filterDate, dates);
    buildCheckboxList(elements.filterSet, sets);
    buildCheckboxList(elements.filterScene, scenes);
    buildCheckboxList(elements.filterType, types);

    const times = state.rows.map((row) => row.Time).filter((val) => val !== null);
    const lengths = state.rows.map((row) => row.Length).filter((val) => val !== null);
    const diffs = state.rows.map((row) => row.Difficulty).filter((val) => val !== null);

    if (times.length) {
      elements.filterTimeMin.placeholder = Math.min(...times);
      elements.filterTimeMax.placeholder = Math.max(...times);
    }
    if (lengths.length) {
      elements.filterLengthMin.placeholder = Math.min(...lengths);
      elements.filterLengthMax.placeholder = Math.max(...lengths);
    }
    if (diffs.length) {
      elements.filterDifficultyMin.placeholder = Math.min(...diffs);
      elements.filterDifficultyMax.placeholder = Math.max(...diffs);
    }

    const filterContainers = [
      elements.filterDate,
      elements.filterSet,
      elements.filterScene,
      elements.filterType,
    ];

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
  }

  function setupImport() {
    if (Array.isArray(window.LR_DATA_SEED) && window.LR_DATA_SEED.length) {
      elements.importArea.classList.add("hidden");
      return;
    }
    if (!window.XLSX) {
      elements.importArea.classList.remove("hidden");
      elements.importStatus.textContent = "XLSX library not loaded.";
      elements.importButton.disabled = true;
      return;
    }

    elements.importButton.addEventListener("click", () => {
      elements.importFile.click();
    });

    elements.importFile.addEventListener("change", async () => {
      const file = elements.importFile.files[0];
      if (!file) return;
      try {
        const rows = await dataApi.parseFile(file);
        window.LR_DATA = rows;
        localStorage.setItem("LR_DATA_JSON", JSON.stringify(rows));
        console.log("Imported rows:", rows.length);
        console.log("First row:", rows[0]);
        state.rows = rows;
        dataApi.saveCache(rows);
        elements.importStatus.textContent = `Loaded ${rows.length} rows from ${file.name}.`;
        initFilters();
        refresh();
      } catch (err) {
        alert("Failed to read the Excel file. Please try again.");
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
  }

  async function init() {
    setupImport();
    setupActions();
    closeModal();

    const data = await dataApi.loadData();
    if (data.status === "need_import") {
      elements.importArea.classList.remove("hidden");
      return;
    }

    state.rows = data.rows || [];
    pruneSelected(state.rows);
    window.LR_DATA = state.rows;
    initFilters();
    refresh();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
