<script setup lang="ts">
import { ref } from 'vue';
import MonacoEditor from './components/MonacoEditor.vue';
import Analysis from './components/Analysis.vue';
// eslint-disable-next-line import-x/no-unresolved -- Transpiled from TS
import { parsePackageJson, type PackageJsonWithName } from './utils/parse-package-json.js';
// eslint-disable-next-line import-x/no-unresolved -- Transpiled from TS
import * as examples from './examples.js';

const updateUrl = (content: string) => {
	const encoded = btoa(encodeURIComponent(content));
	globalThis.history.replaceState({}, '', `#${encoded}`);
};

const getInitialContent = (): string => {
	const hash = globalThis.location.hash.slice(1);

	if (hash) {
		try {
			return decodeURIComponent(atob(hash));
		} catch {
			// Invalid base64, use default
		}
	}

	const defaultContent = JSON.stringify(examples.basic, null, 2);
	updateUrl(defaultContent);
	return defaultContent;
};

const initialContent = getInitialContent();
let initialPackageJson: PackageJsonWithName;

try {
	initialPackageJson = parsePackageJson(initialContent);
} catch {
	initialPackageJson = examples.basic;
}

const packageJson = ref<PackageJsonWithName>(initialPackageJson);
const monacoString = ref(initialContent);
const jsonError = ref<string | null>(null);

const handleContentChange = (value: string) => {
	updateUrl(value);
	jsonError.value = null;
	try {
		packageJson.value = parsePackageJson(value);
	} catch (error_) {
		jsonError.value = error_ instanceof Error ? error_.message : String(error_);
	}
};

const loadExample = (exampleKey: keyof typeof examples) => {
	const example = examples[exampleKey];
	packageJson.value = example as PackageJsonWithName;
	const content = JSON.stringify(example, null, 2);
	monacoString.value = content;
	updateUrl(content);
};
</script>

<template>
	<div class="h-screen overflow-hidden flex flex-col">
		<header class="bg-gray-900 text-white p-4 flex items-center justify-between">
			<h1 class="text-2xl font-bold">
				package.json Exports Playground
			</h1>
			<div class="flex items-center gap-4">
				<label
					for="example-selector"
					class="text-sm"
				>Examples:</label>
				<select
					id="example-selector"
					class="bg-gray-800 text-white px-3 py-1 rounded border border-gray-700"
					@change="
						(e) => loadExample((e.target as HTMLSelectElement).value as keyof typeof examples)
					"
				>
					<option value="">
						-- Select Example --
					</option>
					<option value="basic">
						Basic Exports
					</option>
					<option value="wildcardDanger">
						Wildcard Danger ⚠️
					</option>
					<option value="wildcardSafe">
						Wildcard Safe ✓
					</option>
				</select>
			</div>
		</header>

		<div class="flex flex-1 overflow-hidden">
			<div class="w-1/2 flex flex-col border-r border-gray-300">
				<div class="bg-gray-800 text-white px-4 py-2 text-sm font-semibold">
					package.json
				</div>
				<MonacoEditor
					:model-value="monacoString"
					@update:model-value="handleContentChange"
				/>
			</div>

			<div class="w-1/2 flex flex-col overflow-auto">
				<div class="bg-gray-800 text-white px-4 py-2 text-sm font-semibold">
					Analysis Results
				</div>
				<Analysis
					:package-json="packageJson"
					:error="jsonError"
				/>
			</div>
		</div>
	</div>
</template>
