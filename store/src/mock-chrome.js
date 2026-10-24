// Stand-ins for the extension APIs and the YouTube page bridge, so the real
// popup can render with invented demo data for store images. Loaded as a
// classic script before popup.js by store/src/demo.html; never packaged.
(() => {
  const LINES = [
    "Today we're building a simple bird feeder from one cedar board.",
    'You only need a saw, a drill, wood glue and a handful of screws.',
    'First, mark the board into six pieces.',
    'Measure twice and cut once — it really does save wood.',
    'Sand every edge so the birds can land without splinters.',
    'Glue the sides to the base and hold them with two screws each.',
    'Leave a small gap at the bottom so the seed can slide out.',
    'The roof overhangs a little to keep the rain off the seed.',
    'Drill a few drainage holes in the base.',
    'Hang it about five feet high, close to a shrub or tree.',
    'Fill it with black sunflower seed and wait a day or two.',
    'Thanks for building along with us!',
  ];
  const CUES = 212;
  const events = Array.from({ length: CUES }, (_, i) => ({
    tStartMs: 1200 + i * 3400,
    dDurationMs: 3100,
    segs: [{ utf8: LINES[i % LINES.length] }],
  }));

  const LANGUAGES = [
    'Afrikaans', 'Arabic', 'Bengali', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Czech', 'Danish', 'Dutch',
    'English', 'Finnish', 'French', 'German', 'Greek', 'Hebrew', 'Hindi', 'Hungarian', 'Indonesian', 'Italian',
    'Japanese', 'Korean', 'Norwegian', 'Polish', 'Portuguese', 'Romanian', 'Russian', 'Spanish', 'Swedish',
    'Thai', 'Turkish', 'Ukrainian', 'Vietnamese',
  ];
  const CODES = {
    German: 'de', French: 'fr', Spanish: 'es', Japanese: 'ja', Hebrew: 'iw', Russian: 'ru', Ukrainian: 'uk',
    'Chinese (Simplified)': 'zh-Hans', 'Chinese (Traditional)': 'zh-Hant', Portuguese: 'pt', Italian: 'it',
  };

  const video = {
    videoId: 'Bf9xK2mQp1A',
    title: 'Build a Backyard Bird Feeder in One Afternoon',
    author: 'Weekend Workshop',
    lengthSeconds: 754,
    source: 'page',
    tracks: [
      { vssId: '.en', languageCode: 'en', name: 'English', kind: 'standard', isTranslatable: true },
      { vssId: 'a.en', languageCode: 'en', name: 'English (auto-generated)', kind: 'asr', isTranslatable: true },
      { vssId: '.es', languageCode: 'es', name: 'Spanish', kind: 'standard', isTranslatable: true },
      { vssId: '.de', languageCode: 'de', name: 'German', kind: 'standard', isTranslatable: true },
    ],
    translationLanguages: LANGUAGES.map((name) => ({
      languageCode: CODES[name] ?? name.slice(0, 2).toLowerCase(),
      name,
    })),
  };

  window.__demoJson3 = { events };
  window.__ytSubtitleDownloader = {
    version: 1,
    getVideoInfo: async () => ({ video }),
    fetchCaptions: async () => ({ text: JSON.stringify(window.__demoJson3), source: 'demo' }),
  };

  const tab = { id: 1, url: `https://www.youtube.com/watch?v=${video.videoId}` };
  window.chrome = {
    tabs: { query: async () => [tab], get: async () => tab },
    scripting: {
      executeScript: async ({ func, args = [], files }) => (files ? [] : [{ result: await func(...args) }]),
    },
    downloads: { download: async () => 1 },
  };
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } });
})();
