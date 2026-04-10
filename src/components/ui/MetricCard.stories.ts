import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { fn } from 'storybook/test';

import MetricCard from './MetricCard.vue';

const meta = {
  title: 'UI/MetricCard',
  component: MetricCard,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    value: { control: 'text' },
    trend: { control: 'text' },
    trendUp: { control: 'boolean' },
    valueClickable: { control: 'boolean' },
  },
  args: {
    'onValue-click': fn(),
  },
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Dossiers actifs',
    value: '42',
    trend: '+5 ce mois',
    trendUp: true,
  },
};

export const TendanceHausse: Story = {
  name: 'Tendance à la hausse',
  args: {
    title: 'Nouvelles affaires',
    value: '18',
    trend: '+6 ce mois',
    trendUp: true,
  },
};

export const TendanceBaisse: Story = {
  name: 'Tendance à la baisse',
  args: {
    title: 'Affaires clôturées',
    value: '3',
    trend: '-4 ce mois',
    trendUp: false,
  },
};

export const ValeurCliquable: Story = {
  name: 'Valeur cliquable',
  args: {
    title: 'Clients',
    value: '128',
    trend: '+12 ce mois',
    trendUp: true,
    valueClickable: true,
  },
};
