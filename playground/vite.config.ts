import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		vue(),
		tailwindcss(),
	],
	optimizeDeps: {
		include: ['monaco-editor'],
	},
	resolve: {
		alias: {
			fs: '/src/node-shim.ts',
			path: '/src/node-shim.ts',
		},
	},
});
