<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useTitle } from "@vueuse/core";

useTitle("Not found — cc0.art");
</script>

<template>
  <section class="prose">
    <h1>Page not found</h1>
    <p><RouterLink to="/">Back to search</RouterLink></p>
  </section>
</template>
