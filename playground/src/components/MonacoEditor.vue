<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

const model = defineModel<string>({ required: true });

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
		value: model.value,
		language: 'json',
		theme: 'vs-dark',
		automaticLayout: true,
		minimap: { enabled: false },
		fontSize: 14,
	});

	editor.onDidChangeModelContent(() => {
		if (editor) {
			model.value = editor.getValue();
		}
	});
});

watch(model, (newValue) => {
	if (editor && editor.getValue() !== newValue) {
		editor.setValue(newValue);
	}
});
</script>

<template>
	<div ref="editorContainer" class="flex-1" />
</template>
