<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';
import EditorJS, { type OutputData, type BlockToolConstructable } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Delimiter from '@editorjs/delimiter';

const props = withDefaults(
  defineProps<{
    modelValue: Record<string, unknown>;
    placeholder?: string;
    readOnly?: boolean;
  }>(),
  {
    placeholder: 'Rédigez le contenu du modèle…',
    readOnly: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
}>();

const holderRef = ref<HTMLDivElement | null>(null);
let editor: EditorJS | null = null;
// Tracks the last raw object we emitted so the watch can skip echo updates
// (editor onChange → emit → parent updates v-model → watch fires → would re-render)
let lastEmittedRaw: Record<string, unknown> | null = null;

function toOutputData(value: Record<string, unknown>): OutputData | undefined {
  return Array.isArray(value.blocks) ? (value as unknown as OutputData) : undefined;
}

async function initEditor(initialData: Record<string, unknown>): Promise<void> {
  if (!holderRef.value) return;

  editor = new EditorJS({
    holder: holderRef.value,
    readOnly: props.readOnly,
    placeholder: props.placeholder,
    data: toOutputData(initialData),
    tools: {
      header: {
        class: Header as unknown as BlockToolConstructable,
        config: { levels: [1, 2, 3], defaultLevel: 2 },
      },
      list: {
        class: List as unknown as BlockToolConstructable,
        inlineToolbar: true,
        config: { defaultStyle: 'unordered' },
      },
      quote: {
        class: Quote as unknown as BlockToolConstructable,
        inlineToolbar: true,
      },
      delimiter: Delimiter as unknown as BlockToolConstructable,
    },
    onChange: async () => {
      if (!editor) return;
      try {
        const output = await editor.save();
        const asRecord = output as unknown as Record<string, unknown>;
        lastEmittedRaw = asRecord;
        emit('update:modelValue', asRecord);
      } catch {
        // ignore transient save errors during typing
      }
    },
  });

  await editor.isReady;
}

onMounted(() => {
  void initEditor(props.modelValue);
});

// When the parent selects a different modèle, reload the editor content.
// Skip if the update is just an echo of our own onChange emit (feedback loop).
watch(
  () => props.modelValue,
  async (newValue) => {
    if (!editor) return;
    // toRaw unwraps the Vue reactive Proxy to compare against the raw object we emitted
    if (toRaw(newValue) === lastEmittedRaw) return;
    const data = toOutputData(newValue);
    if (!data) return;
    lastEmittedRaw = null;
    try {
      await editor.isReady;
      await editor.render(data);
    } catch {
      // ignore render errors during model switch
    }
  },
  { deep: false },
);

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});
</script>

<template>
  <div :class="['rich-text-editor', readOnly && 'rich-text-editor--readonly']">
    <div ref="holderRef" class="rich-text-editor-holder" />
  </div>
</template>

<style scoped>
.rich-text-editor {
  border: 1px solid var(--border-color, #d0d5dd);
  border-radius: 6px;
  background: var(--surface-color, #fff);
  min-height: 220px;
}

.rich-text-editor--readonly {
  background: var(--surface-alt-color, #f9fafb);
  cursor: default;
}

.rich-text-editor-holder {
  padding: 0.5rem 0.75rem;
  min-height: 200px;
}

/* Adapt Editor.js toolbar to the app theme */
:deep(.ce-block__content),
:deep(.ce-toolbar__content) {
  max-width: unset;
}

:deep(.cdx-block) {
  padding: 0.3rem 0;
}

:deep(.ce-toolbar__plus),
:deep(.ce-toolbar__settings-btn) {
  color: var(--text-muted-color, #667085);
}
</style>
