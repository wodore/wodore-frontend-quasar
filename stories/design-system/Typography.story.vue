<script setup lang="ts">
import { ref, defineOptions } from 'vue';

defineOptions({
  name: 'TypographyStory',
});

const sampleText = ref('The quick brown fox jumps over the lazy dog');
const longText = ref(
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.'
);
</script>

<template>
  <Story title="Design System/Typography" :layout="{ type: 'single', iframe: false }">
    <Variant title="Headings" id="headings">
      <div class="bg-white q-pa-md">
        <div class="q-mb-md">
          <div class="text-h1">Heading 1</div>
          <div class="text-caption text-grey-7">
            .text-h1 • Font size: 6rem (96px) • Weight: 300 • Line height: 6rem
          </div>
        </div>

        <div class="q-mb-md">
          <div class="text-h2">Heading 2</div>
          <div class="text-caption text-grey-7">
            .text-h2 • Font size: 3.75rem (60px) • Weight: 300 • Line height: 3.75rem
          </div>
        </div>

        <div class="q-mb-md">
          <div class="text-h3">Heading 3</div>
          <div class="text-caption text-grey-7">
            .text-h3 • Font size: 3rem (48px) • Weight: 400 • Line height: 3.125rem
          </div>
        </div>

        <div class="q-mb-md">
          <div class="text-h4">Heading 4</div>
          <div class="text-caption text-grey-7">
            .text-h4 • Font size: 2.125rem (34px) • Weight: 400 • Line height: 2.5rem
          </div>
        </div>

        <div class="q-mb-md">
          <div class="text-h5">Heading 5</div>
          <div class="text-caption text-grey-7">
            .text-h5 • Font size: 1.5rem (24px) • Weight: 400 • Line height: 2rem
          </div>
        </div>

        <div class="q-mb-md">
          <div class="text-h6">Heading 6</div>
          <div class="text-caption text-grey-7">
            .text-h6 • Font size: 1.25rem (20px) • Weight: 500 • Line height: 2rem
          </div>
        </div>

        <q-separator class="q-my-lg" />

        <div class="q-mb-md">
          <div class="text-subtitle1">Subtitle 1</div>
          <div class="text-caption text-grey-7">
            .text-subtitle1 • Font size: 1rem (16px) • Weight: 400 • Line height: 1.75rem • Letter
            spacing: 0.009375em
          </div>
        </div>

        <div class="q-mb-md">
          <div class="text-subtitle2">Subtitle 2</div>
          <div class="text-caption text-grey-7">
            .text-subtitle2 • Font size: 0.875rem (14px) • Weight: 500 • Line height: 1.375rem •
            Letter spacing: 0.0071428571em
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Body Text" id="body">
      <div class="bg-white q-pa-md">
        <div class="q-mb-md">
          <div class="text-body1">{{ longText }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            .text-body1 • Font size: 1rem (16px) • Weight: 400 • Line height: 1.5rem • Letter
            spacing: 0.03125em
          </div>
        </div>

        <q-separator class="q-my-md" />

        <div class="q-mb-md">
          <div class="text-body2">{{ longText }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            .text-body2 • Font size: 0.875rem (14px) • Weight: 400 • Line height: 1.25rem • Letter
            spacing: 0.0178571429em
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Special Styles" id="special">
      <div class="bg-white q-pa-md">
        <div class="q-mb-md">
          <div class="text-overline">OVERLINE TEXT</div>
          <div class="text-caption text-grey-7">
            .text-overline • Font size: 0.75rem (12px) • Weight: 400 • Line height: 2rem • Letter
            spacing: 0.1666666667em • Transform: uppercase
          </div>
        </div>

        <q-separator class="q-my-md" />

        <div class="q-mb-md">
          <div class="text-caption">Caption text - typically for image captions or hints</div>
          <div class="text-caption text-grey-7">
            .text-caption • Font size: 0.75rem (12px) • Weight: 400 • Line height: 1.25rem • Letter
            spacing: 0.0333333333em
          </div>
        </div>

        <q-separator class="q-my-md" />

        <div class="q-mb-md">
          <button class="text-button">BUTTON TEXT</button>
          <div class="text-caption text-grey-7 q-mt-sm">
            .text-button • Font size: 0.875rem (14px) • Weight: 500 • Line height: 2.25rem • Letter
            spacing: 0.0892857143em • Transform: uppercase
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Text Weights" id="weights">
      <div class="bg-white q-pa-md">
        <div class="q-mb-sm text-weight-thin">Thin (100)</div>
        <div class="q-mb-sm text-weight-light">Light (300)</div>
        <div class="q-mb-sm text-weight-regular">Regular (400)</div>
        <div class="q-mb-sm text-weight-medium">Medium (500)</div>
        <div class="q-mb-sm text-weight-bold">Bold (700)</div>
        <div class="q-mb-sm text-weight-bolder">Bolder (900)</div>

        <q-separator class="q-my-md" />

        <div class="text-caption text-grey-7">
          Classes: .text-weight-thin, .text-weight-light, .text-weight-regular, .text-weight-medium,
          .text-weight-bold, .text-weight-bolder
        </div>
      </div>
    </Variant>

    <Variant title="Text Alignment" id="alignment">
      <div class="bg-white q-pa-md">
        <div class="text-left q-mb-md">
          <strong>Left aligned text</strong> (default) - {{ sampleText }}
        </div>
        <div class="text-center q-mb-md">
          <strong>Center aligned text</strong> - {{ sampleText }}
        </div>
        <div class="text-right q-mb-md"><strong>Right aligned text</strong> - {{ sampleText }}</div>
        <div class="text-justify q-mb-md"><strong>Justified text</strong> - {{ longText }}</div>

        <q-separator class="q-my-md" />

        <div class="text-caption text-grey-7">
          Classes: .text-left, .text-center, .text-right, .text-justify
        </div>
      </div>
    </Variant>

    <Variant title="Text Transforms" id="transforms">
      <div class="bg-white q-pa-md">
        <div class="q-mb-sm">Normal: {{ sampleText }}</div>
        <div class="q-mb-sm text-lowercase">Lowercase: {{ sampleText }}</div>
        <div class="q-mb-sm text-uppercase">Uppercase: {{ sampleText }}</div>
        <div class="q-mb-sm text-capitalize">Capitalize: {{ sampleText }}</div>

        <q-separator class="q-my-md" />

        <div class="text-caption text-grey-7">
          Classes: .text-lowercase, .text-uppercase, .text-capitalize
        </div>
      </div>
    </Variant>

    <Variant title="Text Colors (Wodore Theme)" id="colors">
      <div class="bg-white q-pa-md">
        <div class="q-mb-sm text-primary">Primary color text</div>
        <div class="q-mb-sm text-primary-700">Primary 700 shade</div>
        <div class="q-mb-sm text-primary-900">Primary 900 shade</div>
        <div class="q-mb-sm text-secondary">Secondary color text</div>
        <div class="q-mb-sm text-accent">Accent color text</div>
        <div class="q-mb-sm text-positive">Positive (success) text</div>
        <div class="q-mb-sm text-negative">Negative (error) text</div>
        <div class="q-mb-sm text-warning">Warning text</div>
        <div class="q-mb-sm text-info">Info text</div>

        <q-separator class="q-my-md" />

        <div class="bg-dark q-pa-sm">
          <div class="q-mb-sm text-white">White text on dark background</div>
          <div class="q-mb-sm text-grey-4">Light grey text</div>
        </div>

        <q-separator class="q-my-md" />

        <div class="text-caption text-grey-7">
          Classes: .text-primary, .text-primary-{100-900}, .text-secondary, .text-accent,
          .text-positive, .text-negative, .text-warning, .text-info, .text-white, .text-black,
          .text-grey-{1-14}
        </div>
      </div>
    </Variant>

    <Variant title="Text with Halo Effect" id="halo">
      <div class="bg-white q-pa-md">
        <div class="q-mb-md">
          <div class="text-h4 text-primary--halo">Primary Text with Halo</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            Custom Wodore class: .text-primary--halo • Adds a subtle shadow glow effect
          </div>
        </div>

        <div class="bg-dark q-pa-md">
          <div class="text-h4 text-white text-primary--halo">Halo Effect on Dark Background</div>
          <div class="text-caption text-grey-4 q-mt-sm">
            Works well for text overlays on images or dark backgrounds
          </div>
        </div>

        <q-separator class="q-my-md" />

        <div class="text-caption text-grey-7">
          Available for all color variants: .text-{color}--halo (e.g., .text-accent--halo,
          .text-secondary--halo)
        </div>
      </div>
    </Variant>

    <Variant title="Interactive Example" id="interactive">
      <template #controls>
        <HstText v-model="sampleText" title="Sample Text" />
      </template>

      <div class="bg-white q-pa-md">
        <div class="q-mb-md text-h4">{{ sampleText }}</div>
        <div class="q-mb-md text-h5">{{ sampleText }}</div>
        <div class="q-mb-md text-h6">{{ sampleText }}</div>
        <div class="q-mb-md text-body1">{{ sampleText }}</div>
        <div class="q-mb-md text-body2">{{ sampleText }}</div>
        <div class="q-mb-md text-caption">{{ sampleText }}</div>

        <q-separator class="q-my-md" />

        <div class="text-caption text-grey-7">Edit the sample text in the controls panel →</div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
button {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
}
</style>
