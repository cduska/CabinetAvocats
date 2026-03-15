<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
  }>(),
  {
    description: '',
  },
);

const emit = defineEmits<{
  (event: 'close'): void;
}>();

function closeDrawer(): void {
  emit('close');
}
</script>

<template>
  <transition name="fade">
    <div v-if="props.open" class="drawer-overlay" @click="closeDrawer" />
  </transition>

  <transition name="slide-left">
    <aside v-if="props.open" class="drawer" aria-label="Panneau lateral">
      <header class="drawer-header">
        <div>
          <h2>{{ props.title }}</h2>
          <p>{{ props.description }}</p>
        </div>
        <button class="icon-button" type="button" aria-label="Fermer" @click="closeDrawer">×</button>
      </header>

      <div class="drawer-content">
        <slot />
      </div>

      <footer class="drawer-footer">
        <slot name="footer" />
      </footer>
    </aside>
  </transition>
</template>
