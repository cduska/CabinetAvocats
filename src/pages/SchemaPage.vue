<script setup lang="ts">
import SchemaOverview from '../components/SchemaOverview.vue';
</script>

<template>
  <section class="page-grid" data-cy="schema-page">
    <div class="action-bar card">
      <p class="action-bar-title">Vue schema SQL</p>
      <p class="action-bar-caption">Source: schema_complet.sql et schema_base.md</p>
    </div>

    <SchemaOverview />
  </section>
</template>
