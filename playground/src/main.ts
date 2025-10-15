import './style.css';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import { getPackageEntryPoints } from 'pkg-entry-points'

(async () => {
	const packageExports = await getPackageEntryPoints('./node_modules/my-package')

	console.log(packageExports)


})();

self.MonacoEnvironment = {
	getWorker(_: string, label: string) {
		if (label === 'json') {
			return new jsonWorker();
		}
		return new editorWorker();
	},
};

const defaultPackageJson = {
	name: 'example-package',
	version: '1.0.0',
	exports: {
		'.': {
			import: './dist/index.js',
			require: './dist/index.cjs',
		},
		'./utils': './dist/utils.js',
	},
};

const editor = monaco.editor.create(document.getElementById('editor')!, {
	value: JSON.stringify(defaultPackageJson, null, 2),
	language: 'json',
	theme: 'vs-dark',
	automaticLayout: true,
	minimap: { enabled: false },
	fontSize: 14,
});

// TODO: Add functionality to parse and display entry points
console.log('Monaco editor initialized');
