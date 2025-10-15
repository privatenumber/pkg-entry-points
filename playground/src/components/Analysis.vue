<script setup lang="ts">
import type { PackageEntryPoints, ParsedExport } from 'pkg-entry-points';
import { computed } from 'vue';

const props = defineProps<{
	entryPoints: PackageEntryPoints;
	parsedExports: ParsedExport[];
	generatedFiles: string[];
	hasWildcard: boolean;
	error: string | null;
}>();

const entryPointCount = computed(() => Object.keys(props.entryPoints).length);

const formatSubpath = (subpath: string | string[]): string => (Array.isArray(subpath) ? subpath.join('*') : subpath);

const formatTarget = (target: string | string[] | null): string => {
	if (target === null) { return 'null (blocked)'; }
	return Array.isArray(target) ? target.join('*') : target;
};
</script>

<template>
	<div class="flex-1 p-4">
		<div
			v-if="error"
			class="error"
		>
			<strong>Error:</strong>
			<pre>{{ error }}</pre>
		</div>

		<template v-else>
			<div
				v-if="hasWildcard"
				class="warning"
			>
				⚠️ <strong>Wildcard Detected!</strong>
				<p>Using wildcards (<code>*</code>) in exports can expose internal files unintentionally.</p>
				<p>
					<small>Below shows example files - in a real package, wildcards would match <em>all</em> files matching the pattern.</small>
				</p>
			</div>

			<div class="section">
				<h3>1. Parsed Exports ({{ parsedExports.length }})</h3>
				<p class="text-sm text-gray-600 mb-2">
					Raw structure parsed from package.json exports field:
				</p>
				<ul
					v-if="parsedExports.length > 0"
					class="entry-list"
				>
					<li
						v-for="(entry, index) in parsedExports"
						:key="index"
						class="mb-2"
					>
						<div class="font-mono text-sm">
							<strong class="text-blue-600">{{ formatSubpath(entry.subpath) }}</strong>
							<span class="text-gray-500"> → </span>
							<code class="text-green-600">{{ formatTarget(entry.target) }}</code>
						</div>
						<div class="text-xs text-gray-500 ml-4">
							Conditions: [{{ entry.conditions.join(', ') }}]
						</div>
					</li>
				</ul>
				<p
					v-else
					class="empty"
				>
					No exports defined
				</p>
			</div>

			<div class="section">
				<h3>2. Generated Files</h3>
				<p class="text-sm text-gray-600 mb-2">
					Files auto-generated from exports (wildcards create multiple example files):
				</p>
				<ul class="file-list">
					<li
						v-for="file in generatedFiles"
						:key="file"
					>
						<code>{{ file }}</code>
					</li>
					<li
						v-if="generatedFiles.length === 0"
						class="empty"
					>
						No files generated
					</li>
				</ul>
			</div>

			<div class="section">
				<h3>3. Exposed Entry Points ({{ entryPointCount }})</h3>
				<p class="text-sm text-gray-600 mb-2">
					Final entry points after matching against actual files:
				</p>
				<p
					v-if="entryPointCount === 0"
					class="empty"
				>
					No entry points exposed
				</p>
				<ul
					v-else
					class="entry-list"
				>
					<li
						v-for="([subpath, conditions], index) in Object.entries(entryPoints)"
						:key="index"
					>
						<strong>{{ subpath }}</strong>
						<ul>
							<li
								v-for="([conditionList, internalPath], idx) in conditions"
								:key="idx"
							>
								[{{ (conditionList as string[]).join(', ') }}] → <code>{{ internalPath }}</code>
							</li>
						</ul>
					</li>
				</ul>
			</div>
		</template>
	</div>
</template>
