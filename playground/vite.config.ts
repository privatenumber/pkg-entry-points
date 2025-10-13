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
			// Shim Node.js built-in modules for browser
			'fs': '/src/fs-shim.ts',
			'path': '/src/path-shim.ts',
		},
	},
});
