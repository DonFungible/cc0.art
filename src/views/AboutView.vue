<script setup lang="ts">
import { useTitle } from "@vueuse/core";

useTitle("About — cc0.art");
</script>

<template>
  <article class="prose">
    <h1>About cc0.art</h1>
    <p>
      cc0.art is a search engine for artwork you can use for anything: books, websites, merchandise, remixes, AI
      training, or the wall of your kitchen. Every work listed has been released by its holding institution under
      <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0 1.0</a>.
    </p>

    <h2>What CC0 means</h2>
    <p>
      CC0 is a public domain dedication. The institution waives any copyright and related rights it may hold in the
      image, to the fullest extent allowed by law. You may copy, modify, distribute, and use the work, including
      commercially, without asking permission and without crediting anyone.
    </p>
    <p>
      Attribution is still a kind gesture, and it helps others find the original. Each artwork page has a one-click
      attribution you can paste.
    </p>
    <h2>What CC0 doesn't cover</h2>
    <p>
      CC0 covers copyright. It does not grant trademark rights, and it does not override the privacy or publicity rights
      of people depicted. Use common sense with recognizable people and logos.
    </p>

    <h2>License proof</h2>
    <p>
      We only index records that the source explicitly marks as CC0 in its own data. Each artwork page shows that
      evidence: the exact field and value we read, a link to the source API record, and when we checked it.
    </p>

    <h2>Sources</h2>
    <ul>
      <li>
        <a href="https://openaccess-api.clevelandart.org/" target="_blank" rel="noopener">The Cleveland Museum of Art Open Access</a>
        — artworks with <code>share_license_status: "CC0"</code> and an available image.
      </li>
    </ul>
    <p>More open-access collections are coming.</p>
  </article>
</template>
