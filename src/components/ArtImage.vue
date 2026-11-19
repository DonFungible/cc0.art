<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ src: string; alt: string; eager?: boolean }>();
const failed = ref(false);
const loaded = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
    loaded.value = false;
  },
);
</script>

<template>
  <div v-if="failed" class="art-image fallback" role="img" :aria-label="alt">
    <span>Image unavailable</span>
  </div>
  <img
    v-else
    class="art-image"
    :class="{ loaded }"
    :src="src"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    @load="loaded = true"
    @error="failed = true"
  />
</template>
