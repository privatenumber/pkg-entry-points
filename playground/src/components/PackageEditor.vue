<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

const props = defineProps<{
	initialValue: string;
}>();

const emit = defineEmits<{
	change: [content: string];
}>();

const editorContainer = ref<HTMLDivElement>();
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

// Set up Monaco workers
self.MonacoEnvironment = {
	getWorker(_: string, label: string) {
		if (label === 'json') {
			return new jsonWorker();
		}
		return new editorWorker();
	},
};

onMounted(() => {
	if (!editorContainer.value) return;

	editor = monaco.editor.create(editorContainer.value, {
		value: props.initialValue,
		language: 'json',
		theme: 'vs-dark',
		automaticLayout: true,
		minimap: { enabled: false },
		fontSize: 14,
	});

	editor.onDidChangeModelContent(() => {
		if (editor) {
			emit('change', editor.getValue());
		}
	});
});

watch(() => props.initialValue, (newValue) => {
	if (editor && editor.getValue() !== newValue) {
		editor.setValue(newValue);
	}
});
</script>

<template>
	<div ref="editorContainer" class="flex-1" />
</template>
