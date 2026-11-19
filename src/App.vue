<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <header class="site-header">
    <RouterLink to="/" class="logo">cc0<span>.art</span></RouterLink>
    <nav>
      <RouterLink to="/search">Browse</RouterLink>
      <RouterLink to="/about">About</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
  <footer class="site-footer">
    <p>Every work here is dedicated to the public domain (CC0). Images courtesy of the source museums.</p>
  </footer>
</template>
