import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { fn } from 'storybook/test';

import DrawerPanel from './DrawerPanel.vue';

const meta = {
  title: 'UI/DrawerPanel',
  component: DrawerPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    open: { control: 'boolean' },
    title: { control: 'text' },
    description: { control: 'text' },
  },
  args: {
    open: true,
    onClose: fn(),
  },
} satisfies Meta<typeof DrawerPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Détail du dossier',
    description: 'Informations relatives au dossier sélectionné.',
  },
};

export const SansDescription: Story = {
  name: 'Sans description',
  args: {
    title: 'Informations client',
  },
};

export const AvecContenu: Story = {
  name: 'Avec contenu',
  args: {
    title: 'Dossier — Dupont c/ Martin',
    description: 'Procédure civile — Tribunal judiciaire de Paris',
  },
  render: (args) => ({
    components: { DrawerPanel },
    setup() {
      return { args };
    },
    template: `
      <DrawerPanel v-bind="args">
        <dl style="display:grid;gap:0.5rem">
          <dt style="font-weight:600">Référence</dt>
          <dd>2026-042</dd>
          <dt style="font-weight:600">Statut</dt>
          <dd>En cours</dd>
          <dt style="font-weight:600">Date d'ouverture</dt>
          <dd>15 mars 2026</dd>
          <dt style="font-weight:600">Avocat responsable</dt>
          <dd>Me. Lefebvre</dd>
        </dl>
        <template #footer>
          <button type="button" style="margin-right:0.5rem">Modifier</button>
          <button type="button">Clôturer</button>
        </template>
      </DrawerPanel>
    `,
  }),
};

export const Ferme: Story = {
  name: 'Fermé',
  args: {
    open: false,
    title: 'Panneau fermé',
    description: 'Ce panneau est invisible.',
  },
};
