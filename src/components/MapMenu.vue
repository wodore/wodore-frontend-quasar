<script setup lang="ts">
import { ref } from 'vue';
const link = ref('outbox');
const active_classes = 'bg-accent text-white';
</script>

<template>
  <q-list bordered padding class="rounded-borders text-primary">
    <q-item
      clickable
      v-ripple
      :active="link === 'inbox'"
      @click="link = 'inbox'"
      :active-class="active_classes"
    >
      <q-item-section avatar>
        <q-icon name="eva-inbox" />
      </q-item-section>

      <q-item-section>Inbox</q-item-section>
    </q-item>

    <q-item
      clickable
      v-ripple
      :active="link === 'outbox'"
      @click="link = 'outbox'"
      :active-class="active_classes"
    >
      <q-item-section avatar>
        <q-icon name="eva-paper-plane" />
      </q-item-section>

      <q-item-section>Outbox</q-item-section>
    </q-item>

    <q-item
      clickable
      v-ripple
      :active="link === 'trash'"
      @click="link = 'trash'"
      :active-class="active_classes"
    >
      <q-item-section avatar>
        <q-icon name="eva-trash" />
      </q-item-section>

      <q-item-section>Trash</q-item-section>
    </q-item>

    <q-separator spaced />

    <q-item
      clickable
      v-ripple
      :active="link === 'settings'"
      @click="link = 'settings'"
      :active-class="active_classes"
    >
      <q-item-section avatar>
        <q-icon name="eva-settings" />
      </q-item-section>

      <q-item-section>Settings</q-item-section>
    </q-item>

    <q-item
      clickable
      v-ripple
      :active="link === 'help'"
      @click="link = 'help'"
      :active-class="active_classes"
    >
      <q-item-section avatar>
        <q-icon name="eva-question-mark-circle" />
      </q-item-section>

      <q-item-section>Help</q-item-section>
    </q-item>
  </q-list>
</template>
