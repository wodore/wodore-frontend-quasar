# Wodore Component Stories

This directory contains [Storybook](https://storybook.js.org/) stories for Wodore components (Histoire was retired 2026-11 — Storybook 10 is the story tool).

## Directory Structure

```
stories/
├── components/          # Component stories (mirrors src/components/)
│   ├── content/         # Content-related components
│   │   ├── huts/        # Hut components
│   │   └── place/       # Place-related components
│   └── examples/        # General examples
├── design-system/       # Design system references (Typography)
└── README.md            # This file
```

## Running Storybook

```bash
pnpm sb:dev      # Dev server on port 6006
pnpm sb:build    # Static build into dist/storybook
pnpm sb:preview  # Serve the built version
```

Live stories that fetch from the backend need the env vars (`.env.local`) — the same ones the dev server uses.

## Writing Stories

Stories are CSF3 `.stories.ts` files using the shared `preview` helper from `.storybook/preview.ts` (it registers Quasar, pinia, i18n, the router and the wd icon map, and avoids `@storybook/vue3` type-import issues under the storybook tsconfig):

```ts
import preview from '../../.storybook/preview';
import MyComponent from '@/components/MyComponent.vue';

const meta = preview.meta({
  title: 'Category/MyComponent',
  component: MyComponent,
  parameters: { layout: 'centered' },
});

export default meta;

export const Default = meta.story({
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent prop="value" />',
  }),
});
```

## Components with Stores / Backend Dependencies

The preview setup registers pinia, i18n, a memory router and Quasar — real components work, including ones that call the API (see `WdPlaceTitleLive.stories.ts` for the live pattern with a slug control).

| Approach                | Best for                                           | Backend required? |
| ----------------------- | -------------------------------------------------- | ----------------- |
| **Live component**      | Interactive testing, real data, full functionality | ✅ Yes            |
| **Mock implementation** | Visual reference, documentation                    | ❌ No             |
| **Wrapper with mocks**  | Components with props, controlled data             | ❌ No             |
| **Vitest**              | Behavior testing, complex interactions             | ❌ No (mocked)    |

For complex behavior testing prefer Vitest (`pnpm test:unit`) — stories are for visual reference.

## Best Practices

1. **Mirror the source structure**: `stories/components/content/place/…` ↔ `src/components/content/place/…`
2. **Descriptive titles**: `Category/ComponentName` (e.g. `Content/WdPlaceTitle (Live)`)
3. **Multiple variants**: show different states — long text, empty states, loading states
4. **Document edge cases** in `parameters.docs.description.component`
5. **Keep stories simple**: presentation only; automate behavior in Vitest

## Resources

- [Storybook for Vue 3](https://storybook.js.org/docs/get-started/frameworks/vue3-vite)
- [Quasar Documentation](https://quasar.dev/)
