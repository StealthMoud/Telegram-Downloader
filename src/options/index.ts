import { createApp } from "vue";
import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from "vue-router";
import { createPinia } from "pinia";
import App from "./app.vue";

// Cleaned up routing - No Login, Pricing, or Subscriptions
const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/options" },
  {
    path: "/options",
    component: () => import("./views/dashboard.vue"),
  },
  {
    path: "/options/faq",
    component: () => import("./views/faq.vue"),
  },
  {
    path: "/options/about",
    component: () => import("./views/about.vue"),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const pinia = createPinia();
const app = createApp(App);

app.use(router);
app.use(pinia);
app.mount("#app");
