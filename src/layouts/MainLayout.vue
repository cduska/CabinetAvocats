<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { getFirstAccessibleRoute, isRouteName, useAccessControl, type AppRouteName } from '../services/access';
import { useSession } from '../services/session';

interface NavigationItem {
  label: string;
  path: string;
  icon: string;
  routeName: AppRouteName;
}

const route = useRoute();
const router = useRouter();
const sidebarCollapsed = ref(false);
const darkMode = ref(localStorage.getItem('cabinet-theme') === 'dark');
const { canAccessRoute } = useAccessControl();
const {
  agencies,
  state: sessionState,
  availableMetiers,
  availableUsers,
  currentAgency,
  currentUser,
  setAgency,
  setMetier,
  setUser,
} = useSession();

const navigation: NavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'DB', routeName: 'dashboard' },
  { label: 'Clients', path: '/clients', icon: 'CL', routeName: 'clients' },
  { label: 'Dossiers', path: '/dossiers', icon: 'DS', routeName: 'dossiers' },
  { label: 'Procedures', path: '/procedures', icon: 'PR', routeName: 'procedures' },
  { label: 'Documents', path: '/documents', icon: 'DC', routeName: 'documents' },
  { label: 'Schema', path: '/schema', icon: 'SC', routeName: 'schema' },
];

const pageTitle = computed(() => String(route.meta.title ?? 'Dashboard'));
const visibleNavigation = computed(() => navigation.filter((item) => canAccessRoute(item.routeName)));
const activeSessionLabel = computed(() => {
  if (!currentUser.value || !currentAgency.value) {
    return 'Aucune session active';
  }

  return `${currentUser.value.firstName} ${currentUser.value.lastName} - ${currentUser.value.metier} (${currentAgency.value.label})`;
});

watch(
  darkMode,
  (enabled) => {
    document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
    localStorage.setItem('cabinet-theme', enabled ? 'dark' : 'light');
  },
  { immediate: true },
);

watch(
  () => sessionState.metier,
  () => {
    if (!isRouteName(route.name) || canAccessRoute(route.name)) {
      return;
    }

    router.replace({ name: getFirstAccessibleRoute(sessionState.metier) }).catch(() => undefined);
  },
);

function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function toggleTheme(): void {
  darkMode.value = !darkMode.value;
}

function onAgencyChange(event: Event): void {
  setAgency((event.target as HTMLSelectElement).value);
}

function onMetierChange(event: Event): void {
  setMetier((event.target as HTMLSelectElement).value);
}

function onUserChange(event: Event): void {
  setUser((event.target as HTMLSelectElement).value);
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
          v-for="item in visibleNavigation"
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
          <p class="topbar-session" data-cy="active-session">Session: {{ activeSessionLabel }}</p>
        </div>

        <div class="topbar-actions">
          <div class="session-switcher" data-cy="session-switcher">
            <label class="session-field" for="session-agency">
              <span>Agence</span>
              <select
                id="session-agency"
                class="select session-select"
                :value="sessionState.agencyId"
                data-cy="session-agency"
                @change="onAgencyChange"
              >
                <option v-for="agency in agencies" :key="agency.id" :value="agency.id">{{ agency.label }}</option>
              </select>
            </label>

            <label class="session-field" for="session-metier">
              <span>Metier</span>
              <select
                id="session-metier"
                class="select session-select"
                :value="sessionState.metier"
                data-cy="session-metier"
                @change="onMetierChange"
              >
                <option v-for="metier in availableMetiers" :key="metier" :value="metier">{{ metier }}</option>
              </select>
            </label>

            <label class="session-field" for="session-user">
              <span>Utilisateur</span>
              <select
                id="session-user"
                class="select session-select"
                :value="sessionState.userId"
                data-cy="session-user"
                @change="onUserChange"
              >
                <option v-for="user in availableUsers" :key="user.id" :value="user.id">
                  {{ user.firstName }} {{ user.lastName }}
                </option>
              </select>
            </label>
          </div>

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
