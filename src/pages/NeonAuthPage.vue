<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  clearNeonAuthToken,
  getNeonAuthToken,
  isNeonDataApiEnabled,
  requestNeonRest,
  setNeonAuthToken,
} from '../services/api/utils';

const tokenInput = ref('');
const statusMessage = ref('');
const statusTone = ref<'ok' | 'error' | ''>('');
const testing = ref(false);

const neonModeEnabled = computed(() => isNeonDataApiEnabled());
const hasStoredToken = computed(() => Boolean(getNeonAuthToken().trim()));

function setStatus(message: string, tone: 'ok' | 'error' | ''): void {
  statusMessage.value = message;
  statusTone.value = tone;
}

function saveToken(): void {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus('Saisissez un JWT Neon avant de valider.', 'error');
    return;
  }

  setNeonAuthToken(token);
  tokenInput.value = '';
  setStatus('Jeton enregistre dans le navigateur (cle cabinet.neon.jwt).', 'ok');
}

function removeToken(): void {
  clearNeonAuthToken();
  tokenInput.value = '';
  setStatus('Jeton supprime du navigateur.', 'ok');
}

async function testToken(): Promise<void> {
  testing.value = true;
  setStatus('', '');

  try {
    await requestNeonRest('/type_document?select=id&limit=1');
    setStatus('Connexion Neon Data API validee avec succes.', 'ok');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Echec de validation du jeton Neon.';
    setStatus(message, 'error');
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <section class="page-grid" data-cy="neon-auth-page">
    <article class="card auth-card">
      <header>
        <h2>Neon Auth</h2>
        <p class="caption">
          Utilisez cette page pour enregistrer le JWT Neon Auth localement puis tester l'acces direct a la Neon Data API.
        </p>
      </header>

      <p v-if="!neonModeEnabled" class="caption warning">
        Le mode Neon Data API est desactive. Activez VITE_USE_NEON_DATA_API=true pour utiliser ce flux.
      </p>

      <label class="field" for="neon-token">
        JWT Neon
        <textarea
          id="neon-token"
          v-model="tokenInput"
          class="input token-input"
          placeholder="Collez ici votre JWT"
          rows="5"
          :disabled="!neonModeEnabled"
        />
      </label>

      <div class="actions">
        <button class="button" type="button" :disabled="!neonModeEnabled" @click="saveToken">Enregistrer le jeton</button>
        <button class="button button-secondary" type="button" :disabled="!neonModeEnabled" @click="removeToken">Supprimer le jeton</button>
        <button class="button" type="button" :disabled="!neonModeEnabled || !hasStoredToken || testing" @click="testToken">
          {{ testing ? 'Verification...' : 'Tester la connexion' }}
        </button>
      </div>

      <p class="caption">Etat du jeton stocke: {{ hasStoredToken ? 'present' : 'absent' }}</p>
      <p v-if="statusMessage" class="caption" :class="statusTone === 'error' ? 'error' : 'success'">{{ statusMessage }}</p>
    </article>
  </section>
</template>

<style scoped>
.auth-card {
  display: grid;
  gap: 1rem;
  max-width: 52rem;
}

.field {
  display: grid;
  gap: 0.4rem;
}

.token-input {
  min-height: 7.5rem;
  resize: vertical;
  font-family: 'Courier New', Courier, monospace;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.caption {
  margin: 0;
}

.warning {
  color: #b45309;
}

.success {
  color: #166534;
}

.error {
  color: #b91c1c;
}
</style>
