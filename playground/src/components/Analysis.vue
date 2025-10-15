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

// Group entry points by their export pattern
const groupedEntryPoints = computed(() => {
	const groups: Array<{
		exportPattern: string;
		exportValue: any;
		isWildcard: boolean;
		entries: Array<{ subpath: string; internalPath: string }>;
	}> = [];

	// Build a map of which subpaths came from which export patterns
	for (const [subpath, conditions] of Object.entries(entryPoints.value)) {
		for (const [_conditionList, internalPath] of conditions) {
			// Find the matching export pattern
			let exportPattern = '.';
			let exportValue: any = props.packageJson.exports;

			if (props.packageJson.exports && typeof props.packageJson.exports === 'object') {
				// Try exact match first
				if (subpath in props.packageJson.exports) {
					exportPattern = subpath;
					exportValue = (props.packageJson.exports as any)[subpath];
				} else {
					// Try wildcard match
					for (const [key, value] of Object.entries(props.packageJson.exports)) {
						if (key.includes('*')) {
							const pattern = key.replace('*', '(.*)');
							const regex = new RegExp(`^${pattern}$`);
							if (regex.test(subpath)) {
								exportPattern = key;
								exportValue = value;
								break;
							}
						}
					}
				}
			}

			const isWildcard = exportPattern.includes('*');

			let group = groups.find(g => g.exportPattern === exportPattern);
			if (!group) {
				group = {
					exportPattern,
					exportValue,
					isWildcard,
					entries: [],
				};
				groups.push(group);
			}

			group.entries.push({ subpath, internalPath });
		}
	}

	return groups;
});
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
				v-if="entryPointCount === 0"
				class="text-gray-500 italic"
			>
				No entry points exposed
			</div>

			<div
				v-else
				class="space-y-6"
			>
				<div
					v-for="(group, index) in groupedEntryPoints"
					:key="index"
				>
					<!-- Export pattern header -->
					<div class="mb-2">
						<div class="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">
							Export Pattern
						</div>
						<div class="font-mono text-sm bg-gray-100 rounded px-3 py-2 border border-gray-300">
							<span class="text-gray-600">"{{ group.exportPattern }}":</span>
							<span class="text-gray-800 ml-2">{{ JSON.stringify(group.exportValue) }}</span>
						</div>
					</div>

					<!-- Wildcard warning inline -->
					<div
						v-if="group.isWildcard"
						class="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-3 text-yellow-800 text-sm"
					>
						<span class="font-semibold">⚠️ Wildcard pattern</span> can expose internal files unintentionally
					</div>

					<!-- Entry points for this pattern -->
					<ul class="space-y-1 ml-4">
						<li
							v-for="(entry, idx) in group.entries"
							:key="idx"
							class="font-mono text-sm py-1"
						>
							<span class="text-blue-600">import '{{ props.packageJson.name }}{{ entry.subpath.slice(1) }}'</span>
							<span class="text-gray-400 mx-2">→</span>
							<span class="text-green-600">{{ props.packageJson.name }}/{{ entry.internalPath.slice(2) }}</span>
						</li>
					</ul>
				</div>
			</div>
		</template>
	</div>
</template>
