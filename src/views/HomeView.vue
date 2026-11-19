<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useTitle } from "@vueuse/core";
import type { ArtworkSummary } from "../../shared/types";
import { searchArtworks } from "../api";
import SearchBox from "../components/SearchBox.vue";
import ArtCard from "../components/ArtCard.vue";

useTitle("cc0.art — search public-domain art");
const router = useRouter();
const query = ref("");
const featured = ref<ArtworkSummary[]>([]);
const suggestions = ["portrait", "landscape", "flowers", "Japan", "silver", "Rembrandt"];

function submit(q: string) {
  router.push({ name: "search", query: q ? { q } : {} });
}

onMounted(async () => {
  try {
    featured.value = (await searchArtworks({})).results.slice(0, 8);
  } catch {
    featured.value = [];
  }
});
</script>

<template>
  <section class="hero">
    <h1>Public-domain art,<br />free for anyone to use.</h1>
    <p class="lede">
      Search open-access museum collections for works dedicated to the public domain under CC0. No permission, no
      attribution required, no strings.
    </p>
    <SearchBox v-model="query" large autofocus @submit="submit" />
    <p class="suggestions">
      Try
      <RouterLink v-for="s in suggestions" :key="s" :to="{ name: 'search', query: { q: s } }">{{ s }}</RouterLink>
    </p>
  </section>

  <section v-if="featured.length" class="featured">
    <div class="section-head">
      <h2>From the collection</h2>
      <RouterLink to="/search">Browse all →</RouterLink>
    </div>
    <div class="grid">
      <ArtCard v-for="art in featured" :key="art.source + art.source_id" :art="art" />
    </div>
  </section>
</template>
