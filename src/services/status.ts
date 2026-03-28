export type StatusPillClass = 'status-ok' | 'status-warn' | 'status-alert' | 'status-neutral';

function normalizeStatus(value: unknown): string {
  if (typeof value === 'string') {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replaceAll(/[\u0300-\u036f]/g, '');
  }

  if (value === null || value === undefined) {
    return '';
  }

  return JSON.stringify(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '');
}

const inProgressStatuses = new Set([
  'en cours',
  'active',
  'actif',
  'ouvert',
  'ouverte',
  'traite',
  'traitee',
  'valide',
  'validation',
]);

const initiatedStatuses = new Set([
  'initie',
  'initiee',
  'cree',
  'creee',
  'nouveau',
  'nouvelle',
  'brouillon',
  'a valider',
  'en preparation',
]);

const closedStatuses = new Set([
  'cloture',
  'clos',
  'terminee',
  'termine',
  'archive',
  'finalisee',
  'finalise',
]);

const alertStatuses = new Set([
  'urgent',
  'en retard',
  'bloque',
  'bloquee',
  'suspendu',
  'suspendue',
  'rejete',
  'rejetee',
]);

export function getStatusColorClass(status: unknown): StatusPillClass {
  const normalized = normalizeStatus(status);

  if (alertStatuses.has(normalized)) {
    return 'status-alert';
  }

  if (closedStatuses.has(normalized)) {
    return 'status-neutral';
  }

  if (inProgressStatuses.has(normalized)) {
    return 'status-ok';
  }

  if (initiatedStatuses.has(normalized)) {
    return 'status-warn';
  }

  return 'status-warn';
}
