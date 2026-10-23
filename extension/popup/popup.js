// Popup UI: lists the caption tracks of the video in the active tab and saves
// or copies the chosen one. Every YouTube request goes through page-api.js in
// the tab's main world; this file only renders, converts and downloads.
import { parseJson3 } from '../lib/captions.js';
import { FORMATS, buildFilename, formatClock, renderSubtitles } from '../lib/formats.js';

const API_NAME = '__ytSubtitleDownloader';
const PAGE_SCRIPT = 'page/page-api.js';
const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'm.youtube.com']);
const PREFS_KEY = 'subtitle-downloader-prefs';
// Upper bound for one page call; page-api.js also times out each request.
const CALL_TIMEOUT_MS = 60000;

const $ = (id) => document.getElementById(id);
const state = { tabId: null, video: null, cues: new Map(), busy: false };

init().catch((error) => showMessage(error?.message ?? String(error), true));

async function init() {
  renderFormatChoices();
  const tab = await targetTab();
  if (!tab || !isYouTube(tab.url)) {
    showMessage('Open a YouTube video, then click the extension again.');
    return;
  }
  state.tabId = tab.id;
  const info = await callPage('getVideoInfo');
  if (info?.reason === 'not-video') {
    showMessage('Open a video or a Short to download its subtitles.');
  } else if (!info?.video) {
    showMessage("The YouTube player isn't ready yet. Wait for the video to load and try again.");
  } else if (!info.video.tracks.length) {
    showMessage('This video has no subtitles or auto-generated captions.');
  } else {
    state.video = info.video;
    renderVideo(info.video);
  }
}

/** The active tab, or the tab named by ?tabId= when the popup is opened as a page for debugging. */
async function targetTab() {
  const requested = Number(new URLSearchParams(location.search).get('tabId'));
  if (requested) return chrome.tabs.get(requested);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isYouTube(url) {
  try {
    return YOUTUBE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Calls window.__ytSubtitleDownloader[method](args) in the tab's main world. */
function callPage(method, args = null) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('YouTube took too long to answer. Reload the tab and try again.')),
      CALL_TIMEOUT_MS,
    );
  });
  return Promise.race([callPageNow(method, args), timeout]).finally(() => clearTimeout(timer));
}

async function callPageNow(method, args) {
  const invoke = async () => {
    const [frame] = await chrome.scripting.executeScript({
      target: { tabId: state.tabId },
      world: 'MAIN',
      func: async (apiName, name, payload) => {
        const api = window[apiName];
        if (!api) return { missing: true };
        try {
          return { value: await api[name](payload) };
        } catch (error) {
          return { error: String(error?.message ?? error) };
        }
      },
      args: [API_NAME, method, args],
    });
    return frame?.result;
  };
  let result = await invoke();
  if (!result) {
    // No result means the document was replaced mid-call (YouTube sometimes
    // reloads itself right after opening); ask the new document once more.
    await new Promise((resolve) => setTimeout(resolve, 500));
    result = await invoke();
  }
  if (result?.missing) {
    // Tabs that were open before the extension was installed have no content script yet.
    await chrome.scripting.executeScript({ target: { tabId: state.tabId }, world: 'MAIN', files: [PAGE_SCRIPT] });
    result = await invoke();
  }
  if (!result) throw new Error('Could not reach the YouTube tab. Reload it and try again.');
  if (result.error) throw new Error(result.error);
  return result.value;
}

function renderFormatChoices() {
  $('formats').replaceChildren(
    ...Object.entries(FORMATS).map(([value, format]) => {
      const label = document.createElement('label');
      const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'format', value });
      const text = Object.assign(document.createElement('span'), { textContent: format.label });
      label.append(input, text);
      return label;
    }),
  );
}

function renderVideo(video) {
  const prefs = loadPrefs();
  $('video-title').textContent = video.title || 'Untitled video';
  $('video-meta').textContent = [video.author, video.lengthSeconds ? formatClock(video.lengthSeconds * 1000) : '']
    .filter(Boolean)
    .join(' · ');

  $('track').replaceChildren(...video.tracks.map((track, index) => new Option(track.name, String(index))));
  $('track').value = String(preferredTrackIndex(video.tracks));

  $('translate').append(
    ...video.translationLanguages.map((language) => new Option(language.name, language.languageCode)),
  );
  if (video.translationLanguages.some((language) => language.languageCode === prefs.translate)) {
    $('translate').value = prefs.translate;
  }

  const format = FORMATS[prefs.format] ? prefs.format : 'srt';
  document.querySelector(`input[name="format"][value="${format}"]`).checked = true;
  $('timestamps').checked = prefs.timestamps === true;

  $('track').addEventListener('change', updateControls);
  $('formats').addEventListener('change', () => {
    updateControls();
    savePrefs();
  });
  $('translate').addEventListener('change', savePrefs);
  $('timestamps').addEventListener('change', savePrefs);
  $('video').addEventListener('submit', (event) => {
    event.preventDefault();
    run(async () => {
      const output = await buildOutput();
      await saveFile(output);
      return `Saved ${cueCount(output.count)} to “${output.filename}”.`;
    });
  });
  $('copy').addEventListener('click', () =>
    run(async () => {
      const output = await buildOutput();
      await navigator.clipboard.writeText(output.content);
      return `Copied ${cueCount(output.count)} as ${FORMATS[output.format].label}.`;
    }),
  );

  updateControls();
  $('message').hidden = true;
  $('video').hidden = false;
}

/** Uploaded subtitles beat auto-generated ones; the browser's language beats the rest. */
function preferredTrackIndex(tracks) {
  const wanted = baseLanguage(navigator.language || 'en');
  let best = 0;
  let bestScore = -1;
  tracks.forEach((track, index) => {
    const score = (baseLanguage(track.languageCode) === wanted ? 2 : 0) + (track.kind === 'standard' ? 1 : 0);
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

function baseLanguage(code) {
  return String(code).toLowerCase().split('-')[0];
}

function selectedTrack() {
  return state.video.tracks[Number($('track').value)];
}

function selectedFormat() {
  return document.querySelector('input[name="format"]:checked')?.value ?? 'srt';
}

function updateControls() {
  const translatable = selectedTrack().isTranslatable && state.video.translationLanguages.length > 0;
  $('translate').disabled = !translatable;
  $('timestamps-row').hidden = selectedFormat() !== 'txt';
}

async function loadCues(track, tlang) {
  const key = `${track.vssId}|${track.languageCode}|${tlang}`;
  if (!state.cues.has(key)) {
    const pending = callPage('fetchCaptions', {
      videoId: state.video.videoId,
      vssId: track.vssId,
      languageCode: track.languageCode,
      kind: track.kind,
      tlang,
    }).then(({ text }) => parseJson3(text, { rollingWindow: track.kind === 'asr' }));
    state.cues.set(key, pending);
    pending.catch(() => state.cues.delete(key));
  }
  return state.cues.get(key);
}

async function buildOutput() {
  const { video } = state;
  const track = selectedTrack();
  const tlang = $('translate').disabled ? '' : $('translate').value;
  const format = selectedFormat();
  const cues = await loadCues(track, tlang);
  if (!cues.length) throw new Error('This subtitle track is empty.');
  const language = tlang || track.languageCode;
  const content = renderSubtitles(format, cues, {
    timestamps: $('timestamps').checked,
    meta: {
      videoId: video.videoId,
      title: video.title,
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      language,
      kind: track.kind,
      translatedFrom: tlang ? track.languageCode : undefined,
    },
  });
  const filename = buildFilename({
    title: video.title,
    videoId: video.videoId,
    language,
    extension: FORMATS[format].extension,
  });
  return { content, filename, format, count: cues.length };
}

async function saveFile({ content, filename, format }) {
  // A data: URL stays valid if the popup closes while the download starts
  // (for example when a Save As dialog takes focus); a popup-owned blob: URL would not.
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const url = `data:${FORMATS[format].mime};charset=utf-8;base64,${btoa(binary)}`;
  await chrome.downloads.download({ url, filename, conflictAction: 'uniquify' });
}

async function run(task) {
  if (state.busy) return;
  state.busy = true;
  $('download').disabled = true;
  $('copy').disabled = true;
  setStatus('Fetching subtitles…');
  try {
    setStatus(await task(), 'success');
  } catch (error) {
    setStatus(error?.message ?? String(error), 'error');
  } finally {
    state.busy = false;
    $('download').disabled = false;
    $('copy').disabled = false;
  }
}

function cueCount(count) {
  return `${count} ${count === 1 ? 'line' : 'lines'}`;
}

function setStatus(text, tone = '') {
  $('status').textContent = text;
  $('status').className = `status ${tone}`.trim();
}

function showMessage(text, isError = false) {
  $('video').hidden = true;
  $('message').hidden = false;
  $('message').textContent = text;
  $('message').classList.toggle('error', isError);
}

// Remembered per browser profile: format, timestamps and translation target.
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {};
  } catch {
    return {};
  }
}

function savePrefs() {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ format: selectedFormat(), timestamps: $('timestamps').checked, translate: $('translate').value }),
    );
  } catch {
    // Preferences are a convenience; the popup works without them.
  }
}
