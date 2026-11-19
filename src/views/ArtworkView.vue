<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useClipboard, useTitle } from "@vueuse/core";
import { SOURCE_NAMES, type Artwork, type LicenseEvidence } from "../../shared/types";
import { fetchArtwork } from "../api";
import ArtImage from "../components/ArtImage.vue";

const props = defineProps<{ source: string; id: string }>();
const router = useRouter();
const art = ref<Artwork | null>(null);
const status = ref<"loading" | "ready" | "missing" | "error">("loading");

watch(
  () => [props.source, props.id] as const,
  async ([source, id], _old, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    status.value = "loading";
    art.value = null;
    try {
      art.value = await fetchArtwork(source, id, controller.signal);
      status.value = "ready";
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      status.value = (err as { status?: number }).status === 404 ? "missing" : "error";
    }
  },
  { immediate: true },
);

useTitle(computed(() => (art.value ? `${art.value.title} — cc0.art` : "cc0.art")));

const sourceName = computed(() => (art.value ? (SOURCE_NAMES[art.value.source] ?? art.value.source) : ""));
const evidence = computed<LicenseEvidence | null>(() => {
  if (!art.value) return null;
  try {
    return JSON.parse(art.value.license_evidence) as LicenseEvidence;
  } catch {
    return null;
  }
});
const details = computed(() =>
  art.value
    ? ([
        ["Artist", art.value.artist],
        ["Date", art.value.date_display],
        ["Medium", art.value.medium],
        ["Culture", art.value.culture],
        ["Type", art.value.classification],
        ["Source", sourceName.value],
      ] as const).filter(([, value]) => value)
    : [],
);
const attribution = computed(() => {
  if (!art.value) return "";
  const a = art.value;
  const byline = [a.artist, a.date_display].filter(Boolean).join(", ");
  return `“${a.title}”${byline ? `, ${byline}` : ""}. ${sourceName.value}. Public domain (CC0 1.0). ${a.source_url}`;
});
const { copy, copied, isSupported } = useClipboard({ legacy: true });

function back() {
  if (window.history.state?.back) router.back();
  else router.push({ name: "search" });
}
</script>

<template>
  <section class="artwork-page">
    <button type="button" class="back" @click="back">← Back</button>

    <p v-if="status === 'loading'" class="status">Loading…</p>
    <div v-else-if="status === 'missing'" class="status">
      <h1>Artwork not found</h1>
      <p><RouterLink to="/search">Browse the collection</RouterLink></p>
    </div>
    <p v-else-if="status === 'error'" class="status error">Something went wrong loading this artwork.</p>

    <div v-else-if="art" class="artwork">
      <figure class="artwork-image">
        <ArtImage :src="art.thumb_url" :alt="art.title" eager />
        <figcaption>
          <a :href="art.image_url" target="_blank" rel="noopener">Full-resolution image ↗</a>
        </figcaption>
      </figure>

      <div class="artwork-info">
        <h1>{{ art.title }}</h1>
        <p v-if="art.artist" class="byline">{{ art.artist }}<span v-if="art.date_display">, {{ art.date_display }}</span></p>

        <dl class="details">
          <template v-for="[label, value] in details" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </template>
        </dl>

        <aside class="license-proof">
          <h2>License proof</h2>
          <p class="license-badge">{{ art.license === "CC0-1.0" ? "CC0 1.0 Universal — Public Domain Dedication" : art.license }}</p>
          <dl v-if="evidence">
            <dt>Source field</dt>
            <dd><code>{{ evidence.field }}: "{{ evidence.value }}"</code></dd>
            <dt>Copyright</dt>
            <dd>{{ evidence.copyright ?? "none listed" }}</dd>
            <dt>Verified via</dt>
            <dd><a :href="evidence.api_url" target="_blank" rel="noopener">{{ sourceName }} Open Access API ↗</a></dd>
            <dt>Checked</dt>
            <dd>{{ new Date(evidence.fetched_at).toLocaleDateString() }}</dd>
          </dl>
          <p v-else><code>{{ art.license_evidence }}</code></p>
          <p><a :href="art.source_url" target="_blank" rel="noopener">View on {{ sourceName }} ↗</a></p>
        </aside>

        <div class="attribution">
          <p>Attribution isn't required for CC0 works, but it's appreciated:</p>
          <blockquote>{{ attribution }}</blockquote>
          <button v-if="isSupported" type="button" @click="copy(attribution)">
            {{ copied ? "Copied" : "Copy attribution" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
