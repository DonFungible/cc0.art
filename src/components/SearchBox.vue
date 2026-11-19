<script setup lang="ts">
const model = defineModel<string>({ default: "" });
defineProps<{ autofocus?: boolean; large?: boolean }>();
const emit = defineEmits<{ submit: [value: string] }>();
</script>

<template>
  <form class="search-box" :class="{ large }" role="search" @submit.prevent="emit('submit', model.trim())">
    <input
      v-model="model"
      type="search"
      name="q"
      placeholder="Search portraits, landscapes, artists, cultures…"
      aria-label="Search artworks"
      autocomplete="off"
      :autofocus="autofocus"
    />
    <button type="submit">Search</button>
  </form>
</template>
