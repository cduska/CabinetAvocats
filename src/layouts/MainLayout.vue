<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { getFirstAccessibleRoute, isRouteName, useAccessControl, type AppRouteName } from '../services/access';
import {
  getNeonAuthBaseUrl,
  getNeonAuthToken,
  getNeonAuthTokenSource,
  getNeonDataApiBaseUrl,
  isNeonDataApiEnabled,
  onNeonAuthTokenChange,
} from '../services/api/utils';
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
  { label: 'Modeles', path: '/modeles', icon: 'MD', routeName: 'modeles' },
  { label: 'Documents', path: '/documents', icon: 'DC', routeName: 'documents' },
  { label: 'Schema', path: '/schema', icon: 'SC', routeName: 'schema' },
];

const pageTitle = computed(() => String(route.meta.title ?? 'Dashboard'));
const visibleNavigation = computed(() => navigation.filter((item) => canAccessRoute(item.routeName)));
const todayLabel = computed(() => new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(new Date()));
const greetingLabel = computed(() => {
  const firstName = currentUser.value?.firstName || 'Equipe';
  const hour = new Date().getHours();

  if (hour < 12) {
    return `Bonjour ${firstName}`;
  }

  if (hour < 18) {
    return `Bon apres-midi ${firstName}`;
  }

  return `Bonsoir ${firstName}`;
});
const userInitials = computed(() => {
  const first = (currentUser.value?.firstName ?? '').trim().charAt(0).toUpperCase();
  const last = (currentUser.value?.lastName ?? '').trim().charAt(0).toUpperCase();
  return `${first}${last}` || 'CA';
});
const agencyLabel = computed(() => {
  return currentAgency.value?.name || 'Cabinet Avocats';
});
const isNeonMode = computed(() => isNeonDataApiEnabled());
const neonTokenValue = ref(getNeonAuthToken().trim());
const neonTokenSource = ref(getNeonAuthTokenSource());

function refreshNeonTokenState(): void {
  neonTokenValue.value = getNeonAuthToken().trim();
  neonTokenSource.value = getNeonAuthTokenSource();
}

const neonTokenAvailable = computed(() => Boolean(neonTokenValue.value));
const neonTokenSourceLabel = computed(() => {
  const source = neonTokenSource.value;
  if (source === 'localStorage') {
    return 'localStorage';
  }
  if (source === 'sessionStorage') {
    return 'sessionStorage';
  }
  if (source === 'env') {
    return 'variable VITE_NEON_AUTH_BEARER';
  }
  return 'aucune source detectee';
});
const neonDataApiUrlLabel = computed(() => getNeonDataApiBaseUrl() || 'non configuree');
const neonAuthUrlLabel = computed(() => getNeonAuthBaseUrl() || 'non configuree');
const neonSessionReady = computed(() => Boolean(currentUser.value && currentAgency.value));
const activeSessionLabel = computed(() => {
  if (!currentUser.value || !currentAgency.value) {
    return 'Aucune session active';
  }

  return `${currentUser.value.firstName} ${currentUser.value.lastName} - ${currentUser.value.metier} (${currentAgency.value.label})`;
});

let removeNeonTokenListener: (() => void) | null = null;

onMounted(() => {
  refreshNeonTokenState();
  removeNeonTokenListener = onNeonAuthTokenChange(() => {
    refreshNeonTokenState();
  });
});

onBeforeUnmount(() => {
  removeNeonTokenListener?.();
  removeNeonTokenListener = null;
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
        <div class="topbar-identity">
          <div class="topbar-signature">
            <div class="topbar-signature-main">
              <span class="topbar-signature-mark">CA</span>
              <p class="topbar-signature-agency">{{ agencyLabel }}</p>
            </div>
            <span class="topbar-user-avatar" :title="activeSessionLabel">{{ userInitials }}</span>
          </div>
          <p class="topbar-kicker">{{ greetingLabel }}</p>
          <h1>{{ pageTitle }}</h1>
          <p class="topbar-date">{{ todayLabel }}</p>
          <p class="topbar-session" data-cy="active-session">Session: {{ activeSessionLabel }}</p>
          <div class="topbar-badges">
            <span class="topbar-badge" :class="isNeonMode ? 'is-neon' : 'is-local'">
              {{ isNeonMode ? 'Mode Neon Data API' : 'Mode API locale' }}
            </span>
            <span v-if="isNeonMode" class="topbar-badge" :class="neonTokenAvailable ? 'is-ready' : 'is-missing'">
              {{ neonTokenAvailable ? 'Token Neon present' : 'Token Neon manquant' }}
            </span>
          </div>
          <div v-if="isNeonMode" class="topbar-neon-diagnostics" data-cy="neon-diagnostics">
            <p>
              <strong>Diagnostic Neon</strong>
            </p>
            <p>Data API: {{ neonDataApiUrlLabel }}</p>
            <p>Neon Auth: {{ neonAuthUrlLabel }}</p>
            <p>Session active: {{ neonSessionReady ? 'oui' : 'non' }}</p>
            <p>Source token: {{ neonTokenSourceLabel }}</p>
          </div>
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
