<script setup lang="ts">
import { ref, onMounted, defineOptions } from 'vue';
import { useUserSettingsStore } from '@stores/user-settings-store';

defineOptions({
  name: 'StoreExampleStory',
});

const store = useUserSettingsStore();
const storeData = ref('');

// Initialize store with mock data when component mounts
onMounted(() => {
  // Example: Set some mock user settings
  // store.someProperty = 'mock value';

  // Display store state
  updateStoreData();
});

function updateStoreData() {
  storeData.value = JSON.stringify(
    {
      // Show relevant store properties
      initialized: 'Store is initialized',
      note: 'You can access and modify store state here',
    },
    null,
    2
  );
}
</script>

<template>
  <Story title="Examples/Working with Stores">
    <Variant title="Store Access Example">
      <div class="bg-white q-pa-md" style="max-width: 600px">
        <div class="text-h6 q-mb-md">Pinia Store Example</div>

        <p class="text-body2 q-mb-md">
          This example shows how to access and initialize Pinia stores in Histoire stories.
        </p>

        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Store State:</div>
            <pre class="text-caption">{{ storeData }}</pre>
          </q-card-section>
        </q-card>

        <q-banner class="bg-info text-white">
          <template #avatar>
            <q-icon name="info" />
          </template>
          <div class="text-body2">
            <strong>Note:</strong> The store is available, but typically you should:
            <ul class="q-my-sm">
              <li>Mock store data in <code>onMounted()</code></li>
              <li>Or create a simplified presentational component</li>
              <li>Or use Vitest for complex store interactions</li>
            </ul>
          </div>
        </q-banner>
      </div>
    </Variant>

    <Variant title="Interactive Component Example">
      <div class="bg-white q-pa-md" style="max-width: 600px">
        <div class="text-h6 q-mb-md">Simple Interactive Component</div>

        <p class="text-body2 q-mb-md">
          For simple interactive components that don't require stores, you can use them directly:
        </p>

        <div class="q-mb-md">
          <q-btn color="primary" label="Primary Button" class="q-mr-sm" />
          <q-btn color="secondary" label="Secondary Button" class="q-mr-sm" />
          <q-btn color="accent" label="Accent Button" outline />
        </div>

        <div class="q-mb-md">
          <q-input v-model="store.$id" label="Text Input" outlined dense />
        </div>

        <div class="q-mb-md">
          <q-toggle label="Toggle Switch" />
        </div>

        <div class="q-mb-md">
          <q-checkbox label="Checkbox" />
        </div>
      </div>
    </Variant>

    <Variant title="Best Practices">
      <div class="bg-grey-2 q-pa-md" style="max-width: 700px">
        <div class="text-h6 q-mb-md">Working with Complex Components</div>

        <q-list bordered class="bg-white">
          <q-item>
            <q-item-section avatar>
              <q-icon color="positive" name="check_circle" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium"
                >Use Histoire for visual reference</q-item-label
              >
              <q-item-label caption
                >Show different visual states, layouts, and variations</q-item-label
              >
            </q-item-section>
          </q-item>

          <q-separator />

          <q-item>
            <q-item-section avatar>
              <q-icon color="positive" name="check_circle" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">Mock simple data</q-item-label>
              <q-item-label caption
                >Use onMounted() to initialize stores with mock data</q-item-label
              >
            </q-item-section>
          </q-item>

          <q-separator />

          <q-item>
            <q-item-section avatar>
              <q-icon color="info" name="lightbulb" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium"
                >Create presentational components</q-item-label
              >
              <q-item-label caption>Separate data-fetching logic from presentation</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator />

          <q-item>
            <q-item-section avatar>
              <q-icon color="warning" name="science" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">Use Vitest for complex testing</q-item-label>
              <q-item-label caption
                >Test behavior, store interactions, and API calls with proper mocking</q-item-label
              >
            </q-item-section>
          </q-item>
        </q-list>

        <q-separator class="q-my-md" />

        <div class="text-body2">
          <p class="q-mb-sm">
            <strong>When a component heavily depends on backend/stores:</strong>
          </p>
          <ol class="q-pl-md">
            <li>
              Create a mock implementation showing the rendered output (see WdPlaceTitle story)
            </li>
            <li>Or create a simplified "_ComponentDemo.vue" version without store dependencies</li>
            <li>Or use Vitest component testing with createTestingPinia()</li>
          </ol>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
pre {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
