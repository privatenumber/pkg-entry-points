<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import MonacoEditor from './components/MonacoEditor.vue';
import ResultsPanel from './components/ResultsPanel.vue';
import { parsePackageExports, analyzeExportsWithFiles } from 'pkg-entry-points';
import type { PackageEntryPoints, ParsedExport } from 'pkg-entry-points';

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
			'./*': './src/*.js',
		},
	},
	wildcardSafe: {
		name: 'safe-wildcards',
		exports: {
			'./features/*': './src/features/*/index.js',
		},
	},
};

const defaultPackageJson = {
	name: 'example-package',
	version: '1.0.0',
	exports: {
		'./a': './src/a.js',
		'./*': './src/*.js',
	},
};

const packageJsonContent = ref(JSON.stringify(defaultPackageJson, null, 2));
const entryPoints = ref<PackageEntryPoints>({});
const parsedExports = ref<ParsedExport[]>([]);
const error = ref<string | null>(null);
const generatedFiles = ref<string[]>([]);

function extractFilesFromExports(exports: any): Set<string> {
	const files = new Set<string>();

	function extract(value: any) {
		if (typeof value === 'string' && value.startsWith('./')) {
			files.add(value);

			if (value.includes('*')) {
				const exampleNames = ['index', 'utils', 'helpers', 'config', 'types', 'api', 'core'];
				for (const example of exampleNames) {
					const exampleFile = value.replace(/\*/g, example);
					files.add(exampleFile);
				}
			}
		} else if (Array.isArray(value)) {
			for (const item of value) {
				extract(item);
			}
		} else if (value && typeof value === 'object') {
			for (const key in value) {
				extract(value[key]);
			}
		}
	}

	extract(exports);
	return files;
}

function analyzePackage(content: string) {
	try {
		console.log('═══════════════════════════════════════');
		console.log('🔍 Starting package analysis');

		const packageJson = JSON.parse(content);
		console.log('📦 Analyzing exports:', packageJson.exports);

		// Parse exports structure
		if (packageJson.exports) {
			parsedExports.value = parsePackageExports(packageJson.exports);
			console.log('📋 Parsed exports:', parsedExports.value);

			// Extract files from parsed exports
			const referencedFiles = extractFilesFromExports(packageJson.exports);
			console.log('📄 Files extracted from exports:', Array.from(referencedFiles));

			generatedFiles.value = Array.from(referencedFiles).sort();

			// Analyze exports with files to get final entry points
			entryPoints.value = analyzeExportsWithFiles(parsedExports.value, generatedFiles.value);
			console.log('✨ Entry points found:', entryPoints.value);
		} else {
			parsedExports.value = [];
			generatedFiles.value = [];
			entryPoints.value = {};
		}

		console.log('═══════════════════════════════════════');

		error.value = null;
	} catch (err) {
		console.error('💥 Error during analysis:', err);
		error.value = err instanceof Error ? err.message : String(err);
		entryPoints.value = {};
		parsedExports.value = [];
		generatedFiles.value = [];
	}
}

watch(packageJsonContent, (content) => {
	analyzePackage(content);
});

function loadExample(exampleKey: keyof typeof examples) {
	const example = examples[exampleKey];
	packageJsonContent.value = JSON.stringify(example, null, 2);
}

const hasWildcard = computed(() => {
	try {
		const packageJson = JSON.parse(packageJsonContent.value);
		return JSON.stringify(packageJson.exports || {}).includes('*');
	} catch {
		return false;
	}
});

// Initial analysis
analyzePackage(packageJsonContent.value);
</script>

<template>
	<div class="h-screen overflow-hidden flex flex-col">
		<header class="bg-gray-900 text-white p-4 flex items-center justify-between">
			<h1 class="text-2xl font-bold">package.json Exports Playground</h1>
			<div class="flex items-center gap-4">
				<label for="example-selector" class="text-sm">Examples:</label>
				<select
					id="example-selector"
					class="bg-gray-800 text-white px-3 py-1 rounded border border-gray-700"
					@change="(e) => loadExample((e.target as HTMLSelectElement).value as keyof typeof examples)"
				>
					<option value="">-- Select Example --</option>
					<option value="basic">Basic Exports</option>
					<option value="wildcardDanger">Wildcard Danger ⚠️</option>
					<option value="wildcardSafe">Wildcard Safe ✓</option>
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
				<ResultsPanel
					:entry-points="entryPoints"
					:parsed-exports="parsedExports"
					:generated-files="generatedFiles"
					:has-wildcard="hasWildcard"
					:error="error"
				/>
			</div>
		</div>
	</div>
</template>
