import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import App from '../src/App.vue';

const sleep = (ms: number) => new Promise((resolve) => {
	setTimeout(resolve, ms);
});

test('sets URL hash on initial render', async () => {
	render(App);

	// Verify hash is set on initial render
	const { hash } = globalThis.location;
	expect(hash).toBeTruthy();
	expect(hash).toMatch(/^#/);

	// Decode and verify initial content
	const encoded = hash.slice(1);
	const decoded = decodeURIComponent(atob(encoded));
	expect(decoded).toContain('"name": "example-package"');
});

test('updates URL hash when content changes via example selection', async () => {
	const screen = render(App);

	const initialHash = globalThis.location.hash;
	expect(initialHash).toBeTruthy();

	const initialDecoded = decodeURIComponent(atob(initialHash.slice(1)));
	expect(initialDecoded).toContain('example-package');

	// Select the "wildcardDanger" example from dropdown to trigger content change
	const selector = screen.getByLabelText(/examples/i);
	await selector.selectOptions('wildcardDanger');

	// Wait for hash to update
	await sleep(100);

	// Verify URL hash changed
	const updatedHash = globalThis.location.hash;
	expect(updatedHash).not.toBe(initialHash);

	// Decode and verify it contains the wildcardDanger example content
	const decoded = decodeURIComponent(atob(updatedHash.slice(1)));
	expect(decoded).toContain('"name": "dangerous-wildcards"');
	expect(decoded).toContain('"./*": "./dist/*.js"');

	// This demonstrates that handleContentChange() -> updateUrl() works correctly
	// The same code path is used when typing in the Monaco editor
});

test('loads content from URL hash on mount', async () => {
	// Set up URL hash before mounting
	const testContent = JSON.stringify(
		{
			name: 'hash-test-package',
			exports: {
				'./hash': './hash.js',
			},
		},
		null,
		2,
	);
	const encoded = btoa(encodeURIComponent(testContent));
	globalThis.location.hash = encoded;

	const screen = render(App);

	// Verify content is loaded from hash by checking the import statement in analysis
	await expect.element(screen.getByText("import 'hash-test-package/hash'", { exact: false })).toBeInTheDocument();
});
