<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

interface NavigationItem {
  label: string;
  path: string;
  icon: string;
}

const route = useRoute();
const sidebarCollapsed = ref(false);
const darkMode = ref(localStorage.getItem('cabinet-theme') === 'dark');

const navigation: NavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'DB' },
  { label: 'Clients', path: '/clients', icon: 'CL' },
  { label: 'Dossiers', path: '/dossiers', icon: 'DS' },
  { label: 'Procedures', path: '/procedures', icon: 'PR' },
  { label: 'Documents', path: '/documents', icon: 'DC' },
  { label: 'Schema', path: '/schema', icon: 'SC' },
];

const pageTitle = computed(() => String(route.meta.title ?? 'Dashboard'));

watch(
  darkMode,
  (enabled) => {
    document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
    localStorage.setItem('cabinet-theme', enabled ? 'dark' : 'light');
  },
  { immediate: true },
);

function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function toggleTheme(): void {
  darkMode.value = !darkMode.value;
}
</script>

<template>
  <div class="app-shell" :class="{ 'is-collapsed': sidebarCollapsed }">
    <aside class="sidebar" data-cy="sidebar">
      <div class="sidebar-header">
        <p class="sidebar-brand">Cabinet Avocats</p>
        <button
          class="icon-button"
          type="button"
          :aria-label="sidebarCollapsed ? '» Etendre navigation' : '« Reduire navigation'"
          @click="toggleSidebar"
        >
          {{ sidebarCollapsed ? '»' : '«' }}
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Navigation principale">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          class="sidebar-link"
          active-class="is-active"
          :data-cy="`nav-${item.label.toLowerCase()}`"
        >
          <span class="sidebar-icon">{{ item.icon }}</span>
          <span v-if="!sidebarCollapsed">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div>
          <p class="topbar-kicker">Intranet de gestion</p>
          <h1>{{ pageTitle }}</h1>
        </div>

        <div class="topbar-actions">
          <button class="button button-secondary" type="button" @click="toggleTheme" data-cy="theme-toggle">
            {{ darkMode ? 'Mode clair' : 'Mode sombre' }}
          </button>
        </div>
      </header>

      <main class="page-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
