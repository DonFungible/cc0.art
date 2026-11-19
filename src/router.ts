import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/search", name: "search", component: () => import("./views/SearchView.vue") },
    { path: "/art/:source/:id", name: "art", component: () => import("./views/ArtworkView.vue"), props: true },
    { path: "/about", name: "about", component: () => import("./views/AboutView.vue") },
    { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("./views/NotFoundView.vue") },
  ],
  scrollBehavior(to, _from, saved) {
    if (saved) return saved;
    if (to.name === "search" && _from.name === "search") return false;
    return { top: 0 };
  },
});
