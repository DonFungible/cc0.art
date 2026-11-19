<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, type LocationQueryRaw } from "vue-router";
import { useDebounceFn, useInfiniteScroll, useTitle } from "@vueuse/core";
import type { ArtworkSummary, ClassificationCount } from "../../shared/types";
import { fetchClassifications, searchArtworks } from "../api";
import SearchBox from "../components/SearchBox.vue";
import ArtCard from "../components/ArtCard.vue";

const route = useRoute();
const router = useRouter();

const param = (key: string) => {
  const value = route.query[key];
  return typeof value === "string" ? value : "";
};
const filters = computed(() => ({
  q: param("q"),
  classification: param("classification"),
  from: param("from"),
  to: param("to"),
}));

const input = ref(filters.value.q);
const from = ref(filters.value.from);
const to = ref(filters.value.to);
const classifications = ref<ClassificationCount[]>([]);
const results = ref<ArtworkSummary[]>([]);
const total = ref<number | null>(null);
const loading = ref(false);
const done = ref(false);
const error = ref<string | null>(null);
let page = 0;
let generation = 0;
let controller: AbortController | null = null;

useTitle(computed(() => (filters.value.q ? `“${filters.value.q}” — cc0.art` : "Browse — cc0.art")));

function updateQuery(patch: Partial<Record<keyof typeof filters.value, string>>) {
  const next: LocationQueryRaw = { ...route.query, ...patch };
  for (const key of Object.keys(next)) if (!next[key]) delete next[key];
  router.replace({ name: "search", query: next });
}

const debouncedQuery = useDebounceFn((value: string) => updateQuery({ q: value.trim() }), 300);
const debouncedYears = useDebounceFn(() => updateQuery({ from: from.value.trim(), to: to.value.trim() }), 500);
watch(input, (value) => {
  if (value.trim() !== filters.value.q) debouncedQuery(value);
});
watch([from, to], debouncedYears);

async function load(reset: boolean) {
  if (reset) {
    controller?.abort();
    generation++;
    page = 0;
    results.value = [];
    total.value = null;
    done.value = false;
    error.value = null;
  } else if (loading.value || done.value || error.value) {
    return;
  }
  const current = generation;
  controller = new AbortController();
  loading.value = true;
  try {
    const res = await searchArtworks({ ...filters.value, page: page + 1 }, controller.signal);
    if (current !== generation) return;
    if (res.total !== undefined) total.value = res.total;
    results.value.push(...res.results);
    page = res.page;
    done.value = res.results.length < res.pageSize;
  } catch (err) {
    if (current !== generation || (err as Error).name === "AbortError") return;
    error.value = "Something went wrong loading results.";
  } finally {
    if (current === generation) loading.value = false;
  }
}

watch(
  filters,
  (next, prev) => {
    if (prev && JSON.stringify(next) === JSON.stringify(prev)) return;
    if (next.q !== input.value.trim()) input.value = next.q;
    from.value = next.from;
    to.value = next.to;
    load(true);
  },
  { immediate: true },
);

useInfiniteScroll(window, () => load(false), {
  distance: 800,
  canLoadMore: () => !done.value && !error.value && results.value.length > 0,
});

onMounted(async () => {
  try {
    classifications.value = await fetchClassifications();
  } catch {
    classifications.value = [];
  }
});

const summary = computed(() => {
  if (total.value === null) return "";
  const noun = total.value === 1 ? "work" : "works";
  return filters.value.q ? `${total.value.toLocaleString()} ${noun} for “${filters.value.q}”` : `${total.value.toLocaleString()} ${noun}`;
});
</script>

<template>
  <section class="search-page">
    <SearchBox v-model="input" @submit="(q) => updateQuery({ q })" />
    <div class="filters">
      <label>
        <span>Type</span>
        <select
          :value="filters.classification"
          @change="updateQuery({ classification: ($event.target as HTMLSelectElement).value })"
        >
          <option value="">All types</option>
          <option v-for="c in classifications" :key="c.classification" :value="c.classification">
            {{ c.classification }} ({{ c.count }})
          </option>
        </select>
      </label>
      <label>
        <span>From year</span>
        <input v-model="from" inputmode="numeric" placeholder="e.g. 1600" />
      </label>
      <label>
        <span>To year</span>
        <input v-model="to" inputmode="numeric" placeholder="e.g. 1900" />
      </label>
      <p class="count" aria-live="polite">{{ summary }}</p>
    </div>

    <div class="grid">
      <ArtCard v-for="art in results" :key="art.source + art.source_id" :art="art" />
    </div>

    <p v-if="error" class="status error">
      {{ error }} <button type="button" @click="error = null; load(results.length === 0)">Retry</button>
    </p>
    <p v-else-if="loading" class="status">Loading…</p>
    <p v-else-if="done && results.length === 0" class="status">No public-domain works match. Try a broader search.</p>
    <p v-else-if="done" class="status muted">That's everything.</p>
  </section>
</template>
