<script setup lang="ts">

import { ref, reactive, watch, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAgences, getClients, getDossierById, getProcedures, getStatutsDossier, getTypesDossier } from '../services/api';
import type { Dossier, StatutDossier, TypeDossier, Agence, Client, ProcedureItem } from '../types/domain';

const route = useRoute();
const router = useRouter();

const dossierId = Number(route.params.id);
const dossier = ref<Dossier | undefined>(undefined);
const form = reactive({
  reference: '',
  client: null as number | null,
  type: null as number | null,
  statut: null as number | null,
  agence: null as number | null,
  ouverture: '',
  echeance: '',
  montant: 0,
});

const statuts = ref<StatutDossier[]>([]);
const types = ref<TypeDossier[]>([]);
const agences = ref<Agence[]>([]);
const clients = ref<Client[]>([]);
const procedures = ref<ProcedureItem[]>([]);

async function loadReferences() {
  [statuts.value, types.value, agences.value, clients.value] = await Promise.all([
    getStatutsDossier(),
    getTypesDossier(),
    getAgences(),
    getClients(),
  ]);
}

async function loadProcedures() {
  procedures.value = await getProcedures();
}

async function loadDossier() {
  await Promise.all([loadReferences(), loadProcedures()]);
  try {
    const apiDossier = await getDossierById(dossierId);
    // Map API dossier to form using IDs
    form.reference = apiDossier.reference;
    form.client = clients.value.find(c => c.id === Number(apiDossier.client))?.id ?? null;
    form.type = types.value.find(t => t.id === Number(apiDossier.type))?.id ?? null;
    form.statut = statuts.value.find(s => s.id === Number(apiDossier.statut))?.id ?? null;
    form.agence = agences.value.find(a => a.id === Number(apiDossier.agence))?.id ?? null;
    form.ouverture = apiDossier.ouverture;
    form.echeance = apiDossier.echeance;
    form.montant = apiDossier.montant;
    dossier.value = apiDossier;
  } catch {
    dossier.value = undefined;
  }
}

onMounted(loadDossier);

watch(form, () => {
  // Ici, on pourrait appeler une API pour sauvegarder à chaque changement
  // Par exemple: updateDossier(form)
}, { deep: true });

const dossierProcedures = computed(() =>
  procedures.value.filter(p => p.dossierReference === form.reference)
);

function goToProcedure(procId: number) {
  router.push({ name: 'procedure-detail', params: { id: procId } });
}
</script>

<template>
  <section v-if="dossier" class="dossier-detail">
    <h2>Détail du dossier {{ dossier.reference }}</h2>
    <form class="dossier-form">
      <label>Référence <input v-model="form.reference" /></label>
      <label>Client
        <select v-model="form.client">
          <option value="" disabled>Choisir un client</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">
            {{ c.nom }} {{ c.prenom }}
          </option>
        </select>
      </label>
      <label>Type
        <select v-model="form.type">
          <option value="" disabled>Choisir un type</option>
          <option v-for="t in types" :key="t.id" :value="t.id">{{ t.libelle }}</option>
        </select>
      </label>
      <label>Statut
        <select v-model="form.statut">
          <option value="" disabled>Choisir un statut</option>
          <option v-for="s in statuts" :key="s.id" :value="s.id">{{ s.libelle }}</option>
        </select>
      </label>
      <label>Agence
        <select v-model="form.agence">
          <option value="" disabled>Choisir une agence</option>
          <option v-for="a in agences" :key="a.id" :value="a.id">{{ a.nom }}</option>
        </select>
      </label>
      <label>Ouverture <input v-model="form.ouverture" type="date" /></label>
      <label>Échéance <input v-model="form.echeance" type="date" /></label>
      <label>Montant <input v-model.number="form.montant" type="number" /></label>
    </form>
    <h3>Procédures associées</h3>
    <ul>
      <li v-for="proc in dossierProcedures" :key="proc.id">
        <a href="#" @click.prevent="goToProcedure(proc.id)">{{ proc.type }} ({{ proc.statut }})</a>
      </li>
    </ul>
  </section>
  <section v-else>
    <p>Dossier introuvable.</p>
  </section>
    <section class="page-grid">
      <div v-if="dossier">
        <div class="action-bar card">
          <div>
            <p class="action-bar-title">Détail du dossier</p>
            <p class="action-bar-caption">Référence : <strong>{{ dossier.reference }}</strong></p>
          </div>
        </div>
        <div class="card" style="margin-top:1.2rem;">
          <form class="form-grid">
            <label>
              Référence
              <input v-model="form.reference" class="input" />
            </label>
            <label>
              Client
              <select v-model="form.client" class="input">
                <option value="" disabled>Choisir un client</option>
                <option v-for="c in clients" :key="c.id" :value="c.id">
                  {{ c.nom }} {{ c.prenom }}
                </option>
              </select>
            </label>
            <label>
              Type
              <select v-model="form.type" class="input">
                <option value="" disabled>Choisir un type</option>
                <option v-for="t in types" :key="t.id" :value="t.id">{{ t.libelle }}</option>
              </select>
            </label>
            <label>
              Statut
              <select v-model="form.statut" class="input">
                <option value="" disabled>Choisir un statut</option>
                <option v-for="s in statuts" :key="s.id" :value="s.id">{{ s.libelle }}</option>
              </select>
            </label>
            <label>
              Agence
              <select v-model="form.agence" class="input">
                <option value="" disabled>Choisir une agence</option>
                <option v-for="a in agences" :key="a.id" :value="a.id">{{ a.nom }}</option>
              </select>
            </label>
            <label>
              Ouverture
              <input v-model="form.ouverture" class="input" type="date" />
            </label>
            <label>
              Échéance
              <input v-model="form.echeance" class="input" type="date" />
            </label>
            <label>
              Montant
              <input v-model.number="form.montant" class="input" type="number" />
            </label>
          </form>
        </div>
        <div class="card" style="margin-top:1.2rem;">
          <h3>Procédures associées</h3>
          <ul class="list-rows">
            <li v-for="proc in dossierProcedures" :key="proc.id" class="list-row">
              <span class="list-row-title">{{ proc.type }}</span>
              <span class="list-row-subtitle">{{ proc.statut }}</span>
              <button class="button button-secondary" @click.prevent="goToProcedure(proc.id)">Voir</button>
            </li>
          </ul>
        </div>
      </div>
      <div v-else class="card" style="padding:2rem;text-align:center;">
        <p>Dossier introuvable.</p>
      </div>
    </section>
</template>

<style scoped>
.dossier-detail { max-width: 600px; margin: 2rem auto; }
.dossier-form { display: flex; flex-direction: column; gap: 1rem; }
.dossier-form label { display: flex; flex-direction: column; }
.form-grid {
  max-width: 600px;
  margin: 0 auto;
}
</style>
