<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getProcedureById } from '../services/api';
import type { ProcedureItem } from '../types/domain';

const route = useRoute();
const procedureId = Number(route.params.id);
const procedure = ref<ProcedureItem | undefined>(undefined);
const form = reactive({
  type: '',
  statut: '',
  juridiction: '',
  debut: '',
  fin: '',
});
const error = ref('');

async function loadProcedure() {
  try {
    const apiProcedure = await getProcedureById(procedureId);
    Object.assign(form, apiProcedure);
    procedure.value = apiProcedure;
    error.value = '';
  } catch (e: any) {
    procedure.value = undefined;
    error.value = e?.message || 'Procédure introuvable ou erreur API.';
  }
}

onMounted(loadProcedure);

watch(form, () => {
  // Ici, on pourrait appeler une API pour sauvegarder à chaque changement
  // Par exemple: updateProcedure(form)
}, { deep: true });
</script>

<template>
  <section v-if="procedure" class="procedure-detail">
    <h2>Détail de la procédure {{ procedure.type }}</h2>
    <form class="procedure-form">
      <label>Type <input v-model="form.type" /></label>
      <label>Statut <input v-model="form.statut" /></label>
      <label>Juridiction <input v-model="form.juridiction" /></label>
      <label>Début <input v-model="form.debut" type="date" /></label>
      <label>Fin <input v-model="form.fin" type="date" /></label>
    </form>
    <!-- Instances associées à la procédure pourraient être chargées via API si besoin -->
  </section>
  <section v-else>
    <p>{{ error || 'Procédure introuvable.' }}</p>
  </section>
</template>

<style scoped>
.procedure-detail { max-width: 600px; margin: 2rem auto; }
.procedure-form { display: flex; flex-direction: column; gap: 1rem; }
.procedure-form label { display: flex; flex-direction: column; }
.instances-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.instances-table th, .instances-table td { border: 1px solid #ccc; padding: 0.5rem; }
</style>
