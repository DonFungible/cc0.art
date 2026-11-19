<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { ArtworkSummary } from "../../shared/types";
import ArtImage from "./ArtImage.vue";

defineProps<{ art: ArtworkSummary }>();
</script>

<template>
  <RouterLink class="art-card" :to="{ name: 'art', params: { source: art.source, id: art.source_id } }">
    <div class="frame"><ArtImage :src="art.thumb_url" :alt="art.title" /></div>
    <div class="caption">
      <h3>{{ art.title }}</h3>
      <p>{{ [art.artist, art.date_display].filter(Boolean).join(", ") }}</p>
    </div>
  </RouterLink>
</template>
