(function () {
  const utils = window.LR.utils;
  const dataApi = window.LR.data;
  const SELECTED_KEY = "LR_SELECTED_IDS";

  const PHASES = {
    IDLE: "idle",
    PLAYING_AUDIO: "playingAudio",
    WAITING: "waiting2s",
    RECORDING: "recording",
    COMPLETE: "complete",
  };

  const elements = {
    questionCount: utils.qs("#question-count"),
    redoBtn: utils.qs("#redo-btn"),
    importArea: utils.qs("#import-area"),
    importButton: utils.qs("#import-button"),
    importFile: utils.qs("#import-file"),
    importStatus: utils.qs("#import-status"),
    pictureWrap: utils.qs("#picture-wrap"),
    pictureImg: utils.qs("#picture-img"),
    promptAudio: utils.qs("#prompt-audio"),
    promptPlay: utils.qs("#prompt-play"),
    promptProgress: utils.qs("#prompt-progress"),
    promptTime: utils.qs("#prompt-time"),
    timerCount: utils.qs("#timer-count"),
    recordingStatus: utils.qs("#recording-status"),
    recordingAudio: utils.qs("#recording-audio"),
    recordingPlay: utils.qs("#recording-play"),
    recordingProgress: utils.qs("#recording-progress"),
    recordingTime: utils.qs("#recording-time"),
    recordingMessage: utils.qs("#recording-message"),
    prevBtn: utils.qs("#prev-btn"),
    nextBtn: utils.qs("#next-btn"),
    returnBtn: utils.qs("#return-btn"),
    completeText: utils.qs("#complete-text"),
    downloadBtn: utils.qs("#download-btn"),
    emptyState: utils.qs("#practice-empty"),
    practiceCard: utils.qs(".practice-card"),
  };

  const state = {
    rows: [],
    index: 0,
    selectedIds: [],
    itemStates: {},
    countdownTimer: null,
    pendingCountdown: null,
    countdownRemaining: 0,
    phase: PHASES.IDLE,
    promptAvailable: false,
    recordingAvailable: false,
    mediaRecorder: null,
    mediaStream: null,
  };

  let eventsBound = false;

  function getSelectedIds() {
    return utils.getStorage(SELECTED_KEY, []);
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

  function getItemState(id) {
    if (!state.itemStates[id]) {
      state.itemStates[id] = {
        recordingBlob: null,
        recordingUrl: "",
        recordingMime: "audio/webm",
        hadFallback: false,
      };
    }
    return state.itemStates[id];
  }

  function resetCountdown() {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
    if (state.pendingCountdown) {
      clearTimeout(state.pendingCountdown);
      state.pendingCountdown = null;
    }
    if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
      state.mediaRecorder.stop();
    }
    state.phase = PHASES.IDLE;
    elements.timerCount.textContent = "--";
    elements.recordingStatus.textContent = "";
  }

  function setupAudioPill(audioEl, playBtn, progress, timeLabel) {
    const update = () => {
      if (!audioEl.duration || Number.isNaN(audioEl.duration)) return;
      const pct = (audioEl.currentTime / audioEl.duration) * 100;
      progress.value = pct || 0;
      timeLabel.textContent = utils.formatTime(audioEl.currentTime);
    };

    audioEl.addEventListener("timeupdate", update);
    audioEl.addEventListener("loadedmetadata", () => {
      timeLabel.textContent = utils.formatTime(0);
      progress.value = 0;
    });

    playBtn.addEventListener("click", () => {
      if (!audioEl.src) return;
      if (audioEl.paused) {
        audioEl.play();
      } else {
        audioEl.pause();
      }
    });

    progress.addEventListener("input", () => {
      if (!audioEl.duration || Number.isNaN(audioEl.duration)) return;
      audioEl.currentTime = (progress.value / 100) * audioEl.duration;
    });
  }

  async function ensureMedia() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      return false;
    }
    if (state.mediaStream) return true;
    try {
      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (err) {
      console.log("[practice] recorder failed");
      return false;
    }
  }

  function pickMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    if (!window.MediaRecorder || !window.MediaRecorder.isTypeSupported) return "";
    return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
  }

  function startRecording(itemState) {
    if (!state.mediaStream) return false;
    let recorder;
    const chunks = [];
    const mimeType = pickMimeType();

    try {
      recorder = mimeType ? new MediaRecorder(state.mediaStream, { mimeType }) : new MediaRecorder(state.mediaStream);
    } catch (err) {
      console.log("[practice] recorder failed");
      return false;
    }

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    });

    recorder.addEventListener("start", () => {
      console.log("[practice] recorder started");
    });

    recorder.addEventListener("stop", () => {
      console.log("[practice] recorder stopped");
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (itemState.recordingUrl) {
        URL.revokeObjectURL(itemState.recordingUrl);
      }
      itemState.recordingBlob = blob;
      itemState.recordingMime = blob.type || "audio/webm";
      itemState.recordingUrl = URL.createObjectURL(blob);
      itemState.hadFallback = false;
      updateRecordingPlayer(itemState);
    });

    recorder.start();
    state.mediaRecorder = recorder;
    return true;
  }

  function completeCountdown() {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
    if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
      state.mediaRecorder.stop();
    }
    state.phase = PHASES.COMPLETE;
    elements.timerCount.textContent = "0";
    elements.recordingStatus.textContent = "Complete";
    if (!state.recordingAvailable) {
      elements.recordingMessage.textContent = "Recording not available on this device.";
    }
  }

  function startCountdown(seconds) {
    state.phase = PHASES.RECORDING;
    state.countdownRemaining = seconds;
    elements.timerCount.textContent = Math.max(seconds, 0).toString();
    elements.recordingStatus.textContent = "Recording";
    elements.recordingMessage.textContent = "";

    const item = state.rows[state.index];
    const itemState = getItemState(item.id);

    console.log(`[practice] start countdown timeSec=${seconds}`);

    ensureMedia()
      .then((available) => {
        state.recordingAvailable = available;
        if (available && state.phase === PHASES.RECORDING) {
          startRecording(itemState);
        } else {
          itemState.hadFallback = true;
          console.log("[practice] recorder failed");
        }
      })
      .catch(() => {
        state.recordingAvailable = false;
        itemState.hadFallback = true;
        console.log("[practice] recorder failed");
      });

    if (seconds <= 0) {
      completeCountdown();
      return;
    }

    state.countdownTimer = setInterval(() => {
      state.countdownRemaining -= 1;
      elements.timerCount.textContent = Math.max(state.countdownRemaining, 0).toString();
      if (state.countdownRemaining <= 0) {
        completeCountdown();
      }
    }, 1000);
  }

  function startCountdownFlow() {
    if (state.phase === PHASES.WAITING || state.phase === PHASES.RECORDING) return;
    if (state.pendingCountdown) return;
    if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
      state.mediaRecorder.stop();
    }
    const item = state.rows[state.index];
    const seconds = Number(item.timeSec);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      elements.recordingStatus.textContent = "Invalid timeSec in data";
      elements.timerCount.textContent = "--";
      return;
    }
    state.phase = PHASES.WAITING;
    elements.recordingMessage.textContent = "";
    state.pendingCountdown = setTimeout(() => {
      state.pendingCountdown = null;
      startCountdown(seconds);
    }, 2000);
  }

  function resolveMediaPath(value, folder) {
    if (value === null || value === undefined) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return raw;
    if (raw.startsWith("./")) return raw;
    if (raw.startsWith(`${folder}/`)) return `./${raw}`;
    return `./${folder}/${raw}`;
  }

  function setupPromptAudio(item) {
    const audioFile = resolveMediaPath(item.audio, "Audio");
    state.promptAvailable = Boolean(audioFile);
    elements.promptAudio.src = audioFile;
    elements.promptPlay.disabled = false;
    elements.promptProgress.disabled = !state.promptAvailable;
    elements.promptTime.textContent = "0:00";
    elements.promptPlay.textContent = state.promptAvailable ? "▶" : "Start";
    elements.promptPlay.classList.toggle("text-button", !state.promptAvailable);

    elements.promptAudio.onended = () => {
      console.log("[practice] audio ended");
      startCountdownFlow();
    };

    elements.promptAudio.onerror = () => {
      state.promptAvailable = false;
      elements.promptPlay.disabled = false;
      elements.promptProgress.disabled = true;
      elements.promptPlay.textContent = "Start";
      elements.promptPlay.classList.add("text-button");
    };
  }

  function updateRecordingPlayer(itemState) {
    if (itemState.recordingUrl) {
      elements.recordingAudio.src = itemState.recordingUrl;
      elements.recordingMessage.textContent = "";
    } else {
      elements.recordingAudio.removeAttribute("src");
      elements.recordingMessage.textContent = "No recording yet.";
    }
    elements.recordingTime.textContent = "0:00";
    elements.recordingProgress.value = 0;
  }

  function setupRecordingPlayer() {
    setupAudioPill(
      elements.recordingAudio,
      elements.recordingPlay,
      elements.recordingProgress,
      elements.recordingTime
    );
  }

  function renderItem() {
    const item = state.rows[state.index];
    if (!item) return;

    resetCountdown();
    state.recordingAvailable = false;

    elements.questionCount.textContent = `Question ${state.index + 1} of ${state.rows.length}`;

    if (item.picture) {
      elements.pictureImg.src = resolveMediaPath(item.picture, "Pic");
      elements.pictureWrap.classList.remove("hidden");
      elements.pictureImg.onerror = () => {
        elements.pictureWrap.classList.add("hidden");
      };
    } else {
      elements.pictureWrap.classList.add("hidden");
    }

    setupPromptAudio(item);
    updateRecordingPlayer(getItemState(item.id));

    const isLast = state.index === state.rows.length - 1;
    elements.prevBtn.disabled = state.index === 0;
    elements.nextBtn.disabled = isLast;
    elements.nextBtn.classList.toggle("hidden", isLast);
    elements.completeText.classList.toggle("hidden", !isLast);
  }

  function downloadFile(blob, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 500);
  }

  function handleDownload() {
    const item = state.rows[state.index];
    const itemState = getItemState(item.id);
    const fileBase = `LR_${item.date}_${item.set}_${item.num}`;

    if (itemState.recordingBlob) {
      const ext = itemState.recordingMime.includes("ogg") ? "ogg" : "webm";
      downloadFile(itemState.recordingBlob, `${fileBase}.${ext}`);
      return;
    }

    const payload = {
      id: item.id,
      timestamp: new Date().toISOString(),
      done: true,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadFile(blob, `${fileBase}.json`);
  }

  function setupEvents() {
    setupAudioPill(
      elements.promptAudio,
      elements.promptPlay,
      elements.promptProgress,
      elements.promptTime
    );
    setupRecordingPlayer();

    elements.promptAudio.addEventListener("play", () => {
      if (state.promptAvailable) {
        state.phase = PHASES.PLAYING_AUDIO;
      }
    });

    elements.promptPlay.addEventListener("click", () => {
      if (!state.promptAvailable) {
        ensureMedia();
        startCountdownFlow();
        return;
      }
      ensureMedia();
    });

    elements.redoBtn.addEventListener("click", () => {
      const item = state.rows[state.index];
      const itemState = getItemState(item.id);
      if (itemState.recordingUrl) {
        URL.revokeObjectURL(itemState.recordingUrl);
      }
      itemState.recordingBlob = null;
      itemState.recordingUrl = "";
      itemState.hadFallback = false;
      updateRecordingPlayer(itemState);
      resetCountdown();

      if (state.promptAvailable) {
        elements.promptAudio.currentTime = 0;
        elements.promptAudio.play();
      } else {
        startCountdownFlow();
      }
    });

    elements.prevBtn.addEventListener("click", () => {
      if (state.index === 0) return;
      state.index -= 1;
      renderItem();
    });

    elements.nextBtn.addEventListener("click", () => {
      if (state.index >= state.rows.length - 1) return;
      state.index += 1;
      renderItem();
    });

    elements.returnBtn.addEventListener("click", () => {
      localStorage.removeItem("LR_SELECTED_IDS");
      window.location.href = "./index.html";
    });

    elements.downloadBtn.addEventListener("click", handleDownload);
  }

  function showImport(message) {
    if (!elements.importArea) return;
    elements.importArea.classList.remove("hidden");
    if (elements.importStatus) elements.importStatus.textContent = message || "";
  }

  function hideImport() {
    if (!elements.importArea) return;
    elements.importArea.classList.add("hidden");
  }

  function bindImport() {
    if (!elements.importButton || !elements.importFile) return;
    elements.importButton.addEventListener("click", () => {
      elements.importFile.click();
    });

    elements.importFile.addEventListener("change", async () => {
      const file = elements.importFile.files[0];
      if (!file) return;
      try {
        const parsed = await dataApi.parseFile(file);
        const rows = parsed.rows || [];
        localStorage.setItem("LR_DATA_JSON", JSON.stringify(rows));
        dataApi.saveCache(rows, parsed.version || "");
        hideImport();
        handleRows(rows);
        elements.importFile.value = "";
      } catch (err) {
        showImport("Failed to read TestData.json. Please try again.");
      }
    });
  }

  function handleRows(rows) {
    state.rows = (rows || []).filter((row) => state.selectedIds.includes(row.id));
    state.index = 0;
    state.itemStates = {};
    if (!state.rows.length) {
      elements.practiceCard.classList.add("hidden");
      elements.emptyState.classList.remove("hidden");
      return;
    }
    elements.practiceCard.classList.remove("hidden");
    elements.emptyState.classList.add("hidden");
    if (!eventsBound) {
      setupEvents();
      eventsBound = true;
    }
    renderItem();
  }

  async function init() {
    const selected = getSelectedIds();
    state.selectedIds = selected;
    bindImport();

    if (!selected.length) {
      elements.practiceCard.classList.add("hidden");
      elements.emptyState.classList.remove("hidden");
      return;
    }

    let cached = utils.getStorage("LR_DATA_JSON", null);
    if (cached && isCacheInvalid(cached)) {
      localStorage.removeItem("LR_DATA_JSON");
      localStorage.removeItem("LR_DATA_VERSION");
      cached = null;
    }
    if (cached) {
      hideImport();
      handleRows(cached);
      return;
    }

    const data = await dataApi.loadData({ forceFetch: true, allowCache: false });
    if (data.status !== "ok") {
      elements.practiceCard.classList.add("hidden");
      elements.emptyState.classList.add("hidden");
      showImport(
        location.protocol === "file:"
          ? "Offline mode: please import TestData.json again."
          : "Unable to load TestData.json. Please import it."
      );
      return;
    }

    hideImport();
    handleRows(data.rows || []);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
