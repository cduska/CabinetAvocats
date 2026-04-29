<script setup lang="ts">
import { watch } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';

const props = withDefaults(
  defineProps<{
    modelValue: Record<string, unknown>;
    placeholder?: string;
    readOnly?: boolean;
  }>(),
  {
    placeholder: 'Rédigez le contenu…',
    readOnly: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
}>();

function isTiptapDoc(v: Record<string, unknown>): boolean {
  return v?.type === 'doc';
}

const editor = useEditor({
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ],
  editable: !props.readOnly,
  content: isTiptapDoc(props.modelValue) ? (props.modelValue as any) : null,
  onUpdate({ editor: e }) {
    emit('update:modelValue', e.getJSON() as Record<string, unknown>);
  },
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (!editor.value) return;
    if (!isTiptapDoc(newVal)) return;
    const current = editor.value.getJSON() as Record<string, unknown>;
    if (JSON.stringify(current) === JSON.stringify(newVal)) return;
    editor.value.commands.setContent(newVal as any, { emitUpdate: false });
  },
  { deep: false },
);

watch(
  () => props.readOnly,
  (val) => { editor.value?.setEditable(!val); },
);
</script>

<template>
  <div :class="['rich-text-editor', readOnly && 'rich-text-editor--readonly']">
    <div v-if="!readOnly && editor" class="rte-toolbar">
      <!-- Historique -->
      <button type="button" title="Annuler" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()">↩</button>
      <button type="button" title="Rétablir" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()">↪</button>
      <span class="rte-sep" />
      <!-- Format texte -->
      <button type="button" title="Gras" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()"><b>G</b></button>
      <button type="button" title="Italique" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()"><i>I</i></button>
      <button type="button" title="Souligné" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()"><u>S</u></button>
      <button type="button" title="Barré" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()"><s>B</s></button>
      <span class="rte-sep" />
      <!-- Titres -->
      <button type="button" title="Titre 1" :class="{ active: editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">H1</button>
      <button type="button" title="Titre 2" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
      <button type="button" title="Titre 3" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
      <span class="rte-sep" />
      <!-- Listes -->
      <button type="button" title="Liste à puces" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()">• Liste</button>
      <button type="button" title="Liste numérotée" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()">1. Liste</button>
      <button type="button" title="Citation" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()">" Citation</button>
      <span class="rte-sep" />
      <!-- Alignement -->
      <button type="button" title="Aligner à gauche" :class="{ active: editor.isActive({ textAlign: 'left' }) }" @click="editor.chain().focus().setTextAlign('left').run()">⬅</button>
      <button type="button" title="Centrer" :class="{ active: editor.isActive({ textAlign: 'center' }) }" @click="editor.chain().focus().setTextAlign('center').run()">↔</button>
      <button type="button" title="Aligner à droite" :class="{ active: editor.isActive({ textAlign: 'right' }) }" @click="editor.chain().focus().setTextAlign('right').run()">➡</button>
    </div>
    <EditorContent class="rte-content" :editor="editor" />
  </div>
</template>

<style scoped>
.rich-text-editor {
  border: 1px solid var(--border-color, #d0d5dd);
  border-radius: 6px;
  background: var(--surface-color, #fff);
  display: flex;
  flex-direction: column;
  min-height: 220px;
}

.rich-text-editor--readonly {
  background: var(--surface-alt-color, #f9fafb);
}

/* ── Toolbar ── */
.rte-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border-color, #d0d5dd);
  background: var(--surface-alt-color, #f9fafb);
  border-radius: 6px 6px 0 0;
}

.rte-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 1.75rem;
  padding: 0 0.4rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text-color, #344054);
  transition: background 0.1s, border-color 0.1s;
  white-space: nowrap;
}

.rte-toolbar button:hover:not(:disabled) {
  background: var(--border-color, #e4e7ec);
  border-color: var(--border-color, #d0d5dd);
}

.rte-toolbar button.active {
  background: var(--primary-color, #1d4ed8);
  border-color: var(--primary-color, #1d4ed8);
  color: #fff;
}

.rte-toolbar button:disabled {
  opacity: 0.35;
  cursor: default;
}

.rte-sep {
  display: inline-block;
  width: 1px;
  height: 1.25rem;
  background: var(--border-color, #d0d5dd);
  margin: 0 0.25rem;
}

/* ── Content area ── */
.rte-content {
  flex: 1;
  padding: 0.75rem 1rem;
  min-height: 180px;
  outline: none;
}

:deep(.tiptap) {
  min-height: 160px;
  outline: none;
  line-height: 1.6;
}

:deep(.tiptap p) { margin: 0 0 0.5rem; }
:deep(.tiptap h1) { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0 0.4rem; }
:deep(.tiptap h2) { font-size: 1.25rem; font-weight: 600; margin: 0.6rem 0 0.3rem; }
:deep(.tiptap h3) { font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
:deep(.tiptap ul, .tiptap ol) { padding-left: 1.5rem; margin: 0.3rem 0; }
:deep(.tiptap blockquote) {
  border-left: 3px solid var(--primary-color, #1d4ed8);
  margin: 0.5rem 0;
  padding: 0.25rem 0.75rem;
  color: var(--text-muted-color, #667085);
  font-style: italic;
}
:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-muted-color, #9ca3af);
  pointer-events: none;
  height: 0;
}
</style>
