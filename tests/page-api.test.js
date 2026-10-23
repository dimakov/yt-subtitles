// Runs extension/page/page-api.js inside a vm context with a fake YouTube
// player, PerformanceObserver and fetch to check the track list mapping and the
// order of the subtitle download strategies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../extension/page/page-api.js', import.meta.url), 'utf8');
const VIDEO_ID = 'abcDEF12345';
const JSON3_BODY = '{"events":[{"tStartMs":0,"dDurationMs":1000,"segs":[{"utf8":"hi"}]}]}';

const signedUrl = (lang, extra = '') =>
  `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&caps=asr&opi=1&exp=xpe&xoaf=5&hl=en&ip=0.0.0.0` +
  `&ipbits=0&expire=9999999999&sparams=ip,ipbits,expire,v,caps,opi,exp,xoaf&signature=SIG&key=yt8&lang=${lang}${extra}`;

const TOKEN_URL =
  `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&signature=SIG&lang=en&kind=asr&fmt=json3` +
  '&potc=1&pot=TOKEN123&c=WEB&cver=2.20261020&xorb=2';

const webResponse = {
  videoDetails: { videoId: VIDEO_ID, title: 'Bird feeder build', author: 'Workshop', lengthSeconds: '754' },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        { baseUrl: signedUrl('en'), name: { simpleText: 'English' }, vssId: '.en', languageCode: 'en', isTranslatable: true },
        {
          baseUrl: signedUrl('en', '&kind=asr'),
          name: { simpleText: 'English (auto-generated)' },
          vssId: 'a.en',
          languageCode: 'en',
          kind: 'asr',
          isTranslatable: true,
        },
      ],
      translationLanguages: [
        { languageCode: 'fr', languageName: { simpleText: 'French' } },
        { languageCode: 'de', languageName: { runs: [{ text: 'German' }] } },
      ],
    },
  },
};

// The ANDROID client omits "kind" and signs URLs that need no PO token.
const androidResponse = {
  videoDetails: { videoId: VIDEO_ID, title: 'Bird feeder build' },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        { baseUrl: `${signedUrl('en')}&client=android`, name: { runs: [{ text: 'English' }] }, vssId: '.en', languageCode: 'en' },
        { baseUrl: `${signedUrl('en')}&client=android&kind=asr`, name: { runs: [{ text: 'English (auto-generated)' }] }, vssId: 'a.en', languageCode: 'en' },
      ],
    },
  },
};

const respond = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
  json: async () => JSON.parse(body),
});

function createPage({ href = `https://www.youtube.com/watch?v=${VIDEO_ID}`, captionsOn = false, ccButton = true, route }) {
  const observers = [];
  class FakePerformanceObserver {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
  }
  const emitResource = (name) => observers.forEach((o) => o.callback({ getEntries: () => [{ name }] }));

  const button = {
    clicks: 0,
    pressed: captionsOn,
    getAttribute(name) {
      return name === 'aria-pressed' ? String(this.pressed) : null;
    },
    click() {
      this.clicks += 1;
      this.pressed = !this.pressed;
      // The real player requests the track (with its PO token) when CC turns on.
      if (this.pressed) emitResource(TOKEN_URL);
    },
  };
  const player = {
    getPlayerResponse: () => webResponse,
    querySelector: (selector) => (ccButton && selector === '.ytp-subtitles-button' ? button : null),
  };
  const requests = [];
  const sandbox = {
    URL,
    AbortSignal,
    setTimeout,
    PerformanceObserver: FakePerformanceObserver,
    location: new URL(href),
    document: {
      getElementById: (id) => (id === 'movie_player' ? player : null),
      querySelectorAll: () => [],
      documentElement: { lang: 'en' },
    },
    fetch: async (url, init = {}) => {
      const request = { url: new URL(String(url), 'https://www.youtube.com'), init };
      requests.push(request);
      return route(request);
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return { api: sandbox.__ytSubtitleDownloader, emitResource, button, requests };
}

// Values created inside the vm have that realm's prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

const isPlayerCall = (request) => request.url.pathname === '/youtubei/v1/player';

test('getVideoInfo maps the page player response', async () => {
  const { api, requests } = createPage({ route: () => respond('', 500) });
  const info = plain(await api.getVideoInfo());
  assert.equal(requests.length, 0);
  assert.deepEqual(info.video, {
    videoId: VIDEO_ID,
    title: 'Bird feeder build',
    author: 'Workshop',
    lengthSeconds: 754,
    source: 'page',
    tracks: [
      { vssId: '.en', languageCode: 'en', name: 'English', kind: 'standard', isTranslatable: true },
      { vssId: 'a.en', languageCode: 'en', name: 'English (auto-generated)', kind: 'asr', isTranslatable: true },
    ],
    translationLanguages: [
      { languageCode: 'fr', name: 'French' },
      { languageCode: 'de', name: 'German' },
    ],
  });
});

test('getVideoInfo recognises Shorts and non-video pages', async () => {
  const shorts = createPage({ href: `https://www.youtube.com/shorts/${VIDEO_ID}`, route: () => respond('', 500) });
  assert.equal(plain(await shorts.api.getVideoInfo()).video.videoId, VIDEO_ID);
  const feed = createPage({ href: 'https://www.youtube.com/feed/subscriptions', route: () => respond('', 500) });
  assert.deepEqual(plain(await feed.api.getVideoInfo()), { reason: 'not-video' });
});

test('a captured player token is merged into the selected track URL', async () => {
  const { api, emitResource, requests } = createPage({
    route: ({ url }) => respond(url.searchParams.get('pot') ? JSON3_BODY : ''),
  });
  emitResource('https://www.youtube.com/youtubei/v1/next'); // unrelated traffic is ignored
  emitResource(TOKEN_URL);

  const result = await api.fetchCaptions({ videoId: VIDEO_ID, vssId: '.en', languageCode: 'en', kind: 'standard' });
  assert.equal(result.source, 'player token');
  assert.equal(result.text, JSON3_BODY);
  assert.equal(requests.length, 1);
  const { url, init } = requests[0];
  assert.equal(url.searchParams.get('pot'), 'TOKEN123');
  assert.equal(url.searchParams.get('c'), 'WEB');
  assert.equal(url.searchParams.get('lang'), 'en');
  assert.equal(url.searchParams.get('kind'), null, 'kind comes from the target track, not the captured request');
  assert.equal(url.searchParams.get('fmt'), 'json3');
  assert.equal(url.searchParams.get('signature'), 'SIG');
  assert.equal(init.credentials, 'same-origin');
  assert.ok(init.signal instanceof AbortSignal, 'requests carry a timeout signal');
});

test('without a token the ANDROID client is used and cookies are not sent', async () => {
  const { api, button, requests } = createPage({
    route: ({ url }) => {
      if (url.pathname === '/youtubei/v1/player') return respond(JSON.stringify(androidResponse));
      return respond(url.searchParams.get('client') === 'android' ? JSON3_BODY : '');
    },
  });
  const result = await api.fetchCaptions({ videoId: VIDEO_ID, vssId: 'a.en', languageCode: 'en', kind: 'asr' });
  assert.equal(result.source, 'ANDROID');
  assert.equal(button.clicks, 0, 'captions are not toggled when Innertube works');
  const [playerCall, timedText] = requests;
  assert.equal(JSON.parse(playerCall.init.body).context.client.clientName, 'ANDROID');
  assert.equal(playerCall.init.credentials, 'omit');
  assert.equal(timedText.url.searchParams.get('kind'), 'asr');
  assert.equal(timedText.init.credentials, 'omit');
});

test('translations ask the player for a fresh token first and restore the CC button', async () => {
  const { api, button, requests } = createPage({
    route: ({ url }) => respond(url.searchParams.get('pot') && url.searchParams.get('tlang') === 'fr' ? JSON3_BODY : ''),
  });
  const result = await api.fetchCaptions({ videoId: VIDEO_ID, vssId: '.en', languageCode: 'en', kind: 'standard', tlang: 'fr' });
  assert.equal(result.source, 'fresh player token');
  assert.equal(button.clicks, 2);
  assert.equal(button.pressed, false);
  assert.ok(!requests.some(isPlayerCall), 'Innertube is not needed');
});

test('captions that were already on are toggled off and on again', async () => {
  const { api, button } = createPage({
    captionsOn: true,
    route: ({ url }) => {
      if (isPlayerCall({ url })) return respond('{}');
      return respond(url.searchParams.get('pot') ? JSON3_BODY : '');
    },
  });
  const result = await api.fetchCaptions({ videoId: VIDEO_ID, vssId: '.en', languageCode: 'en', kind: 'standard' });
  assert.equal(result.source, 'fresh player token');
  assert.equal(button.clicks, 2);
  assert.equal(button.pressed, true);
});

test('reports every failed strategy, including rate limiting', async () => {
  const { api } = createPage({
    ccButton: false,
    route: ({ url }) => respond(isPlayerCall({ url }) ? JSON.stringify(androidResponse) : '', isPlayerCall({ url }) ? 200 : 429),
  });
  await assert.rejects(
    api.fetchCaptions({ videoId: VIDEO_ID, vssId: '.en', languageCode: 'en', kind: 'standard' }),
    (error) => {
      assert.match(error.message, /ANDROID: rate-limited by YouTube \(HTTP 429\)/);
      assert.match(error.message, /IOS: rate-limited by YouTube/);
      assert.match(error.message, /fresh player token: the player did not request captions/);
      return true;
    },
  );
});

test('refuses to fetch when the tab moved on to another video', async () => {
  const { api } = createPage({ route: () => respond(JSON3_BODY) });
  await assert.rejects(
    api.fetchCaptions({ videoId: 'zzzzzzzzzzz', vssId: '.en', languageCode: 'en', kind: 'standard' }),
    /different video/,
  );
});
