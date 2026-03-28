import { useSession, type SessionMetier } from './session';

export type AppRouteName =
  | 'dashboard'
  | 'clients'
  | 'dossiers'
  | 'dossier-detail'
  | 'procedure-detail'
  | 'audiences'
  | 'modeles'
  | 'documents'
  | 'schema';

export type AppAction =
  | 'dashboard:create-dossier'
  | 'dashboard:export-activity'
  | 'clients:create'
  | 'dossiers:create'
  | 'documents:create'
  | 'procedures:plan';

export const routeAccessMatrix: Record<AppRouteName, readonly SessionMetier[]> = {
  dashboard: ['Associee', 'Collaborateur', 'Juriste', 'Assistante'],
  clients: ['Associee', 'Collaborateur', 'Juriste', 'Assistante'],
  dossiers: ['Associee', 'Collaborateur', 'Juriste', 'Assistante'],
  'dossier-detail': ['Associee', 'Collaborateur', 'Juriste', 'Assistante'],
  'procedure-detail': ['Associee', 'Collaborateur', 'Juriste'],
  audiences: ['Associee', 'Collaborateur', 'Juriste', 'Assistante'],
  modeles: ['Associee', 'Collaborateur', 'Juriste'],
  documents: ['Associee', 'Collaborateur', 'Juriste', 'Assistante'],
  schema: ['Associee', 'Collaborateur'],
};

const actionAccessMatrix: Record<AppAction, readonly SessionMetier[]> = {
  'dashboard:create-dossier': ['Associee', 'Collaborateur'],
  'dashboard:export-activity': ['Associee', 'Collaborateur', 'Juriste'],
  'clients:create': ['Associee', 'Collaborateur', 'Assistante'],
  'dossiers:create': ['Associee', 'Collaborateur', 'Juriste'],
  'documents:create': ['Associee', 'Collaborateur', 'Juriste'],
  'procedures:plan': ['Associee', 'Collaborateur', 'Juriste'],
};

const routePriority: AppRouteName[] = ['dashboard', 'clients', 'dossiers', 'audiences', 'modeles', 'documents', 'schema'];

export function isRouteName(value: unknown): value is AppRouteName {
  return typeof value === 'string' && value in routeAccessMatrix;
}

export function canAccessRoute(routeName: AppRouteName, metier: SessionMetier): boolean {
  return routeAccessMatrix[routeName].includes(metier);
}

export function canPerformAction(action: AppAction, metier: SessionMetier): boolean {
  return actionAccessMatrix[action].includes(metier);
}

export function getFirstAccessibleRoute(metier: SessionMetier): AppRouteName {
  return routePriority.find((routeName) => canAccessRoute(routeName, metier)) ?? 'dashboard';
}

export function useAccessControl() {
  const { state } = useSession();

  return {
    canAccessRoute: (routeName: AppRouteName): boolean => canAccessRoute(routeName, state.metier),
    canPerformAction: (action: AppAction): boolean => canPerformAction(action, state.metier),
  };
}