<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/** The single map-loading splash — v9 (owner stage spec 2026-10):
 *
 *  THREE stages, all budgets in PAGE TIME (performance.now()):
 *   1. t=0–2s  calm base: green, mono mark, status words (words are
 *      STAGE-1 content — they start at the 600ms mark with the mono
 *      mark, matching the boot shell's CSS cycler, and never wait for
 *      the brand entrance; owner 2026-10-31: keep something moving
 *      from the start — the colored-icon→reveal window was dead air)
 *   2. t=2s   brand entrance (`--in`): wordmark at +0.5s (the color
 *      mark is already in — see colorIn below)
 *   3. t=3s   landscape (`--hills`, entrance + 1s): mountain layers
 *      slide in staggered, then drift forever — ONLY if MapLibre is
 *      not already past its `load` event (map ready ⇒ no new hills)
 *
 *  Early exits: words fade out the moment MapLibre is READY (before
 *  the reveal, owner spec) and never start after it; the reveal
 *  (`--out`) retracts whatever entered.
 *
 *  The boot shell (index.html) mirrors stage 1 (placement, mono mark,
 *  word cycler) — see the sync comment there.
 */
interface Props {
  rendered?: boolean;
  /** MapLibre `load` fired (style + first tiles rendered — the
   * "painting" stage begins). Ends the words and blocks new hills. */
  mapReady?: boolean;
}

const props = withDefaults(defineProps<Props>(), { rendered: false, mapReady: false });

const { t } = useI18n();
const entered = ref(false);
const hillsIn = ref(false);
/** Color-mark crossfade fires INDEPENDENTLY of the 2s entrance — as
 * soon as the splash mounts and the font gate clears (owner: "show
 * colored logo asap if ready, keep fading"). The wordmark and hills
 * still respect the 2s/3s budget. */
const colorIn = ref(false);

/** Stage budgets in PAGE TIME. */
const ENTRANCE_AT_MS = 2000;
const HILLS_AFTER_ENTRANCE_MS = 1000;
const COLOR_DELAY_S = 0; // color starts WITH the entrance (owner: earlier)
/** Plain constant (review n7): never mutated, no reactivity needed —
 * the CSS var only offsets the mono/color crossfade + wordmark delays. */
const logoDelaySec = COLOR_DELAY_S;

// ── Status words (one stage-independent pool, ~20 phrases) ───────────────
// STAGE-1 content (owner spec, re-timed 2026-10-31): they start at the
// 600ms page-time mark — WITH the mono mark, matching the boot shell's
// 600ms CSS cycler — and end the moment MapLibre is ready (fade out
// early, before the reveal) or the splash exits, whichever first.
const WORD_START_AT_MS = 600;
const WORD_INTERVAL_MS = 1900;
const words = computed(() =>
  (t('map.loadingWords') as string)
    .split('~')
    .map(w => w.trim())
    .filter(Boolean)
);
const word = ref('');
let pool: string[] = [];
const pickNext = () => {
  if (words.value.length === 0) return;
  if (pool.length === 0) pool = [...words.value];
  const at = Math.floor(Math.random() * pool.length);
  word.value = pool.splice(at, 1)[0] ?? '';
};
let wordTimer: ReturnType<typeof setInterval> | undefined;
let wordDelayTimer: ReturnType<typeof setTimeout> | undefined;
let hillsTimer: ReturnType<typeof setTimeout> | undefined;
/** Review n1: the 2s entrance timer + a disposed flag so NO async
 * callback (font-gate promise, rAF, hills timer) writes a ref after
 * unmount — the dispose contract holds for every reveal side effect. */
let entranceTimer: number | undefined;
let disposed = false;
const stopWords = () => {
  if (wordTimer !== undefined) {
    clearInterval(wordTimer);
    wordTimer = undefined;
  }
  if (wordDelayTimer !== undefined) {
    clearTimeout(wordDelayTimer);
    wordDelayTimer = undefined;
  }
};
watch(words, () => {
  pool = [];
  if (wordTimer !== undefined) pickNext();
});
// Reveal exits everything: stop the words (the current one fades with
// the splash) and cancel pending hills.
watch(
  () => props.rendered,
  done => {
    if (!done) return;
    stopWords();
    if (hillsTimer !== undefined) {
      clearTimeout(hillsTimer);
      hillsTimer = undefined;
    }
  }
);
// MapLibre READY (pre-reveal): words keep cycling — since the
// progressive reveal (owner 2026-10-31) the splash routinely outlives
// mapReady by the basemap paint wait, and killing the words there
// re-created the dead-air window the words exist to fill. Only new
// hills are blocked — a ready map only needs its paint time, not the
// full show.
watch(
  () => props.mapReady,
  ready => {
    if (!ready) return;
    if (hillsTimer !== undefined && !hillsIn.value) {
      clearTimeout(hillsTimer);
      hillsTimer = undefined;
    }
  }
);

onMounted(() => {
  // FONT GATE (owner: "wordmark needs the font loaded"): the entrance
  // waits (max 500ms) for Barlow Semi Condensed 500 — the wordmark and
  // the status words must never render in a fallback font (the
  // Fontsource CSS is part of the bundle; on slow nets the woff2 can
  // land after the CSS, which would font-swap mid-show).
  const fontsReady = Promise.race([
    document.fonts.load('500 2.6rem "Barlow Semi Condensed"').catch(() => {
      /* fonts API unavailable — proceed on the timeout */
    }),
    new Promise<void>(resolve => {
      window.setTimeout(resolve, 500);
    }),
  ]);
  // COLOR MARK — asap once fonts are ready (owner spec): independent
  // of the 2s entrance budget, so warm boots show the brand color in
  // the first ~500ms instead of holding the mono mark until 2s.
  void fontsReady.then(() => {
    requestAnimationFrame(() => {
      if (disposed) return; // review n1: no post-unmount ref writes
      colorIn.value = true;
    });
  });
  // Stage 2 — brand entrance (wordmark) at the 2s PAGE-TIME budget (a
  // slow JS boot already consumed it and enters immediately).
  const entranceDelay = Math.max(0, ENTRANCE_AT_MS - window.performance.now());
  entranceTimer = window.setTimeout(() => {
    void fontsReady.then(() => {
      if (disposed) return; // review n1: unmount during the entrance wait
      requestAnimationFrame(() => {
        entered.value = true;
      });
      // Stage 3 — hills at entrance + 1s (≥3s page time on a fast boot),
      // 0.4s stagger per layer, only while MapLibre is not ready yet
      // (owner: a ready map in its painting stage must not START hills).
      hillsTimer = setTimeout(() => {
        hillsTimer = undefined;
        if (props.mapReady || props.rendered) return;
        hillsIn.value = true;
      }, HILLS_AFTER_ENTRANCE_MS);
    });
  }, entranceDelay);
  // Stage 1 words — same 600ms page-time budget as the boot shell cycler.
  wordDelayTimer = setTimeout(
    () => {
      wordDelayTimer = undefined;
      if (props.rendered) return; // already past — never start
      pickNext();
      wordTimer = setInterval(pickNext, WORD_INTERVAL_MS);
    },
    Math.max(0, WORD_START_AT_MS - window.performance.now())
  );
});
onBeforeUnmount(() => {
  disposed = true; // review n1: async callbacks must not run past unmount
  stopWords();
  if (hillsTimer !== undefined) clearTimeout(hillsTimer);
  if (entranceTimer !== undefined) clearTimeout(entranceTimer);
});
</script>

<template>
  <div
    class="wd-splash"
    :class="{
      'wd-splash--out': rendered,
      'wd-splash--in': entered,
      'wd-splash--color': colorIn,
      'wd-splash--hills': hillsIn,
      'wd-splash--map-ready': mapReady,
    }"
    :style="{ '--wd-logo-delay': `${logoDelaySec}s` }"
    role="status"
    :aria-label="t('map.loading')"
  >
    <svg
      class="wd-splash__mtns"
      viewBox="0 0 1000 500"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g class="wd-splash__mtn-wrap" data-i="0">
        <path
          class="wd-splash__mtn"
          style="fill: #5d9c7b"
          d="M-200,500 L-200,312 C-186.7,311.3 -146.7,309.3 -120,308 C-93.3,306.7 -66.7,305.3 -40,304 C-13.3,302.7 13.3,301.5 40,300 C66.7,298.5 93.3,296.7 120,295 C146.7,293.3 173.3,291.8 200,290 C226.7,288.2 253.3,286.3 280,284 C306.7,281.7 335,279 360,276 C385,273 410,270 430,266 C450,262 463.3,257.3 480,252 C496.7,246.7 515,239.7 530,234 C545,228.3 556.7,223 570,218 C583.3,213 596.7,207.8 610,204 C623.3,200.2 636.7,197.3 650,195 C663.3,192.7 676.7,190.3 690,190 C703.3,189.7 716.7,191 730,193 C743.3,195 756.7,198.2 770,202 C783.3,205.8 796.7,210.7 810,216 C823.3,221.3 836.7,227.7 850,234 C863.3,240.3 876.7,247.7 890,254 C903.3,260.3 916.7,266.7 930,272 C943.3,277.3 956.7,282 970,286 C983.3,290 995,293.2 1010,296 C1025,298.8 1041.7,301.2 1060,303 C1078.3,304.8 1096.7,305.8 1120,307 C1143.3,308.2 1186.7,309.5 1200,310 L1200,500 Z"
        ></path>
      </g>
      <g class="wd-splash__mtn-wrap" data-i="1">
        <path
          class="wd-splash__mtn"
          style="fill: #4a8a68"
          d="M-200,500 L-200,302 C-186.7,301.3 -146.7,299.3 -120,298 C-93.3,296.7 -66.7,295.3 -40,294 C-13.3,292.7 13.3,291.7 40,290 C66.7,288.3 93.3,286.3 120,284 C146.7,281.7 175,279 200,276 C225,273 248.3,270 270,266 C291.7,262 311.7,256.7 330,252 C348.3,247.3 365,243 380,238 C395,233 408.3,227.5 420,222 C431.7,216.5 440,210.3 450,205 C460,199.7 470,194.5 480,190 C490,185.5 500,181 510,178 C520,175 530,172.7 540,172 C550,171.3 560,172.3 570,174 C580,175.7 588.3,178.3 600,182 C611.7,185.7 626.7,190.7 640,196 C653.3,201.3 666.7,207.7 680,214 C693.3,220.3 706.7,227.3 720,234 C733.3,240.7 746.7,247.7 760,254 C773.3,260.3 786.7,266.7 800,272 C813.3,277.3 826.7,282 840,286 C853.3,290 865,293 880,296 C895,299 911.7,301.7 930,304 C948.3,306.3 968.3,308.5 990,310 C1011.7,311.5 1036.7,312.7 1060,313 C1083.3,313.3 1106.7,312.5 1130,312 C1153.3,311.5 1188.3,310.3 1200,310 L1200,500 Z"
        ></path>
      </g>
      <g class="wd-splash__mtn-wrap" data-i="2">
        <path
          class="wd-splash__mtn"
          style="fill: #3a7557"
          d="M-200,500 L-200,272 C-188.3,271.3 -153.3,270.8 -130,268 C-106.7,265.2 -81.7,259.7 -60,255 C-38.3,250.3 -20,245.5 0,240 C20,234.5 40,228.3 60,222 C80,215.7 100,209.3 120,202 C140,194.7 161.7,185.8 180,178 C198.3,170.2 215,161.3 230,155 C245,148.7 258.3,143.2 270,140 C281.7,136.8 290,135.7 300,136 C310,136.3 318.3,138.7 330,142 C341.7,145.3 356.7,150.5 370,156 C383.3,161.5 396.7,168.2 410,175 C423.3,181.8 436.7,189.5 450,197 C463.3,204.5 476.7,212.5 490,220 C503.3,227.5 516.7,235.2 530,242 C543.3,248.8 556.7,255.5 570,261 C583.3,266.5 596.7,271 610,275 C623.3,279 636.7,282.3 650,285 C663.3,287.7 676.7,289.7 690,291 C703.3,292.3 716.7,293 730,293 C743.3,293 756.7,292.5 770,291 C783.3,289.5 796.7,287.5 810,284 C823.3,280.5 836.7,275.3 850,270 C863.3,264.7 876.7,258.5 890,252 C903.3,245.5 916.7,238 930,231 C943.3,224 956.7,216.5 970,210 C983.3,203.5 996.7,197 1010,192 C1023.3,187 1036.7,182.8 1050,180 C1063.3,177.2 1076.7,175.3 1090,175 C1103.3,174.7 1116.7,176.2 1130,178 C1143.3,179.8 1158.3,183.3 1170,186 C1181.7,188.7 1195,192.7 1200,194 L1200,500 Z"
        ></path>
      </g>
      <g class="wd-splash__mtn-wrap" data-i="3">
        <path
          class="wd-splash__mtn"
          style="fill: #2b6148"
          d="M-200,500 L-200,195 C-190,194.2 -160,193.8 -140,190 C-120,186.2 -96.7,180.7 -80,172 C-63.3,163.3 -53.3,152 -40,138 C-26.7,124 -13.3,104.3 0,88 C13.3,71.7 26.7,52.3 40,40 C53.3,27.7 66.7,15.7 80,14 C93.3,12.3 106.7,21 120,30 C133.3,39 146.7,54.3 160,68 C173.3,81.7 186.7,98 200,112 C213.3,126 226.7,140 240,152 C253.3,164 266.7,174.3 280,184 C293.3,193.7 306.7,202 320,210 C333.3,218 346.7,225.3 360,232 C373.3,238.7 386.7,244.7 400,250 C413.3,255.3 426.7,260.3 440,264 C453.3,267.7 466.7,270 480,272 C493.3,274 506.7,275.3 520,276 C533.3,276.7 546.7,276.7 560,276 C573.3,275.3 586.7,273.7 600,272 C613.3,270.3 626.7,268 640,266 C653.3,264 666.7,261.7 680,260 C693.3,258.3 706.7,256.7 720,256 C733.3,255.3 746.7,255.3 760,256 C773.3,256.7 786.7,258.3 800,260 C813.3,261.7 826.7,264 840,266 C853.3,268 866.7,270.3 880,272 C893.3,273.7 906.7,275.3 920,276 C933.3,276.7 946.7,277 960,276 C973.3,275 986.7,273 1000,270 C1013.3,267 1026.7,262.7 1040,258 C1053.3,253.3 1066.7,247.7 1080,242 C1093.3,236.3 1106.7,229.7 1120,224 C1133.3,218.3 1146.7,212 1160,208 C1173.3,204 1193.3,201.3 1200,200 L1200,500 Z"
        ></path>
      </g>
    </svg>
    <div class="wd-splash__mark">
      <svg class="wd-splash__logo wd-splash__logo--mono" viewBox="0 0 42 48" aria-hidden="true">
        <g>
          <g>
            <path
              d="m25.496 1.5682c1.238 15.516 0.67832 29.751-0.0086 44.683-0.0405 0.88045-0.77447 1.4539-1.6342 1.2589-0.65173-0.14784-1.3169-0.31143-1.5742-0.4162-0.80751-0.32881-2.3816-0.39391-3.379-0.39942-0.49706-0.0027-0.88336-0.39169-0.86399-0.88859 0.59872-15.359 0.5934-34.915 0.05341-43.541-0.04376-0.69897 0.46832-1.3735 1.1604-1.4822 1.6628-0.26116 3.3252-0.40795 4.987-0.40308 0.64271 0.001883 1.208 0.54782 1.2591 1.1885z"
              fill="#1c1c1c"
              style="paint-order: normal"
            />
          </g>
          <g>
            <path
              d="m9.596 24.165c-0.79278-0.047106-1.5718 0.22267-2.1656 0.74998l-6.0135 5.3395c-0.51226 0.45485-0.55886 1.2388-0.10408 1.7512l5.3398 6.0156c0.52721 0.59393 1.2688 0.95405 2.0616 1.0011l19.811 1.1777c0.68373 0.04084 1.271-0.48049 1.3116-1.1642l0.73486-12.384c0.04058-0.68383-0.48086-1.2711-1.1647-1.3117l-1.9691-0.11696z"
              fill="#1c1c1c"
            />
          </g>
          <g>
            <path
              d="m33.315 19.769c0.7926-0.05028 1.5328-0.41331 2.0578-1.0092l5.3177-6.0361c0.45279-0.51396 0.40307-1.2977-0.11104-1.7503l-6.038-5.3159c-0.5961-0.5248-1.3762-0.7914-2.1688-0.74116l-5.4363 0.34456-9.8936 0.62696-4.4746 0.28385c-0.68365 0.043369-1.2027 0.63273-1.1593 1.3164l0.78532 12.379c0.04336 0.68361 0.63276 1.2026 1.3164 1.1591"
              fill="#1c1c1c"
            />
          </g>
        </g>
      </svg>
      <svg class="wd-splash__logo wd-splash__logo--color" viewBox="0 0 42 48" aria-hidden="true">
        <g>
          <g>
            <path
              d="m25.496 1.5682c1.238 15.516 0.67832 29.751-0.0086 44.683-0.0405 0.88045-0.77447 1.4539-1.6342 1.2589-0.65173-0.14784-1.3169-0.31143-1.5742-0.4162-0.80751-0.32881-2.3816-0.39391-3.379-0.39942-0.49706-0.0027-0.88336-0.39169-0.86399-0.88859 0.59872-15.359 0.5934-34.915 0.05341-43.541-0.04376-0.69897 0.46832-1.3735 1.1604-1.4822 1.6628-0.26116 3.3252-0.40795 4.987-0.40308 0.64271 0.001883 1.208 0.54782 1.2591 1.1885z"
              fill="#1c1c1c"
              style="paint-order: normal"
            />
            <path
              d="m19.25 0.78277c-0.69212 0.1087-1.2039 0.78345-1.1602 1.4824 0.53999 8.6257 0.54403 28.182-0.05469 43.541-0.01937 0.4969 0.36818 0.88593 0.86523 0.88867 0.4119 0.0023 1.0058-0.04987 2.4641 0.1657 0.05368-1.6605-1.0429-1.1857-1.0456-2.1303-0.0023-0.79261 0.12778-3.0529 0.16297-5.0217 0.07039-3.9375 0.26417-12.515 0.28149-16.365s-0.44407-12.677-0.53463-17.494c-0.045281-2.4082-0.5087-3.5717 0.033543-4.0171 0.32561-0.26741 0.43176-0.87833 0.42484-1.2467-0.42457 0.056097-1.0996 0.14335-1.4371 0.19635z"
              fill="#9c9c9c"
              fill-opacity=".082404"
              style="mix-blend-mode: lighten"
            />
          </g>
          <g>
            <path
              d="m9.596 24.165c-0.79278-0.047106-1.5718 0.22267-2.1656 0.74998l-6.0135 5.3395c-0.51226 0.45485-0.55886 1.2388-0.10408 1.7512l5.3398 6.0156c0.52721 0.59393 1.2688 0.95405 2.0616 1.0011l19.811 1.1777c0.68373 0.04084 1.271-0.48049 1.3116-1.1642l0.73486-12.384c0.04058-0.68383-0.48086-1.2711-1.1647-1.3117l-1.9691-0.11696z"
              fill="#1c1c1c"
            />
            <path
              transform="matrix(-1.2306 -.155 .155 -1.2306 44.027 51.899)"
              d="m15.399 9.3598 13.656-0.8245a2.3876 2.3876 19.27 0 1 1.7414 0.60881l2.6372 2.3742a1.027 1.027 86.232 0 1 0.09417 1.4298l-2.582 3.0266a2.3487 2.3487 153.53 0 1-1.6473 0.82019l-13.295 0.79142a1.0139 1.0139 41.197 0 1-1.0715-0.93789l-0.45762-6.2311a0.98708 0.98708 131.17 0 1 0.92494-1.0576z"
              fill="#408c6b"
              style="paint-order: stroke fill markers"
            />
            <path
              transform="matrix(-1.2306 -.155 .155 -1.2306 44.027 51.899)"
              d="m29.299 16.795c0.6372-0.0383 1.2314-0.33432 1.6457-0.81991l2.5835-3.0267c0.36174-0.42363 0.31981-1.0584-0.09451-1.4308-0.50537-0.01217-1.3428 1.481-2.7628 2.9409-0.60344 0.62036-1.8592 1.1326-2.7197 1.2325l-6.0717 0.70466a2.1202 2.1202 158.06 0 0-1.0391 0.41852l-0.69065 0.5253z"
              fill="#fff"
              fill-opacity=".04"
              style="mix-blend-mode: lighten; paint-order: stroke fill markers"
            />
            <path
              d="m26.365 27.73-0.58868 5.0583a3.3552 3.3552 0 0 1-3.3916 2.9652l-15.172-0.2689 0.33431 0.38761a2.9614 2.9614 0 0 0 2.0471 1.0199l16.934 1.1023a1.2243 1.2243 0 0 0 1.3033-1.158l0.40214-7.74a1.2576 1.2576 0 0 0-1.1725-1.3203z"
              fill="#0f0f0f"
              fill-opacity=".18039"
              style="mix-blend-mode: overlay; paint-order: stroke fill markers"
            />
          </g>
          <g>
            <path
              d="m33.315 19.769c0.7926-0.05028 1.5328-0.41331 2.0578-1.0092l5.3177-6.0361c0.45279-0.51396 0.40307-1.2977-0.11104-1.7503l-6.038-5.3159c-0.5961-0.5248-1.3762-0.7914-2.1688-0.74116l-5.4363 0.34456-9.8936 0.62696-4.4746 0.28385c-0.68365 0.043369-1.2027 0.63273-1.1593 1.3164l0.78532 12.379c0.04336 0.68361 0.63276 1.2026 1.3164 1.1591"
              fill="#1c1c1c"
            />
            <path
              transform="matrix(1.2403 0 0 1.2403 -4.3022 -3.418)"
              d="m15.752 9.6948 13.557-0.86452a2.4101 2.4101 18.886 0 1 1.7479 0.59793l2.6318 2.3219a1.0122 1.0122 86.074 0 1 0.09742 1.4194l-2.5498 2.9615a2.3866 2.3866 153.46 0 1-1.6503 0.82419l-13.284 0.88352a1.001 1.001 41.167 0 1-1.0651-0.93137l-0.41515-6.1512a0.9963 0.9963 131.25 0 1 0.93064-1.0614z"
              fill="#2a5b46"
              style="paint-order: stroke fill markers"
            />
            <path
              d="m30.497 7.6342-15.262 0.97266c-0.68286 0.043554-1.2003 0.63371-1.1543 1.3164l0.35156 5.2031a1.7119 1.7119 120.88 0 0 0.79581-1.3307l0.14233-1.4633a2.5076 2.5076 134 0 1 2.1662-2.2431l11.387-1.5101a2.05 2.05 154.82 0 0 1.1236-0.5283z"
              fill="#fff"
              fill-opacity=".04"
              style="mix-blend-mode: lighten; paint-order: stroke fill markers"
            />
            <path
              d="m37.506 11.18-3.4715 3.1663a5.6898 5.6898 0 0 1-3.4836 1.4753l-16.006 0.98113 0.05088 0.75099a1.2416 1.2416 0 0 0 1.3203 1.1556l16.478-1.0974a2.9602 2.9602 0 0 0 2.0471-1.0223l3.1614-3.6726a1.2554 1.2554 0 0 0-0.0969-1.737z"
              fill="#0f0f0f"
              fill-opacity=".18026"
              style="mix-blend-mode: overlay; paint-order: stroke fill markers"
            />
          </g>
        </g>
      </svg>
    </div>
    <div class="wd-splash__wordmark">
      <span class="wd-splash__wo">wo</span><span class="wd-splash__dore">dore</span>
    </div>
    <Transition name="wd-splash-word" mode="out-in">
      <div :key="word" class="wd-splash__status">
        {{ word }}
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
/* Surface: forest-green tonal wash (both themes — the splash prefigures
 * the reveal moment; the map is light in both lighting conditions). */
.wd-splash {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Desktop: group sits slightly ABOVE center (owner: "a bit more up,
     not as high as mobile") — 44% of viewport HEIGHT (vh: percentage
     padding resolves against WIDTH — caught live in verification). */
  justify-content: flex-start;
  padding-top: calc(44vh - 121px);
  gap: 12px;
  background: linear-gradient(180deg, #346751 0%, #2b5844 58%, #224e3b 100%);
  /* Exit budget (~900ms reveal, splash clears last): the surface
     starts clearing only once the map is fully opaque (320ms — the
     map's opacity ramp; two half-transparent layers stacked would let
     the white page bleed through) and is gone by ~900ms, as the map's
     blur resolves. */
  transition: opacity 0.58s ease-out 0.32s;
}

.wd-splash--out {
  opacity: 0;
  pointer-events: none;
}

/* ── Mountain silhouettes: bottom-anchored, full width ────────────────── */
/* preserveAspectRatio="none": the silhouettes stretch to ALWAYS fill the
 * container (full width, full height, peaks never cropped — "slice"
 * cropped the peaks on wide viewports, owner-reported). The drift bleed
 * is safe: the paths extend to -200..1200 viewBox units = 20% of the
 * width on each side, far beyond the ±34px drift. */
.wd-splash__mtns {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 62%;
  overflow: hidden;
  transition: opacity 0.3s ease-out;
}

.wd-splash--out .wd-splash__mtns {
  opacity: 0;
}

/* wrap = slide-in from bottom (entrance); path = endless parallax drift */
.wd-splash__mtn-wrap {
  opacity: 0;
  transform: translateY(64px);
  transition:
    opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
}

.wd-splash--hills .wd-splash__mtn-wrap[data-i='0'] {
  opacity: 1;
  transform: none;
  transition-delay: 0s;
}

.wd-splash--hills .wd-splash__mtn-wrap[data-i='1'] {
  opacity: 1;
  transform: none;
  transition-delay: 0.4s;
}

.wd-splash--hills .wd-splash__mtn-wrap[data-i='2'] {
  opacity: 1;
  transform: none;
  transition-delay: 0.8s;
}

.wd-splash--hills .wd-splash__mtn-wrap[data-i='3'] {
  opacity: 1;
  transform: none;
  transition-delay: 1.2s;
}

/* Reveal interrupting the entrance: wraps RETRACT (down + fade over
   300ms, matching the layer fade) instead of popping to full — and a
   still-pending entrance (delay not yet elapsed) is re-targeted to the
   base state, so those layers simply never become visible.
   SPECIFICITY CONTRACT (review n4): this rule (0,3,0 — three classes)
   is EXACTLY EQUAL in specificity to the entrance rules
   `.wd-splash--hills .wd-splash__mtn-wrap[data-i='N']` (0,3,0 — two
   classes + one attribute selector, which weighs the same as a class).
   It wins ONLY by source order, so it MUST stay declared after them
   to cover the mid-entrance interrupt — do not move it above. */
.wd-splash.wd-splash--out .wd-splash__mtn-wrap {
  opacity: 0;
  transform: translateY(64px);
  transition:
    opacity 0.3s ease-out,
    transform 0.3s ease-out;
}

.wd-splash__mtn {
  stroke: none;
  animation: wd-splash-mtn-drift 12s ease-in-out infinite alternate;
}

/* Per-layer parallax: data-i lives on the WRAP (g) — target the path
 * through it (the old `.wd-splash__mtn[data-i=…]` selectors matched
 * nothing: every layer drifted at the same 30s). Amplitude ±56px on
 * 22–40s cycles: slow, but clearly perceptible (the earlier ±34px on
 * 30–54s read as "not moving"). */
.wd-splash__mtn-wrap[data-i='1'] .wd-splash__mtn {
  animation-duration: 15s;
  animation-delay: -6s;
}

.wd-splash__mtn-wrap[data-i='2'] .wd-splash__mtn {
  animation-duration: 18s;
  animation-delay: -11s;
  animation-direction: alternate-reverse;
}

.wd-splash__mtn-wrap[data-i='3'] .wd-splash__mtn {
  animation-duration: 22s;
  animation-delay: -3s;
}

@keyframes wd-splash-mtn-drift {
  from {
    transform: translateX(-60px);
  }
  to {
    transform: translateX(60px);
  }
}

/* ── Mark: mono → color cross-fade (no movement) ───────────────────────── */
.wd-splash__mark {
  position: relative;
  width: 100%;
  height: 176px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity 0.45s ease-in,
    transform 0.45s ease-in;
}

.wd-splash--out .wd-splash__mark {
  opacity: 0;
  transform: translateY(48px);
}

@media (prefers-reduced-motion: reduce) {
  .wd-splash--out .wd-splash__mark {
    transform: none;
  }
}

.wd-splash__logo {
  position: absolute;
  height: 110px;
  width: auto;
  /* Pre-promote both crossfade layers: the color SVG's large path data
     can jank its first paint mid-fade (owner-reported flicker just
     before the colored logo appears) — will-change composites the
     layers ahead of the transition. */
  will-change: opacity;
}

/* mono: fades OUT as the colored mark fades in (pure cross-fade) */
.wd-splash__logo--mono {
  opacity: 1;
  transition: opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1) var(--wd-logo-delay, 0s);
}

.wd-splash--color .wd-splash__logo--mono {
  opacity: 0;
}

/* Charcoal ink = the color mark's stroke color: the crossfade only
   fades in the green fills — the dark strokes never jump. */
.wd-splash__logo--mono :deep(path) {
  fill: #1c1c1c;
}

/* color: fades in over the boot mark, 800ms after the adaptive delay */
.wd-splash__logo--color {
  opacity: 0;
  transition: opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1) var(--wd-logo-delay, 0s);
}

.wd-splash--color .wd-splash__logo--color {
  opacity: 1;
}

/* ── Wordmark: rises in at t≈1.5s ────────────────────────────────────── */
.wd-splash__wordmark {
  font-family:
    'Barlow Semi Condensed',
    'Barlow',
    -apple-system,
    'Helvetica Neue',
    sans-serif;
  font-size: 2.6rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1;
  height: 42px; /* fixed box: the mark never shifts when the wordmark enters */
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1) calc(var(--wd-logo-delay, 0.2s) + 0.3s),
    transform 0.4s cubic-bezier(0.25, 1, 0.5, 1) calc(var(--wd-logo-delay, 0.2s) + 0.3s);
}

.wd-splash--in .wd-splash__wordmark {
  opacity: 1;
  transform: translateY(0);
}

.wd-splash--out .wd-splash__wordmark {
  opacity: 0;
  transform: translateY(48px);
  transition:
    opacity 0.45s ease-in,
    transform 0.45s ease-in;
}

.wd-splash__wo {
  color: #f2f7f4;
  font-weight: 500;
}

.wd-splash__dore {
  color: #bfab25; /* meadow-gold = $accent — same gold as the app logo
     wordmark (WodoreLogo text-accent); 3.5:1 on the green surface,
     AA-large for display text (owner: match the other logos) */
  font-weight: 400;
}

/* ── Status words: cycle during the whole splash ───────────────────────── */
.wd-splash__status {
  position: absolute;
  /* Desktop: tracks the 44vh group anchor (wordmark bottom + 14px).
     Mobile overrides in the media query below. */
  top: calc(44vh + 121px + 14px);
  font-family:
    'Barlow Semi Condensed',
    'Barlow',
    -apple-system,
    'Helvetica Neue',
    sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(242, 247, 244, 0.78);
}

/* Word swap: blur-crystallize (UX advisor) — the readout refreshes IN
 * PLACE like a gauge display; the old word snaps away (ease-in), the
 * new one resolves into focus on the system curve. No spatial travel.
 * Fancy pass (owner): a whisper of scale — out-word expands 1.04 as it
 * dissolves, in-word settles from 0.96 — still compositor-only. */
.wd-splash-word-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.5, 0, 1, 0.5),
    filter 0.18s cubic-bezier(0.5, 0, 1, 0.5),
    transform 0.18s cubic-bezier(0.5, 0, 1, 0.5);
}

.wd-splash-word-leave-to {
  opacity: 0;
  filter: blur(2px);
  transform: scale(1.04);
}

.wd-splash-word-enter-active {
  transition:
    opacity 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    filter 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.wd-splash-word-enter-from {
  opacity: 0;
  filter: blur(2px);
  transform: scale(0.96);
}

/* Words run until the REVEAL (owner 2026-10-31): since the progressive
 * reveal the splash routinely outlives MapLibre's `load` (the basemap
 * paint wait), and fading words at map-ready re-created the dead-air
 * window the words exist to fill — they end with the splash exit
 * (.wd-splash--out retracts everything). */

@media (prefers-reduced-motion: reduce) {
  .wd-splash__mtn,
  .wd-splash__mtn-wrap {
    animation: none;
  }
  /* One-shot entrance/exit displacements are removed as well (WCAG
     SC 2.3.3: remove, don't just shorten) — review finding. */
  .wd-splash--in .wd-splash__mtn-wrap,
  .wd-splash--hills .wd-splash__mtn-wrap,
  .wd-splash--in .wd-splash__wordmark,
  .wd-splash--out .wd-splash__wordmark {
    transform: none;
  }
  /* The 10px wordmark rise would still ANIMATE (only the end state is
     overridden above) — drop the transform transition itself so it
     snaps (review n1). */
  .wd-splash__wordmark {
    transition: opacity 0.4s ease;
  }
  .wd-splash-word-enter-from,
  .wd-splash-word-leave-to {
    filter: none;
    transform: none;
  }
  .wd-splash-word-enter-active,
  .wd-splash-word-leave-active {
    transition: opacity 0.2s ease;
  }
}

/* Mobile placement (owner: "move logo and text up, middle at 2/3" —
 * group center at 1/3 from top, just above the hill crests; UX advisor
 * geometry: group 176+24+42=242px, half=121px). Desktop stays
 * centered. */
@media (max-width: 600px) {
  .wd-splash {
    justify-content: flex-start;
    /* Mobile: group center at 30vh (owner: a bit more up than the
     previous 33vh) */
    padding-top: calc(30vh - 121px);
  }

  .wd-splash__status {
    bottom: auto;
    top: calc(30vh + 121px + 14px);
  }
}
</style>
