(function () {
  const utils = window.LR.utils;
  const dataApi = window.LR.data;
  const SELECTED_KEY = "LR_SELECTED_IDS";

  const elements = {
    questionCount: utils.qs("#question-count"),
    redoBtn: utils.qs("#redo-btn"),
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
    downloadBtn: utils.qs("#download-btn"),
    emptyState: utils.qs("#practice-empty"),
    practiceCard: utils.qs(".practice-card"),
  };

  const state = {
    rows: [],
    index: 0,
    itemStates: {},
    countdownTimer: null,
    pendingCountdown: null,
    countdownRemaining: 0,
    isCounting: false,
    promptAvailable: false,
    recordingAvailable: false,
    mediaRecorder: null,
    mediaStream: null,
  };

  function getSelectedIds() {
    return utils.getStorage(SELECTED_KEY, []);
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
    state.isCounting = false;
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
      return false;
    }
  }

  function startRecording(durationSec, itemState) {
    if (!state.mediaStream) return false;

    const options = {};
    const recorder = new MediaRecorder(state.mediaStream, options);
    const chunks = [];

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    });

    recorder.addEventListener("stop", () => {
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
    setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, durationSec * 1000);

    return true;
  }

  function startCountdown(seconds) {
    resetCountdown();
    state.countdownRemaining = seconds;
    state.isCounting = true;
    elements.timerCount.textContent = seconds.toString();
    elements.recordingStatus.textContent = "Recording";

    const item = state.rows[state.index];
    const itemState = getItemState(item.id);

    ensureMedia().then((available) => {
      state.recordingAvailable = available;
      if (available) {
        startRecording(seconds, itemState);
      } else {
        itemState.hadFallback = true;
      }
    });

    state.countdownTimer = setInterval(() => {
      state.countdownRemaining -= 1;
      elements.timerCount.textContent = Math.max(state.countdownRemaining, 0).toString();
      if (state.countdownRemaining <= 0) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
        state.isCounting = false;
        elements.recordingStatus.textContent = "Complete";
        if (!state.recordingAvailable) {
          elements.recordingMessage.textContent = "Recording not available on this device.";
        }
      }
    }, 1000);
  }

  function scheduleCountdown() {
    const item = state.rows[state.index];
    const seconds = Number(item.Time) || 0;
    if (state.isCounting || state.pendingCountdown) return;
    resetCountdown();
    elements.recordingMessage.textContent = "";
    if (seconds <= 0) {
      elements.timerCount.textContent = "0";
      return;
    }
    state.pendingCountdown = setTimeout(() => {
      startCountdown(seconds);
    }, 2000);
  }

  function setupPromptAudio(item) {
    const audioFile = item.Audio ? `./Audio/${item.Audio}` : "";
    state.promptAvailable = Boolean(audioFile);
    elements.promptAudio.src = audioFile;
    elements.promptPlay.disabled = false;
    elements.promptProgress.disabled = !state.promptAvailable;
    elements.promptTime.textContent = "0:00";

    elements.promptAudio.onended = () => {
      scheduleCountdown();
    };

    elements.promptAudio.onerror = () => {
      state.promptAvailable = false;
      elements.promptPlay.disabled = false;
      elements.promptProgress.disabled = true;
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

    elements.questionCount.textContent = `Question ${state.index + 1} of ${state.rows.length}`;

    if (item.Picture) {
      elements.pictureImg.src = `./Pic/${item.Picture}`;
      elements.pictureWrap.classList.remove("hidden");
      elements.pictureImg.onerror = () => {
        elements.pictureWrap.classList.add("hidden");
      };
    } else {
      elements.pictureWrap.classList.add("hidden");
    }

    setupPromptAudio(item);
    updateRecordingPlayer(getItemState(item.id));

    elements.prevBtn.disabled = state.index === 0;
    elements.nextBtn.disabled = state.index === state.rows.length - 1;
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
    const fileBase = `LR_${item.Date}_${item.SetPadded}_${item.NumberPadded}`;

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

    elements.promptPlay.addEventListener("click", () => {
      if (!state.promptAvailable) {
        scheduleCountdown();
      }
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
        scheduleCountdown();
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

    elements.downloadBtn.addEventListener("click", handleDownload);
  }

  async function init() {
    const selected = getSelectedIds();
    if (!selected.length) {
      elements.practiceCard.classList.add("hidden");
      elements.emptyState.classList.remove("hidden");
      return;
    }

    const data = await dataApi.loadData();
    if (data.status !== "ok") {
      elements.practiceCard.classList.add("hidden");
      elements.emptyState.classList.remove("hidden");
      return;
    }

    state.rows = (data.rows || []).filter((row) => selected.includes(row.id));
    if (!state.rows.length) {
      elements.practiceCard.classList.add("hidden");
      elements.emptyState.classList.remove("hidden");
      return;
    }

    setupEvents();
    renderItem();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
