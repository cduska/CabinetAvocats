<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import DataTable from '../components/ui/DataTable.vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import {
  createParagraphe,
  deleteParagraphe,
  getParagrapheCategories,
  getParagraphes,
  updateParagraphe,
} from '../services/api';
import type { ParagraphePredefini } from '../types/domain';

const rows = ref<ParagraphePredefini[]>([]);
const categories = ref<string[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const error = ref('');
const createDrawerOpen = ref(false);
const selectedId = ref<number | null>(null);
const filterCategorie = ref('');

const form = reactive({
  titre: '',
  categorie: '',
  contenu: '',
  ordre: null as number | null,
});

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'titre', label: 'Titre', sortable: true },
  { key: 'categorie', label: 'Catégorie', sortable: true },
  { key: 'contenuPreview', label: 'Contenu', sortable: false },
  { key: 'ordre', label: 'Ordre', sortable: true, align: 'center' as const },
];

const filteredRows = computed(() => {
  const cat = filterCategorie.value;
  return cat ? rows.value.filter((p) => p.categorie === cat) : rows.value;
});

function mapRows(items: ParagraphePredefini[]) {
  return items.map((p) => ({
    ...p,
    titre: p.titre ?? '—',
    categorie: p.categorie ?? '—',
    contenuPreview: p.contenu.length > 100 ? `${p.contenu.slice(0, 100)}…` : p.contenu,
  }));
}

const selected = ref<ParagraphePredefini | null>(null);

async function loadParagraphes() {
  isLoading.value = true;
  error.value = '';
  try {
    const [items, cats] = await Promise.all([getParagraphes(), getParagrapheCategories()]);
    rows.value = items;
    categories.value = cats;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement.';
  } finally {
    isLoading.value = false;
  }
}

function selectRow(row: Record<string, unknown>) {
  const item = rows.value.find((p) => p.id === row.id);
  if (!item) return;
  selected.value = item;
  selectedId.value = item.id;
  form.titre = item.titre ?? '';
  form.categorie = item.categorie ?? '';
  form.contenu = item.contenu;
  form.ordre = item.ordre;
}

function openCreateDrawer() {
  form.titre = '';
  form.categorie = '';
  form.contenu = '';
  form.ordre = null;
  createDrawerOpen.value = true;
}

async function createNew() {
  if (!form.contenu.trim()) {
    error.value = 'Le contenu est obligatoire.';
    return;
  }
  isSaving.value = true;
  error.value = '';
  try {
    const created = await createParagraphe({
      contenu: form.contenu.trim(),
      titre: form.titre.trim() || null,
      categorie: form.categorie.trim() || null,
      ordre: form.ordre,
    });
    rows.value = [...rows.value, created].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.id - b.id);
    if (created.categorie && !categories.value.includes(created.categorie)) {
      categories.value = [...categories.value, created.categorie].sort();
    }
    createDrawerOpen.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de création.';
  } finally {
    isSaving.value = false;
  }
}

async function saveSelected() {
  if (selectedId.value === null || !form.contenu.trim()) return;
  isSaving.value = true;
  error.value = '';
  try {
    const updated = await updateParagraphe(selectedId.value, {
      contenu: form.contenu.trim(),
      titre: form.titre.trim() || null,
      categorie: form.categorie.trim() || null,
      ordre: form.ordre,
    });
    rows.value = rows.value.map((p) => (p.id === updated.id ? updated : p));
    selected.value = updated;
    if (updated.categorie && !categories.value.includes(updated.categorie)) {
      categories.value = [...categories.value, updated.categorie].sort();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de sauvegarde.';
  } finally {
    isSaving.value = false;
  }
}

async function deleteSelected() {
  if (selectedId.value === null) return;
  if (!confirm('Supprimer ce paragraphe prédéfini ?')) return;
  isSaving.value = true;
  error.value = '';
  try {
    await deleteParagraphe(selectedId.value);
    rows.value = rows.value.filter((p) => p.id !== selectedId.value);
    selected.value = null;
    selectedId.value = null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de suppression.';
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void loadParagraphes();
});
</script>

<template>
  <section class="page-grid" data-cy="paragraphes-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Bibliothèque de paragraphes prédéfinis</p>
        <p class="action-bar-caption">Paragraphes réutilisables dans l'éditeur de documents</p>
        <p v-if="error" class="action-bar-caption autosave-error">{{ error }}</p>
      </div>
      <div class="action-bar-actions">
        <button class="button button-secondary" type="button" :disabled="isLoading" @click="loadParagraphes">Rafraîchir</button>
        <button class="button" type="button" @click="openCreateDrawer">Nouveau paragraphe</button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="mapRows(filteredRows)"
      :searchable-fields="['titre', 'categorie', 'contenuPreview']"
      empty-message="Aucun paragraphe prédéfini."
      @row-click="selectRow"
    >
      <template #filters>
        <label>
          Catégorie
          <select v-model="filterCategorie" class="select">
            <option value="">Toutes</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </label>
      </template>
    </DataTable>

    <div v-if="selected" class="card detail-card">
      <div class="block-header">
        <p class="action-bar-title">Édition du paragraphe</p>
        <p class="action-bar-caption">Paragraphe #{{ selected.id }}</p>
      </div>

      <form class="form-grid" @submit.prevent="saveSelected">
        <label>
          Titre
          <input v-model="form.titre" class="input" placeholder="Ex : Introduction standard" />
        </label>
        <label>
          Catégorie
          <input v-model="form.categorie" class="input" list="cat-list" placeholder="Ex : Conclusions" />
          <datalist id="cat-list">
            <option v-for="cat in categories" :key="cat" :value="cat" />
          </datalist>
        </label>
        <label>
          Ordre (optionnel)
          <input v-model.number="form.ordre" class="input" type="number" min="0" placeholder="0" />
        </label>
        <div class="label-block-full">
          <label>
            Contenu
            <textarea v-model="form.contenu" class="input para-textarea" rows="8" required />
          </label>
        </div>
      </form>

      <div class="detail-actions">
        <button class="button button-secondary" type="button" :disabled="isSaving" @click="saveSelected">
          {{ isSaving ? 'Sauvegarde…' : 'Sauvegarder' }}
        </button>
        <button class="button button-danger" type="button" :disabled="isSaving" @click="deleteSelected">
          Supprimer
        </button>
      </div>
    </div>

    <DrawerPanel
      :open="createDrawerOpen"
      title="Nouveau paragraphe"
      description="Créer un paragraphe prédéfini réutilisable"
      @close="createDrawerOpen = false"
    >
      <form class="form-grid" @submit.prevent="createNew">
        <label>
          Titre
          <input v-model="form.titre" class="input" placeholder="Ex : Introduction standard" />
        </label>
        <label>
          Catégorie
          <input v-model="form.categorie" class="input" list="cat-list-create" placeholder="Ex : Conclusions" />
          <datalist id="cat-list-create">
            <option v-for="cat in categories" :key="cat" :value="cat" />
          </datalist>
        </label>
        <label>
          Ordre (optionnel)
          <input v-model.number="form.ordre" class="input" type="number" min="0" placeholder="0" />
        </label>
        <label class="label-full">
          <span>Contenu <span class="required-star">*</span></span>
          <textarea v-model="form.contenu" class="input para-textarea" rows="10" required placeholder="Rédigez votre paragraphe…" />
        </label>
      </form>

      <template #footer>
        <button class="button button-secondary" type="button" @click="createDrawerOpen = false">Annuler</button>
        <button class="button" type="button" :disabled="isSaving || !form.contenu.trim()" @click="createNew">
          {{ isSaving ? 'Création…' : 'Créer' }}
        </button>
      </template>
    </DrawerPanel>
  </section>
</template>

<style scoped>
.detail-card {
  display: grid;
  gap: 0.8rem;
}

.block-header {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.detail-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.label-block-full {
  grid-column: 1 / -1;
}

.label-full {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.88rem;
  font-weight: 500;
}

.para-textarea {
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
}

.required-star {
  color: var(--color-danger, #dc2626);
}

.button-danger {
  background: #dc2626;
  color: #fff;
  border-color: #dc2626;
}

.button-danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}

.autosave-error {
  color: #ac1739;
}
</style>
