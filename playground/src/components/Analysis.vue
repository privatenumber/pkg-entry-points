<script setup lang="ts">
import {
	parsePackageExports,
	analyzeExportsWithFiles,
	type PackageEntryPoints,
	type ParsedExport,
	type ParseResult,
} from 'pkg-entry-points';
import { ref, computed, watch } from 'vue';
import type { PackageJsonWithName } from '../types.js';

const props = defineProps<{
	packageJson: PackageJsonWithName;
	error: string | null;
}>();

const entryPoints = ref<PackageEntryPoints>({});
const parsedExports = ref<ParsedExport[]>([]);
const analysisError = ref<string | null>(null);
const generatedFiles = ref<string[]>([]);

const exampleNames = ['index', 'utils', '_private-api', '_internal/helper'];

const extractFilesFromExports = (exports: any): Set<string> => {
	const files = new Set<string>();

	const extract = (value: any) => {
		if (typeof value === 'string' && value.startsWith('./')) {
			files.add(value);

			if (value.includes('*')) {
				for (const example of exampleNames) {
					const exampleFile = value.replaceAll('*', example);
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
	};

	extract(exports);
	return files;
};

const analyzePackage = () => {
	try {
		analysisError.value = null;

		if (props.packageJson.exports) {
			const { parsed, errors } = parsePackageExports(props.packageJson.exports);

			if (errors.length > 0) {
				analysisError.value = errors.map((error: Error) => error.message).join('\n');
			}

			parsedExports.value = parsed;

			const referencedFiles = extractFilesFromExports(props.packageJson.exports);
			generatedFiles.value = Array.from(referencedFiles).sort();

			entryPoints.value = analyzeExportsWithFiles(parsedExports.value, generatedFiles.value);
		} else {
			parsedExports.value = [];
			generatedFiles.value = [];
			entryPoints.value = {};
		}
	} catch (error_) {
		console.error('💥 Error during analysis:', error_);
		analysisError.value = error_ instanceof Error ? error_.message : String(error_);
		entryPoints.value = {};
		parsedExports.value = [];
		generatedFiles.value = [];
	}
};

watch(() => props.packageJson, analyzePackage, { immediate: true, deep: true });

const entryPointCount = computed(() => Object.keys(entryPoints.value).length);

const hasWildcard = computed(() => JSON.stringify(props.packageJson.exports || {}).includes('*'));
</script>

<template>
	<div class="flex-1 p-4">
		<div
			v-if="error"
			class="bg-red-50 border border-red-200 rounded p-4 text-red-800 mb-4"
		>
			<strong>Error:</strong>
			<pre class="mt-2 text-sm">{{ error }}</pre>
		</div>

		<div
			v-if="analysisError"
			class="bg-red-50 border border-red-200 rounded p-4 text-red-800 mb-4"
		>
			<strong>Analysis Error:</strong>
			<pre class="mt-2 text-sm">{{ analysisError }}</pre>
		</div>

		<template v-if="!error">
			<div
				v-if="hasWildcard"
				class="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4 text-yellow-800"
			>
				⚠️ <strong>Wildcard Detected!</strong>
				<p class="text-sm mt-1">
					Using wildcards (<code>*</code>) in exports can expose internal files unintentionally.
				</p>
			</div>

			<div
				v-if="entryPointCount === 0"
				class="text-gray-500 italic"
			>
				No entry points exposed
			</div>

			<ul
				v-else
				class="space-y-2"
			>
				<li
					v-for="([subpath, conditions], index) in Object.entries(entryPoints)"
					:key="index"
					class="font-mono text-sm"
				>
					<div
						v-for="([_conditionList, internalPath], idx) in conditions"
						:key="idx"
						class="py-1"
					>
						<span class="text-blue-600">import '{{ props.packageJson.name }}{{ subpath.slice(1) }}'</span>
						<span class="text-gray-400 mx-2">→</span>
						<span class="text-green-600">{{ props.packageJson.name }}/{{ internalPath.slice(2) }}</span>
					</div>
				</li>
			</ul>
		</template>
	</div>
</template>
