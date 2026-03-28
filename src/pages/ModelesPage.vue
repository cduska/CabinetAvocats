<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import DataTable from '../components/ui/DataTable.vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import {
  createModele,
  generateDocument,
  getModeleById,
  getModeleVersions,
  getModeles,
  getTypesDocument,
  publishModele,
  updateModele,
} from '../services/api';
import type { ModeleDocumentItem, ModeleDocumentVersion, TypeDocument } from '../types/domain';

const rows = ref<ModeleDocumentItem[]>([]);
const versions = ref<ModeleDocumentVersion[]>([]);
const typeDocuments = ref<TypeDocument[]>([]);
const selectedModeleId = ref<number | null>(null);
const selectedVersion = ref<number | null>(null);
const dataSource = ref('');
const error = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const isPublishing = ref(false);
const createDrawerOpen = ref(false);
const generatedDocumentInfo = ref('');

const filters = reactive({
  q: '',
  publishedOnly: false,
});

const form = reactive({
  nomModele: '',
  typeDocumentId: null as number | null,
  description: '',
  contenuJsonText: '{\n  "template": ""\n}',
});

const generateForm = reactive({
  scopeType: 'dossier' as 'dossier' | 'procedure' | 'instance',
  scopeId: null as number | null,
  variablesText: '{\n  "reference": ""\n}',
});

const columns = [
  { key: 'nomModele', label: 'Modele', sortable: true },
  { key: 'typeDocumentLabel', label: 'Type document', sortable: true },
  { key: 'latestVersion', label: 'Version', sortable: true, align: 'center' as const },
  { key: 'published', label: 'Publie', sortable: true, align: 'center' as const },
];

const selectedModele = computed(() => rows.value.find((item) => item.id === selectedModeleId.value));

const canGenerate = computed(() => {
  return selectedModeleId.value !== null
    && selectedVersion.value !== null
    && generateForm.scopeId !== null
    && Number.isFinite(Number(generateForm.scopeId));
});

function formatPublished(value: boolean): string {
  return value ? 'Oui' : 'Non';
}

function parseJson(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Le JSON doit etre un objet.');
  }
  return parsed as Record<string, unknown>;
}

async function loadModeles() {
  isLoading.value = true;
  error.value = '';

  try {
    const [modeles, types] = await Promise.all([
      getModeles({ q: filters.q || undefined, publishedOnly: filters.publishedOnly }),
      getTypesDocument(),
    ]);

    rows.value = modeles.map((row) => ({
      ...row,
      published: Boolean(row.published),
    }));
    typeDocuments.value = types;
    dataSource.value = 'PostgreSQL local';
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Erreur de chargement des modeles.';
    dataSource.value = 'Erreur API';
  } finally {
    isLoading.value = false;
  }
}

async function loadModeleDetail(modeleId: number) {
  try {
    const [detail, history] = await Promise.all([
      getModeleById(modeleId),
      getModeleVersions(modeleId),
    ]);

    form.nomModele = detail.nomModele;
    form.typeDocumentId = detail.typeDocumentId;
    form.description = detail.description;
    form.contenuJsonText = JSON.stringify(detail.contenuJson ?? {}, null, 2);
    versions.value = history;
    selectedVersion.value = history[0]?.numeroVersion ?? null;
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Erreur de chargement du detail modele.';
  }
}

async function selectModele(row: ModeleDocumentItem) {
  selectedModeleId.value = row.id;
  generatedDocumentInfo.value = '';
  await loadModeleDetail(row.id);
}

function openCreateDrawer() {
  createDrawerOpen.value = true;
}

function resetCreateForm() {
  form.nomModele = '';
  form.typeDocumentId = typeDocuments.value[0]?.id ?? null;
  form.description = '';
  form.contenuJsonText = '{\n  "template": ""\n}';
}

async function createNewModele() {
  if (!form.nomModele.trim() || form.typeDocumentId === null) {
    error.value = 'Nom modele et type document sont obligatoires.';
    return;
  }

  isSaving.value = true;
  error.value = '';

  try {
    const contenuJson = parseJson(form.contenuJsonText);
    await createModele({
      nomModele: form.nomModele,
      typeDocumentId: form.typeDocumentId,
      description: form.description,
      contenuJson,
    });

    createDrawerOpen.value = false;
    resetCreateForm();
    await loadModeles();
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Erreur de creation du modele.';
  } finally {
    isSaving.value = false;
  }
}

async function saveModele() {
  if (selectedModeleId.value === null || form.typeDocumentId === null) {
    return;
  }

  isSaving.value = true;
  error.value = '';

  try {
    const contenuJson = parseJson(form.contenuJsonText);
    await updateModele(selectedModeleId.value, {
      nomModele: form.nomModele,
      typeDocumentId: form.typeDocumentId,
      description: form.description,
      contenuJson,
    });

    await Promise.all([loadModeles(), loadModeleDetail(selectedModeleId.value)]);
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Erreur de sauvegarde du modele.';
  } finally {
    isSaving.value = false;
  }
}

async function publishSelectedModele() {
  if (selectedModeleId.value === null) {
    return;
  }

  isPublishing.value = true;
  error.value = '';

  try {
    await publishModele(selectedModeleId.value, {});
    await Promise.all([loadModeles(), loadModeleDetail(selectedModeleId.value)]);
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Erreur de publication.';
  } finally {
    isPublishing.value = false;
  }
}

async function generateFromModele() {
  if (!canGenerate.value || selectedModeleId.value === null || selectedVersion.value === null || generateForm.scopeId === null) {
    return;
  }

  isSaving.value = true;
  error.value = '';

  try {
    const variables = parseJson(generateForm.variablesText);
    const generated = await generateDocument({
      modeleId: selectedModeleId.value,
      numeroVersion: selectedVersion.value,
      scopeType: generateForm.scopeType,
      scopeId: Number(generateForm.scopeId),
      typeDocumentId: form.typeDocumentId ?? undefined,
      variables,
    });

    generatedDocumentInfo.value = `Document genere #${generated.id} (${generated.type})`;
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Erreur de generation du document.';
  } finally {
    isSaving.value = false;
  }
}

resetCreateForm();
onMounted(() => {
  void loadModeles();
});
</script>

<template>
  <section class="page-grid" data-cy="modeles-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Gestion des modeles documentaires</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
        <p v-if="error" class="action-bar-caption autosave-error">{{ error }}</p>
        <p v-if="generatedDocumentInfo" class="action-bar-caption">{{ generatedDocumentInfo }}</p>
      </div>
      <div class="action-bar-actions">
        <button class="button button-secondary" type="button" :disabled="isLoading" @click="loadModeles">Rafraichir</button>
        <button class="button" type="button" @click="openCreateDrawer">Nouveau modele</button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows.map((row) => ({ ...row, published: formatPublished(Boolean(row.published)) }))"
      :searchable-fields="['nomModele', 'typeDocumentLabel']"
      empty-message="Aucun modele documentaire."
      @row-click="selectModele"
    >
      <template #filters>
        <label>
          Recherche
          <input v-model="filters.q" class="input" placeholder="Nom ou description" />
        </label>
        <label>
          Publies uniquement
          <input v-model="filters.publishedOnly" type="checkbox" />
        </label>
        <button class="button button-secondary" type="button" :disabled="isLoading" @click="loadModeles">Appliquer</button>
      </template>
    </DataTable>

    <div v-if="selectedModele" class="card modele-detail-card">
      <div class="block-header">
        <p class="action-bar-title">Edition du modele</p>
        <p class="action-bar-caption">Modele #{{ selectedModele.id }}</p>
      </div>

      <form class="form-grid" @submit.prevent="saveModele">
        <label>
          Nom modele
          <input v-model="form.nomModele" class="input" required />
        </label>

        <label>
          Type document
          <select v-model="form.typeDocumentId" class="input" required>
            <option value="" disabled>Choisir un type</option>
            <option v-for="typeDoc in typeDocuments" :key="typeDoc.id" :value="typeDoc.id">{{ typeDoc.libelle }}</option>
          </select>
        </label>

        <label>
          Description
          <textarea v-model="form.description" class="input" rows="2" />
        </label>

        <label>
          Contenu JSON
          <textarea v-model="form.contenuJsonText" class="input json-editor" rows="12" />
        </label>
      </form>

      <div class="modele-actions">
        <button class="button button-secondary" type="button" :disabled="isSaving" @click="saveModele">
          {{ isSaving ? 'Sauvegarde...' : 'Sauvegarder brouillon' }}
        </button>
        <button class="button" type="button" :disabled="isPublishing" @click="publishSelectedModele">
          {{ isPublishing ? 'Publication...' : 'Publier version' }}
        </button>
      </div>

      <div class="version-block">
        <p class="action-bar-title">Versions publiees</p>
        <select v-model="selectedVersion" class="input">
          <option v-if="versions.length === 0" :value="null">Aucune version</option>
          <option v-for="version in versions" :key="version.id" :value="version.numeroVersion">
            v{{ version.numeroVersion }} - {{ version.creeLe || 'date inconnue' }}
          </option>
        </select>
      </div>

      <div class="version-block">
        <p class="action-bar-title">Generation de document</p>
        <form class="form-grid" @submit.prevent="generateFromModele">
          <label>
            Scope
            <select v-model="generateForm.scopeType" class="input">
              <option value="dossier">Dossier</option>
              <option value="procedure">Procedure</option>
              <option value="instance">Instance</option>
            </select>
          </label>
          <label>
            ID scope
            <input v-model.number="generateForm.scopeId" class="input" type="number" min="1" />
          </label>
          <label>
            Variables JSON
            <textarea v-model="generateForm.variablesText" class="input json-editor" rows="8" />
          </label>
        </form>
        <button class="button" type="button" :disabled="!canGenerate || isSaving" @click="generateFromModele">
          {{ isSaving ? 'Generation...' : 'Generer document' }}
        </button>
      </div>
    </div>

    <DrawerPanel
      :open="createDrawerOpen"
      title="Creation de modele"
      description="Creer un nouveau modele documentaire"
      @close="createDrawerOpen = false"
    >
      <form class="form-grid" @submit.prevent="createNewModele">
        <label>
          Nom modele
          <input v-model="form.nomModele" class="input" required />
        </label>
        <label>
          Type document
          <select v-model="form.typeDocumentId" class="input" required>
            <option value="" disabled>Choisir un type</option>
            <option v-for="typeDoc in typeDocuments" :key="typeDoc.id" :value="typeDoc.id">{{ typeDoc.libelle }}</option>
          </select>
        </label>
        <label>
          Description
          <textarea v-model="form.description" class="input" rows="2" />
        </label>
        <label>
          Contenu JSON
          <textarea v-model="form.contenuJsonText" class="input json-editor" rows="10" />
        </label>
      </form>

      <template #footer>
        <button class="button button-secondary" type="button" @click="createDrawerOpen = false">Annuler</button>
        <button class="button" type="button" :disabled="isSaving" @click="createNewModele">
          {{ isSaving ? 'Creation...' : 'Creer' }}
        </button>
      </template>
    </DrawerPanel>
  </section>
</template>

<style scoped>
.modele-detail-card {
  display: grid;
  gap: 0.8rem;
}

.modele-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.version-block {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid var(--border-color);
  padding-top: 0.7rem;
}

.json-editor {
  font-family: 'Consolas', 'Monaco', monospace;
}

.autosave-error {
  color: #ac1739;
}
</style>
