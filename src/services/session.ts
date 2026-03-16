import { computed, reactive, readonly } from 'vue';

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

type UserFixture = readonly [
  id: string,
  firstName: string,
  lastName: string,
  metier: SessionMetier,
  agencyId: string,
];

const agencies: SessionAgency[] = [
  { id: 'paris', label: 'Paris' },
  { id: 'lyon', label: 'Lyon' },
  { id: 'bordeaux', label: 'Bordeaux' },
  { id: 'lille', label: 'Lille' },
];

const userFixtures: readonly UserFixture[] = [
  ['u-claire-martin', 'Claire', 'Martin', 'Associee', 'paris'],
  ['u-lina-perez', 'Lina', 'Perez', 'Juriste', 'paris'],
  ['u-hugo-dubois', 'Hugo', 'Dubois', 'Collaborateur', 'lyon'],
  ['u-noa-bertrand', 'Noa', 'Bertrand', 'Assistante', 'lyon'],
  ['u-emma-ravier', 'Emma', 'Ravier', 'Associee', 'bordeaux'],
  ['u-nora-roux', 'Nora', 'Roux', 'Assistante', 'bordeaux'],
  ['u-yanis-girard', 'Yanis', 'Girard', 'Collaborateur', 'lille'],
  ['u-jade-morel', 'Jade', 'Morel', 'Juriste', 'lille'],
];

const users: SessionUser[] = userFixtures.map(([id, firstName, lastName, metier, agencyId]) => ({
  id,
  firstName,
  lastName,
  metier,
  agencyId,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@cabinet.local`,
}));

const metiers: SessionMetier[] = [...SESSION_METIERS];
const knownMetiers = new Set<SessionMetier>(metiers);

function isKnownAgency(agencyId: string): boolean {
  return agencies.some((agency) => agency.id === agencyId);
}

function isKnownMetier(metier: string): metier is SessionMetier {
  return knownMetiers.has(metier as SessionMetier);
}

function getMetiersForAgency(agencyId: string): SessionMetier[] {
  const values = new Set<SessionMetier>();
  for (const user of users) {
    if (user.agencyId === agencyId) {
      values.add(user.metier);
    }
  }

  return [...values];
}

function getUsersForSelection(agencyId: string, metier: SessionMetier): SessionUser[] {
  return users.filter((user) => user.agencyId === agencyId && user.metier === metier);
}

function buildInitialState(): SessionState {
  const fallbackAgencyId = agencies[0]?.id ?? '';
  const fallbackMetier = getMetiersForAgency(fallbackAgencyId)[0] ?? SESSION_METIERS[0];
  const fallbackUserId = getUsersForSelection(fallbackAgencyId, fallbackMetier)[0]?.id ?? '';

  return {
    agencyId: fallbackAgencyId,
    metier: fallbackMetier,
    userId: fallbackUserId,
  };
}

const state = reactive<SessionState>(buildInitialState());

function normalizeState(): void {
  const fallbackAgencyId = agencies[0]?.id ?? '';

  if (!isKnownAgency(state.agencyId)) {
    state.agencyId = fallbackAgencyId;
  }

  const agencyMetiers = getMetiersForAgency(state.agencyId);
  if (!agencyMetiers.includes(state.metier)) {
    state.metier = agencyMetiers[0] ?? SESSION_METIERS[0];
  }

  const candidates = getUsersForSelection(state.agencyId, state.metier);
  if (!candidates.some((user) => user.id === state.userId)) {
    state.userId = candidates[0]?.id ?? '';
  }
}

normalizeState();

const availableMetiers = computed(() => getMetiersForAgency(state.agencyId));
const availableUsers = computed(() => getUsersForSelection(state.agencyId, state.metier));
const currentUser = computed(() => users.find((user) => user.id === state.userId) ?? null);
const currentAgency = computed(() => agencies.find((agency) => agency.id === state.agencyId) ?? null);

function setAgency(agencyId: string): void {
  state.agencyId = agencyId;
  normalizeState();
}

function setMetier(metier: string): void {
  if (!isKnownMetier(metier)) {
    return;
  }

  state.metier = metier;
  normalizeState();
}

function setUser(userId: string): void {
  const candidates = getUsersForSelection(state.agencyId, state.metier);
  if (!candidates.some((user) => user.id === userId)) {
    return;
  }

  state.userId = userId;
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