import { computed, reactive, readonly } from 'vue';

const STORAGE_KEY = 'cabinet-session-v1';
const SESSION_METIERS = ['Associee', 'Collaborateur', 'Juriste', 'Assistante'] as const;

export type SessionMetier = (typeof SESSION_METIERS)[number];

export interface SessionAgency {
  id: string;
  label: string;
}

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  metier: SessionMetier;
  agencyId: string;
  email: string;
}

interface SessionState {
  agencyId: string;
  metier: SessionMetier;
  userId: string;
}

const agencies: SessionAgency[] = [
  { id: 'paris', label: 'Paris' },
  { id: 'lyon', label: 'Lyon' },
  { id: 'bordeaux', label: 'Bordeaux' },
  { id: 'lille', label: 'Lille' },
];

const users: SessionUser[] = [
  {
    id: 'u-claire-martin',
    firstName: 'Claire',
    lastName: 'Martin',
    metier: 'Associee',
    agencyId: 'paris',
    email: 'claire.martin@cabinet.local',
  },
  {
    id: 'u-lina-perez',
    firstName: 'Lina',
    lastName: 'Perez',
    metier: 'Juriste',
    agencyId: 'paris',
    email: 'lina.perez@cabinet.local',
  },
  {
    id: 'u-hugo-dubois',
    firstName: 'Hugo',
    lastName: 'Dubois',
    metier: 'Collaborateur',
    agencyId: 'lyon',
    email: 'hugo.dubois@cabinet.local',
  },
  {
    id: 'u-noa-bertrand',
    firstName: 'Noa',
    lastName: 'Bertrand',
    metier: 'Assistante',
    agencyId: 'lyon',
    email: 'noa.bertrand@cabinet.local',
  },
  {
    id: 'u-emma-ravier',
    firstName: 'Emma',
    lastName: 'Ravier',
    metier: 'Associee',
    agencyId: 'bordeaux',
    email: 'emma.ravier@cabinet.local',
  },
  {
    id: 'u-nora-roux',
    firstName: 'Nora',
    lastName: 'Roux',
    metier: 'Assistante',
    agencyId: 'bordeaux',
    email: 'nora.roux@cabinet.local',
  },
  {
    id: 'u-yanis-girard',
    firstName: 'Yanis',
    lastName: 'Girard',
    metier: 'Collaborateur',
    agencyId: 'lille',
    email: 'yanis.girard@cabinet.local',
  },
  {
    id: 'u-jade-morel',
    firstName: 'Jade',
    lastName: 'Morel',
    metier: 'Juriste',
    agencyId: 'lille',
    email: 'jade.morel@cabinet.local',
  },
];

const metiers = [...SESSION_METIERS];

function readPersistedState(): Partial<SessionState> | null {
  if (globalThis.window === undefined) {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as Partial<SessionState>;
  } catch {
    return null;
  }
}

function persistState(state: SessionState): void {
  if (globalThis.window === undefined) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isKnownAgency(agencyId: string): boolean {
  return agencies.some((agency) => agency.id === agencyId);
}

function isKnownMetier(metier: string): metier is SessionMetier {
  return metiers.includes(metier as SessionMetier);
}

function getMetiersForAgency(agencyId: string): SessionMetier[] {
  return Array.from(new Set(users.filter((user) => user.agencyId === agencyId).map((user) => user.metier)));
}

function getUsersForSelection(agencyId: string, metier: SessionMetier): SessionUser[] {
  return users.filter((user) => user.agencyId === agencyId && user.metier === metier);
}

const persisted = readPersistedState();

const fallbackAgencyId = agencies[0]?.id ?? '';
const initialAgencyId = persisted?.agencyId && isKnownAgency(persisted.agencyId) ? persisted.agencyId : fallbackAgencyId;
const fallbackMetier = getMetiersForAgency(initialAgencyId)[0] ?? metiers[0] ?? '';
const persistedMetier = persisted?.metier;
const initialMetier =
  persistedMetier &&
  isKnownMetier(persistedMetier) &&
  getMetiersForAgency(initialAgencyId).includes(persistedMetier)
    ? persistedMetier
    : fallbackMetier;
const fallbackUserId = getUsersForSelection(initialAgencyId, initialMetier)[0]?.id ?? '';

const state = reactive<SessionState>({
  agencyId: initialAgencyId,
  metier: initialMetier,
  userId: fallbackUserId,
});

if (persisted?.userId && getUsersForSelection(state.agencyId, state.metier).some((user) => user.id === persisted.userId)) {
  state.userId = persisted.userId;
}

function normalizeState(): void {
  if (!isKnownAgency(state.agencyId)) {
    state.agencyId = fallbackAgencyId;
  }

  const agencyMetiers = getMetiersForAgency(state.agencyId);
  if (!agencyMetiers.includes(state.metier)) {
    state.metier = agencyMetiers[0] ?? '';
  }

  const candidates = getUsersForSelection(state.agencyId, state.metier);
  if (!candidates.some((user) => user.id === state.userId)) {
    state.userId = candidates[0]?.id ?? '';
  }
}

normalizeState();
persistState(state);

const availableMetiers = computed(() => getMetiersForAgency(state.agencyId));
const availableUsers = computed(() => getUsersForSelection(state.agencyId, state.metier));
const currentUser = computed(() => users.find((user) => user.id === state.userId) ?? null);
const currentAgency = computed(() => agencies.find((agency) => agency.id === state.agencyId) ?? null);

function setAgency(agencyId: string): void {
  state.agencyId = agencyId;
  normalizeState();
  persistState(state);
}

function setMetier(metier: string): void {
  if (!isKnownMetier(metier)) {
    return;
  }

  state.metier = metier;
  normalizeState();
  persistState(state);
}

function setUser(userId: string): void {
  const candidates = getUsersForSelection(state.agencyId, state.metier);
  if (!candidates.some((user) => user.id === userId)) {
    return;
  }

  state.userId = userId;
  persistState(state);
}

export function getSessionHeaders(): Record<string, string> {
  const user = currentUser.value;
  const agency = currentAgency.value;

  return {
    'X-Session-Agency': agency?.label ?? '',
    'X-Session-Metier': state.metier,
    'X-Session-User-Id': user?.id ?? '',
    'X-Session-User': user ? `${user.firstName} ${user.lastName}` : '',
  };
}

export function getCurrentMetier(): SessionMetier {
  return state.metier;
}

export function useSession() {
  return {
    agencies,
    metiers,
    users,
    state: readonly(state),
    availableMetiers,
    availableUsers,
    currentUser,
    currentAgency,
    setAgency,
    setMetier,
    setUser,
  };
}