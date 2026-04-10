import type { Meta, StoryObj } from '@storybook/vue3-vite';

import DataTable from './DataTable.vue';

const dossiersColumns = [
  { key: 'reference', label: 'Référence', sortable: true },
  { key: 'client', label: 'Client', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'statut', label: 'Statut', align: 'center' as const },
  { key: 'dateOuverture', label: 'Ouverture', sortable: true, align: 'right' as const },
];

const dossiersRows = [
  { id: 1, reference: '2026-001', client: 'Dupont Jean', type: 'Pénal', statut: 'En cours', dateOuverture: '2026-01-10' },
  { id: 2, reference: '2026-002', client: 'Martin Sophie', type: 'Civil', statut: 'En cours', dateOuverture: '2026-01-15' },
  { id: 3, reference: '2026-003', client: 'Leroy Paul', type: 'Commercial', statut: 'Clôturé', dateOuverture: '2026-02-03' },
  { id: 4, reference: '2026-004', client: 'Bernard Claire', type: 'Familial', statut: 'En attente', dateOuverture: '2026-02-18' },
  { id: 5, reference: '2026-005', client: 'Moreau Thomas', type: 'Social', statut: 'En cours', dateOuverture: '2026-03-01' },
  { id: 6, reference: '2026-006', client: 'Laurent Marie', type: 'Civil', statut: 'Clôturé', dateOuverture: '2026-03-05' },
  { id: 7, reference: '2026-007', client: 'Simon Julien', type: 'Pénal', statut: 'En cours', dateOuverture: '2026-03-12' },
  { id: 8, reference: '2026-008', client: 'Michel Anne', type: 'Immobilier', statut: 'En attente', dateOuverture: '2026-03-20' },
  { id: 9, reference: '2026-009', client: 'Garcia Pierre', type: 'Commercial', statut: 'En cours', dateOuverture: '2026-03-22' },
  { id: 10, reference: '2026-010', client: 'Roux Emma', type: 'Familial', statut: 'En cours', dateOuverture: '2026-03-25' },
];

const meta = {
  title: 'UI/DataTable',
  component: DataTable,
  tags: ['autodocs'],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    columns: dossiersColumns,
    rows: dossiersRows,
    searchableFields: ['reference', 'client', 'type', 'statut'],
  },
};

export const Vide: Story = {
  name: 'Table vide',
  args: {
    columns: dossiersColumns,
    rows: [],
    emptyMessage: 'Aucun dossier trouvé.',
  },
};

export const PetiteTable: Story = {
  name: 'Peu de lignes',
  args: {
    columns: [
      { key: 'nom', label: 'Nom', sortable: true },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Rôle', align: 'center' as const },
    ],
    rows: [
      { id: 1, nom: 'Lefebvre Chantal', email: 'c.lefebvre@cabinet.fr', role: 'Avocate associée' },
      { id: 2, nom: 'Nguyen Minh', email: 'm.nguyen@cabinet.fr', role: 'Collaborateur' },
      { id: 3, nom: 'Petit Laura', email: 'l.petit@cabinet.fr', role: 'Secrétaire' },
    ],
  },
};

export const NonTriable: Story = {
  name: 'Colonnes sans tri',
  args: {
    columns: [
      { key: 'reference', label: 'Référence' },
      { key: 'client', label: 'Client' },
      { key: 'statut', label: 'Statut' },
    ],
    rows: dossiersRows.slice(0, 5),
  },
};
