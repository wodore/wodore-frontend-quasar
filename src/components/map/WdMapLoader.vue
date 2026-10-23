<script setup lang="ts">
import { useI18n } from 'vue-i18n';

/** The single map-loading splash (owner brief 2026-10, impeccable pass):
 *  the Wodore splash design — bright map-tone paper background
 *  (day-paper #f6f9f7, BOTH themes: the map surface is light in both
 *  lighting conditions, the splash prefigures the map), the charcoal
 *  logo mark with a rotating forest-green ring around it, and the
 *  "wo dore" wordmark below.
 *
 *  Pixel-identical to the static boot shell in index.html so the
 *  shell → loader handover is invisible — ONE loading screen, not two.
 *  Keep both in sync (same SVG paths, same ring geometry, same sizes).
 *
 *  `rendered` flips the splash to its faded-out state (kept in the DOM
 *  for the 250 ms CSS fade; pointer-events pass through immediately).
 */
interface Props {
  rendered?: boolean;
}

withDefaults(defineProps<Props>(), { rendered: false });

const { t } = useI18n();
</script>

<template>
  <div
    class="wd-splash"
    :class="{ 'wd-splash--out': rendered }"
    role="status"
    :aria-label="t('map.loading')"
  >
    <div class="wd-splash__mark">
      <svg class="wd-splash__ring" viewBox="0 0 176 176" aria-hidden="true">
        <circle class="wd-splash__ring-track" cx="88" cy="88" r="80"></circle>
        <circle class="wd-splash__ring-arc" cx="88" cy="88" r="80"></circle>
      </svg>
      <svg class="wd-splash__logo" viewBox="0 0 42 48" aria-hidden="true">
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
  </div>
</template>

<style lang="scss" scoped>
/* Wodore splash — see the component doc above. Values mirror
 * index.html's #wd-boot-shell pixel for pixel (day-paper, 176px ring,
 * 3px stroke, 92px mark, wordmark 2.6rem). */
.wd-splash {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background-color: #f6f9f7; /* day-paper — bright map tone, both themes */
  transition: opacity 0.25s ease-out;
}

.wd-splash--out {
  opacity: 0;
  pointer-events: none;
}

.wd-splash__mark {
  position: relative;
  width: 176px;
  height: 176px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wd-splash__ring {
  position: absolute;
  inset: 0;
  width: 176px;
  height: 176px;
  animation: wd-splash-spin 0.9s linear infinite;
}

.wd-splash__ring-track {
  fill: none;
  stroke: #cdd9d2; /* day-ridge, one step darker for loader legibility */
  stroke-width: 4;
}

.wd-splash__ring-arc {
  fill: none;
  stroke: #346751; /* forest-green */
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 151 352; /* ~30% arc of the 502.7 circumference */
}

.wd-splash__logo {
  height: 110px;
  width: auto;
}

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
}

.wd-splash__wo {
  color: #1c1c1c; /* day-ink */
  font-weight: 500;
}

.wd-splash__dore {
  color: #bfab25; /* meadow-gold — the wordmark's gold half */
  font-weight: 400;
}

@keyframes wd-splash-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wd-splash__ring {
    animation: none;
  }
}
</style>
