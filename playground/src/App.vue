<script setup lang="ts">
import { reactive, computed, ref } from 'vue';
import type { PackageJson } from 'type-fest';
import MonacoEditor from './components/MonacoEditor.vue';
import Analysis from './components/Analysis.vue';

const examples = {
	basic: {
		name: 'example-package',
		exports: {
			'.': './index.js',
			'./utils': './utils.js',
		},
	},
	wildcardDanger: {
		name: 'dangerous-wildcards',
		exports: {
			'./*': './dist/*.js',
		},
	},
	wildcardSafe: {
		name: 'safe-wildcards',
		exports: {
			'./features/*': './dist/features/*/index.js',
		},
	},
};

const defaultPackageJson = {
	name: 'example-package',
	exports: {
		'./a': './dist/a.js',
		'./*': './dist/*.js',
	},
};

const packageJson = ref<PackageJson>(defaultPackageJson);
const jsonError = ref<string | null>(null);

const packageJsonContent = computed({
	get: () => JSON.stringify(packageJson.value, null, 2),
	set: (value: string) => {
		try {
			const parsed = JSON.parse(value) as PackageJson;
			packageJson.value = parsed;
			jsonError.value = null;
		} catch (error_) {
			jsonError.value = error_ instanceof Error ? error_.message : String(error_);
		}
	},
});

const loadExample = (exampleKey: keyof typeof examples) => {
	const example = examples[exampleKey];
	Object.assign(packageJson, example);
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
					@change="(e) => loadExample((e.target as HTMLSelectElement).value as keyof typeof examples)"
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
				<MonacoEditor v-model="packageJsonContent" />
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
