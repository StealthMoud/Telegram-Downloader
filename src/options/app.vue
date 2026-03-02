<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" width="300">
      <v-list>
        <v-list-item
          v-for="item in menuItems"
          :key="item.value"
          :to="item.route"
          :prepend-icon="item.icon"
        >
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>

      <template v-slot:append>
        <div class="pa-4">
          <v-btn
            block
            variant="outlined"
            prepend-icon="mdi-help-circle"
            @click="$router.push('/options/faq')"
          >
            Help
          </v-btn>
        </div>
      </template>
    </v-navigation-drawer>

    <v-app-bar elevation="2" color="primary" density="comfortable">
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>Telegram Media Downloader</v-toolbar-title>
      <v-spacer></v-spacer>

      <v-menu min-width="220" elevation="8">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" icon>
            <v-avatar size="32" color="secondary">
              <span class="text-body-2 font-weight-medium">FR</span>
            </v-avatar>
          </v-btn>
        </template>
        <v-list>
          <v-list-item>
            <div class="text-center pa-4">
              <v-avatar size="56" class="mb-4" color="secondary">
                <span class="text-h6 font-weight-medium">FR</span>
              </v-avatar>
              <div class="mb-1 font-weight-medium text-body-1">Free User</div>
              <v-chip size="small" color="primary" variant="elevated"
                >Pro Activated</v-chip
              >
            </div>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main>
      <router-view></router-view>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const drawer = ref(true);

const menuItems = computed(() => {
  return [
    {
      title: "Settings",
      icon: "mdi-view-dashboard",
      value: "settings",
      route: "/options",
    },
    {
      title: "FAQ",
      icon: "mdi-help-circle",
      value: "faq",
      route: "/options/faq",
    },
    {
      title: "About",
      icon: "mdi-information",
      value: "about",
      route: "/options/about",
    },
  ];
});
</script>
