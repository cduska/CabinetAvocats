<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[];
    rows: Record<string, unknown>[];
    searchableFields?: string[];
    rowKey?: string;
    emptyMessage?: string;
  }>(),
  {
    searchableFields: () => [],
    rowKey: 'id',
    emptyMessage: 'Aucune donnee a afficher.',
  },
);

const search = ref('');
const sortKey = ref('');
const sortDirection = ref<'asc' | 'desc'>('asc');
const page = ref(1);
const pageSize = ref(8);

const searchTargets = computed(() => {
  if (props.searchableFields.length > 0) {
    return props.searchableFields;
  }

  return props.columns.map((column) => column.key);
});

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) {
    return props.rows;
  }

  return props.rows.filter((row) =>
    searchTargets.value.some((field) => String(row[field] ?? '').toLowerCase().includes(query)),
  );
});

const sortedRows = computed(() => {
  if (!sortKey.value) {
    return filteredRows.value;
  }

  return [...filteredRows.value].sort((a, b) => {
    const leftValue = String(a[sortKey.value] ?? '').toLowerCase();
    const rightValue = String(b[sortKey.value] ?? '').toLowerCase();

    const base = leftValue.localeCompare(rightValue, 'fr');
    return sortDirection.value === 'asc' ? base : -base;
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / pageSize.value)));

const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return sortedRows.value.slice(start, end);
});

watch([filteredRows, pageSize], () => {
  if (page.value > totalPages.value) {
    page.value = totalPages.value;
  }
});

function setSorting(column: TableColumn): void {
  if (!column.sortable) {
    return;
  }

  if (sortKey.value === column.key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    return;
  }

  sortKey.value = column.key;
  sortDirection.value = 'asc';
}

function previousPage(): void {
  page.value = Math.max(1, page.value - 1);
}

function nextPage(): void {
  page.value = Math.min(totalPages.value, page.value + 1);
}

function alignmentClass(align: TableColumn['align']): string {
  if (!align || align === 'left') {
    return 'align-left';
  }

  if (align === 'center') {
    return 'align-center';
  }

  return 'align-right';
}
</script>

<template>
  <section class="card data-table" data-cy="data-table">
    <div class="data-table-toolbar">
      <input
        v-model="search"
        class="input"
        type="search"
        placeholder="Rechercher"
        aria-label="Rechercher"
        data-cy="table-search"
      />
      <div class="data-table-toolbar-filters">
        <slot name="filters" />
      </div>
    </div>

    <div class="data-table-summary">
      <strong>{{ sortedRows.length }}</strong>
      resultat(s)
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="alignmentClass(column.align)"
              scope="col"
            >
              <button
                v-if="column.sortable"
                class="sort-button"
                type="button"
                @click="setSorting(column)"
              >
                {{ column.label }}
                <span v-if="sortKey === column.key">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
              </button>
              <span v-else>{{ column.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="paginatedRows.length === 0">
            <td :colspan="columns.length" class="empty-row">{{ emptyMessage }}</td>
          </tr>
          <tr v-for="(row, rowIndex) in paginatedRows" :key="String(row[rowKey] ?? rowIndex)" class="data-table-row" @click="$emit('row-click', row)" style="cursor:pointer">
            <td
              v-for="column in columns"
              :key="`${String(row[rowKey] ?? `row-${rowIndex}`)}-${column.key}`"
              :class="alignmentClass(column.align)"
            >
              <slot
                :name="`cell-${column.key}`"
                :row="row"
                :value="row[column.key]"
              >
                {{ row[column.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="data-table-pagination">
      <label>
        Lignes
        <select v-model.number="pageSize" class="select" aria-label="Nombre de lignes">
          <option :value="8">8</option>
          <option :value="15">15</option>
          <option :value="30">30</option>
        </select>
      </label>

      <div class="data-table-pagination-actions">
        <button class="button button-secondary" type="button" :disabled="page <= 1" @click="previousPage">
          Precedent
        </button>
        <span>Page {{ page }} / {{ totalPages }}</span>
        <button
          class="button button-secondary"
          type="button"
          :disabled="page >= totalPages"
          @click="nextPage"
        >
          Suivant
        </button>
      </div>
    </div>
  </section>
</template>
