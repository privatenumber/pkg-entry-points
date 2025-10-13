<script setup lang="ts">
import type { PackageEntryPoints } from 'pkg-entry-points';
import { computed } from 'vue';

const props = defineProps<{
	entryPoints: PackageEntryPoints;
	generatedFiles: string[];
	hasWildcard: boolean;
	error: string | null;
}>();

const entryPointCount = computed(() => Object.keys(props.entryPoints).length);
</script>

<template>
	<div class="flex-1 p-4">
		<div v-if="error" class="error">
			<strong>Error:</strong>
			<pre>{{ error }}</pre>
		</div>

		<template v-else>
			<div v-if="hasWildcard" class="warning">
				⚠️ <strong>Wildcard Detected!</strong>
				<p>Using wildcards (<code>*</code>) in exports can expose internal files unintentionally.</p>
				<p>
					<small>Below shows example files - in a real package, wildcards would match <em>all</em> files matching the pattern.</small>
				</p>
			</div>

			<div class="section">
				<h3>Generated Files</h3>
				<p class="text-sm text-gray-600 mb-2">
					Files auto-generated from exports (wildcards create multiple example files):
				</p>
				<ul class="file-list">
					<li v-for="file in generatedFiles" :key="file">
						<code>{{ file }}</code>
					</li>
					<li v-if="generatedFiles.length === 0" class="empty">
						No files generated
					</li>
				</ul>
			</div>

			<div class="section">
				<h3>Exposed Entry Points ({{ entryPointCount }})</h3>
				<p v-if="entryPointCount === 0" class="empty">
					No entry points exposed
				</p>
				<ul v-else class="entry-list">
					<li v-for="([subpath, conditions], index) in Object.entries(entryPoints)" :key="index">
						<strong>{{ subpath }}</strong>
						<ul>
							<li v-for="([conditionList, internalPath], idx) in conditions" :key="idx">
								[{{ (conditionList as string[]).join(', ') }}] → <code>{{ internalPath }}</code>
							</li>
						</ul>
					</li>
				</ul>
			</div>
		</template>
	</div>
</template>
