<script setup lang="ts">
defineProps<{
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
}>();
</script>

<template>
  <article class="card metric-card">
    <p class="metric-label">{{ title }}</p>
    <p class="metric-value">{{ value }}</p>
    <p :class="['metric-trend', trendUp ? 'trend-up' : 'trend-down']">
      {{ trend }}
    </p>
  </article>
</template>
