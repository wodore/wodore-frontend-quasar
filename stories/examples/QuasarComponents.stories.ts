import preview from '../../.storybook/preview';

const meta = preview.meta({
  title: 'Examples/Quasar Components',
  parameters: {
    layout: 'centered',
  },
});

export default meta;

export const Button = meta.story({
  render: () => ({
    template: `
      <div style="display: flex; gap: 8px; align-items: center;">
        <q-btn color="primary" label="Primary" />
        <q-btn color="secondary" label="Secondary" />
        <q-btn color="accent" label="Accent" outline />
        <q-btn color="negative" label="Negative" flat />
      </div>
    `,
  }),
});

export const Card = meta.story({
  render: () => ({
    template: `
      <q-card flat bordered style="width: 350px">
        <q-card-section>
          <div class="text-h6">Wodore Card</div>
          <div class="text-subtitle2">by Storybook</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          This is a Quasar card rendered in Storybook with CSF Next.
          It uses the Wodore design system colors and typography.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="primary" label="Action" />
        </q-card-actions>
      </q-card>
    `,
  }),
});

export const Inputs = meta.story({
  render: () => ({
    data: () => ({ text: '', checked: false, selected: 'option1' }),
    template: `
      <div style="width: 300px; display: flex; flex-direction: column; gap: 16px;">
        <q-input v-model="text" label="Text Input" outlined dense />
        <q-toggle v-model="checked" label="Toggle" color="primary" />
        <q-btn-toggle
          v-model="selected"
          :options="[
            { label: 'Option 1', value: 'option1' },
            { label: 'Option 2', value: 'option2' },
            { label: 'Option 3', value: 'option3' },
          ]"
          color="primary"
          text-color="white"
          toggle-color="accent"
        />
      </div>
    `,
  }),
});

export const Typography = meta.story({
  render: () => ({
    template: `
      <div style="max-width: 600px;">
        <div class="text-h4 q-mb-md text-primary-900">Typography</div>
        <div class="text-h1">Heading 1</div>
        <div class="text-h2">Heading 2</div>
        <div class="text-h3">Heading 3</div>
        <div class="text-h4">Heading 4</div>
        <div class="text-h5">Heading 5</div>
        <div class="text-h6">Heading 6</div>
        <div class="text-body1 q-mt-md">Body 1 - Default body text for Wodore.</div>
        <div class="text-body2">Body 2 - Secondary text style.</div>
        <div class="text-caption q-mt-md">Caption text</div>
      </div>
    `,
  }),
});
