# Wodore Component Stories

This directory contains [Histoire](https://histoire.dev/) stories for Wodore components.

## Directory Structure

```
stories/
├── components/          # Component stories
│   ├── content/        # Content-related components
│   │   └── place/      # Place-related components
│   └── ...             # Other component categories
├── design-system/      # Design system references
│   └── Typography.story.vue
└── README.md           # This file
```

## Running Histoire

```bash
# Development server (with hot reload)
yarn story:dev

# Build static version
yarn story:build

# Preview built version
yarn story:preview
```

## Writing Stories

Stories are written as `.story.vue` files and follow the Histoire API:

```vue
<script setup lang="ts">
import { ref, defineOptions } from 'vue';
import MyComponent from '@components/MyComponent.vue';

defineOptions({
  name: 'MyComponentStory',
});

const myProp = ref('Hello');
</script>

<template>
  <Story title="Category/MyComponent">
    <Variant title="Default">
      <MyComponent :prop="myProp" />
    </Variant>

    <Variant title="Another variant">
      <MyComponent prop="Different value" />
    </Variant>
  </Story>
</template>
```

## Testing Components with Stores and Backend Dependencies

### The Challenge

Some Wodore components depend on:

- **Pinia stores** for state management
- **Backend API** via composables like `usePlace`, `useHuts`, etc.
- **Router context** for navigation
- **Authentication state**

### Good News: You CAN Use Real Components!

**Unlike what was initially thought, you CAN import and use real components in Histoire** - even those that use stores and API calls! The setup in `src/histoire-setup.ts` properly initializes:

- ✅ Pinia (stores work)
- ✅ Vue I18n (translations work)
- ✅ Quasar (components and styles work)
- ✅ API clients (backend calls work if backend is running)

### Solutions

#### 1. Live Component with Real Backend (✅ Recommended!)

Use the actual component with real API calls:

```vue
<script setup lang="ts">
import { ref, computed, watch, defineOptions } from 'vue';
import WdPlaceTitle from '@components/content/place/WdPlaceTitle.vue';

defineOptions({
  name: 'WdPlaceTitleLiveStory',
});

const selectedSlug = ref('schreckhornhuette');
const componentKey = ref(0);

// Force re-render when slug changes
watch(selectedSlug, () => {
  componentKey.value++;
});
</script>

<template>
  <Story title="Content/WdPlaceTitle (Live)">
    <template #controls>
      <HstSelect
        v-model="selectedSlug"
        title="Select Place"
        :options="['schreckhornhuette', 'britannia', 'monte-rosa']"
      />
    </template>

    <Variant title="Live Component">
      <div class="bg-white q-pa-md">
        <Suspense>
          <template #default>
            <WdPlaceTitle :key="componentKey" :slug="selectedSlug" />
          </template>
          <template #fallback>
            <div class="text-center q-pa-md">
              <q-spinner color="primary" size="40px" />
              <div class="text-caption q-mt-sm">Loading...</div>
            </div>
          </template>
        </Suspense>
      </div>
    </Variant>
  </Story>
</template>
```

**Benefits:**

- ✅ Interactive - change slug and see real data
- ✅ Tests real API integration
- ✅ See actual loading states
- ✅ Catch real errors
- ✅ Test with live backend data

**Requirements:**

- Backend must be running
- Network connectivity
- Valid slugs/IDs

**Example:** See `stories/components/content/place/WdPlaceTitleLive.story.vue`

#### 2. Mock Implementation (Good for visual reference)

Create a mock version that shows the rendered output:

```vue
<script setup lang="ts">
import { ref, defineOptions } from 'vue';

defineOptions({
  name: 'ComplexComponentStory',
});

const name = ref('Example Name');
</script>

<template>
  <Story title="Components/ComplexComponent">
    <Variant title="Component Info">
      <div class="bg-grey-2 q-pa-md">
        <p><strong>Component:</strong> ComplexComponent.vue</p>
        <p><strong>Props:</strong> id: string, mode: 'view' | 'edit'</p>
        <p>
          <strong>Note:</strong> This component requires backend/store access. Examples below show
          expected rendered output.
        </p>
      </div>
    </Variant>

    <Variant title="Default State">
      <!-- Manually recreate the component's rendered HTML -->
      <div class="bg-white q-pa-md">
        <h3 class="text-h5">{{ name }}</h3>
        <p class="text-body2">Mock content matching the real component output</p>
      </div>
    </Variant>
  </Story>
</template>
```

**Use when:**

- Backend is not available
- You want documentation of visual states
- Quick visual reference without setup

**Example:** See `stories/components/content/place/WdPlaceTitle.story.vue`

#### 3. Wrapper with Mock Data

Create a wrapper component that provides mock data:

```vue
<script setup lang="ts">
import { ref, defineOptions, provide } from 'vue';
import { useAuthStore } from '@stores/auth-store';
import ComplexComponent from '@components/ComplexComponent.vue';

defineOptions({
  name: 'ComplexComponentStory',
});

// Mock the composable or store data
const mockPlace = ref({
  id: '123',
  name: 'Test Place',
  location: { lat: 46.5, lon: 7.8 },
});

// Provide mock data that the component expects
provide('place', mockPlace);
</script>

<template>
  <Story title="Components/ComplexComponent">
    <Variant title="With Mock Data">
      <ComplexComponent :place-id="mockPlace.id" />
    </Variant>
  </Story>
</template>
```

**Note:** This only works if the component accepts props. If it directly uses composables or stores inside, use option 1 (live component) or option 4.

#### 4. Create a Simplified Version

Create a simplified presentational version of the component specifically for stories:

```
src/components/MyComponent.vue          # Original (with stores/API)
stories/components/MyComponent.story.vue  # Story file
stories/components/_MyComponentDemo.vue   # Simplified demo version (presentational only)
```

In your story, import and use `_MyComponentDemo.vue` instead of the real component.

#### 5. Use Vitest Component Testing Instead

For components that heavily depend on stores and backend:

```bash
# Use Vitest for component testing instead of Histoire
yarn test:component
```

Vitest allows you to:

- Mock Pinia stores with `createTestingPinia()`
- Mock API responses
- Test component behavior programmatically

### When to Use Each Approach

| Approach                   | Best For                                           | Backend Required? |
| -------------------------- | -------------------------------------------------- | ----------------- |
| **Live Component**         | Interactive testing, real data, full functionality | ✅ Yes            |
| **Mock Implementation**    | Visual reference, documentation                    | ❌ No             |
| **Wrapper with Mock Data** | Components with props, controlled data             | ❌ No             |
| **Simplified Version**     | Reusable presentation components                   | ❌ No             |
| **Vitest Testing**         | Behavior testing, complex interactions             | ❌ No (mocked)    |

### Recommended Workflow

1. **Start with live components** - Most powerful and useful
2. **Add mock variants** - For documentation and offline reference
3. **Use Vitest** - For automated behavior testing

### Working with Pinia Stores

Histoire's setup file (`src/histoire-setup.ts`) already initializes Pinia:

```typescript
app.use(createPinia());
```

However, stores are empty at story collection time. If you need store data:

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useMyStore } from '@stores/my-store';
import MyComponent from '@components/MyComponent.vue';

const store = useMyStore();

onMounted(() => {
  // Initialize store with mock data
  store.items = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
  ];
});
</script>

<template>
  <Story title="Components/MyComponent">
    <Variant title="With Store Data">
      <MyComponent />
    </Variant>
  </Story>
</template>
```

## Best Practices

1. **Organize by component location**: Mirror the `src/components/` structure
2. **Use descriptive titles**: Category/ComponentName format (e.g., "Content/WdPlaceTitle")
3. **Add component name**: Use `defineOptions({ name: 'ComponentStory' })` to avoid ESLint warnings
4. **Create multiple variants**: Show different states and configurations
5. **Add interactive controls**: Use `HstCheckbox`, `HstSelect`, `HstText`, etc. in `<template #controls>`
6. **Document edge cases**: Long text, empty states, error states, loading states
7. **Add context**: Include component path, props, and usage notes
8. **Keep stories simple**: Focus on visual presentation, use Vitest for complex behavior testing

## Histoire Controls

Available control components:

- `<HstText>` - Text input
- `<HstNumber>` - Number input
- `<HstCheckbox>` - Boolean checkbox
- `<HstSelect>` - Dropdown select
- `<HstTextarea>` - Multi-line text
- `<HstSlider>` - Numeric slider
- `<HstColorSelect>` - Color picker
- `<HstJson>` - JSON editor

Example:

```vue
<template>
  <Story title="My Component">
    <template #controls>
      <HstText v-model="name" title="Name" />
      <HstNumber v-model="age" title="Age" />
      <HstCheckbox v-model="enabled" title="Enabled" />
      <HstSelect v-model="size" title="Size" :options="['small', 'medium', 'large']" />
    </template>

    <Variant title="Interactive">
      <MyComponent :name="name" :age="age" :enabled="enabled" :size="size" />
    </Variant>
  </Story>
</template>
```

## Styling Issues

If text appears gray or colors don't match your app:

1. **Text is gray**: Histoire applies default gray colors. Our setup overrides this in `src/histoire-setup.ts`
2. **Colors missing**: Ensure you're using Quasar color classes (`.text-primary`, `.bg-secondary`, etc.)
3. **Styles not loading**: Check that `@/css/app.scss` is imported in `src/histoire-setup.ts`

## Resources

- [Histoire Documentation](https://histoire.dev/)
- [Histoire Vue 3 Guide](https://histoire.dev/guide/vue3/)
- [Histoire Controls](https://histoire.dev/guide/vue3/controls.html)
- [Quasar Documentation](https://quasar.dev/)
