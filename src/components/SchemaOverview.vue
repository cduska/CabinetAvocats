<script setup lang="ts">
import { computed, ref } from 'vue';
import { schemaGroups, schemaTables } from '../data/schema';

const search = ref('');
const groupFilter = ref('all');
const expanded = ref<Record<string, boolean>>({});

const groups = computed(() => ['all', ...schemaGroups]);

const filteredTables = computed(() => {
  const query = search.value.trim().toLowerCase();

  return schemaTables.filter((table) => {
    const groupMatch = groupFilter.value === 'all' || table.group === groupFilter.value;
    if (!groupMatch) {
      return false;
    }

    if (!query) {
      return true;
    }

    const tableMatch = table.name.toLowerCase().includes(query);
    const columnMatch = table.columns.some((column) =>
      `${column.name} ${column.type} ${column.constraints ?? ''} ${column.description ?? ''}`
        .toLowerCase()
        .includes(query),
    );

    return tableMatch || columnMatch;
  });
});

const totalColumns = computed(() => filteredTables.value.reduce((sum, table) => sum + table.columns.length, 0));

function isExpanded(tableName: string): boolean {
  return expanded.value[tableName] ?? false;
}

function toggleTable(tableName: string): void {
  expanded.value = {
    ...expanded.value,
    [tableName]: !isExpanded(tableName),
  };
}
</script>

<template>
  <section class="card schema-overview" data-cy="schema-overview">
    <div class="schema-toolbar">
      <input
        v-model="search"
        class="input"
        type="search"
        placeholder="Filtrer une table ou colonne"
        aria-label="Recherche schema"
      />

      <label>
        Groupe
        <select v-model="groupFilter" class="select" aria-label="Filtre groupe schema">
          <option v-for="group in groups" :key="group" :value="group">
            {{ group === 'all' ? 'Tous les groupes' : group }}
          </option>
        </select>
      </label>
    </div>

    <div class="schema-summary">
      <p>
        <strong>{{ filteredTables.length }}</strong> tables visibles
      </p>
      <p>
        <strong>{{ totalColumns }}</strong> colonnes visibles
      </p>
    </div>

    <div class="schema-grid">
      <article v-for="table in filteredTables" :key="table.name" class="schema-table card-subtle">
        <header class="schema-table-header">
          <div>
            <p class="schema-group">{{ table.group }}</p>
            <h3>{{ table.name }}</h3>
          </div>
          <button class="button button-secondary" type="button" @click="toggleTable(table.name)">
            {{ isExpanded(table.name) ? 'Masquer colonnes' : 'Voir colonnes' }}
          </button>
        </header>

        <table v-if="isExpanded(table.name)" class="schema-columns">
          <thead>
            <tr>
              <th>Colonne</th>
              <th>Type</th>
              <th>Contraintes</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="column in table.columns" :key="`${table.name}-${column.name}`">
              <td>{{ column.name }}</td>
              <td>{{ column.type }}</td>
              <td>{{ column.constraints || '-' }}</td>
              <td>{{ column.description || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  </section>
</template>
