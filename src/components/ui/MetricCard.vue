<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  valueClickable?: boolean;
}>(), {
  valueClickable: false,
});

const emit = defineEmits<{
  'value-click': [];
}>();

function onValueClick() {
  if (!props.valueClickable) {
    return;
  }

  emit('value-click');
}
</script>

<template>
  <article class="card metric-card">
    <p class="metric-label">{{ title }}</p>
    <button
      v-if="valueClickable"
      class="metric-value metric-value-button"
      type="button"
      @click="onValueClick"
    >
      {{ value }}
    </button>
    <p v-else class="metric-value">{{ value }}</p>
    <p :class="['metric-trend', trendUp ? 'trend-up' : 'trend-down']">
      {{ trend }}
    </p>
  </article>
</template>
