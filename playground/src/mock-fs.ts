/**
 * Mock filesystem for browser-based playground.
 * Pretends all files exist to demonstrate wildcard behavior.
 */

export class MockFileSystem {
	private files = new Map<string, string>();

	constructor() {
		// Filesystem is completely dynamic
	}

	readFileSync(filePath: string, encoding: string): string {
		console.log('📖 readFileSync:', filePath);

		if (encoding !== 'utf8') {
			throw new Error(`Unsupported encoding: ${encoding}`);
		}

		const content = this.files.get(filePath);
		if (content !== undefined) {
			console.log('✅ File found in cache:', filePath);
			return content;
		}

		// All files "exist" dynamically
		console.log('✅ File exists (dynamic):', filePath);
		return `// Dynamic file: ${filePath}`;
	}

	readdirSync(directoryPath: string): string[] {
		console.log('📁 readdirSync:', directoryPath);

		const normalizedPath = directoryPath === '.' ? '' : directoryPath;
		const prefix = normalizedPath ? `${normalizedPath}/` : '';
		const entries = new Set<string>();

		// Return cached files if they exist
		for (const filePath of this.files.keys()) {
			if (filePath.startsWith(prefix)) {
				const relativePath = filePath.slice(prefix.length);
				const firstSegment = relativePath.split('/')[0];
				if (firstSegment) {
					entries.add(firstSegment);
				}
			}
		}

		const result = Array.from(entries);
		console.log('  → Entries:', result.length > 0 ? result : '(empty - all files exist dynamically)');
		return result;
	}

	statSync(path: string) {
		console.log('📊 statSync:', path);

		// Check cache first
		if (this.files.has(path)) {
			console.log('  → File (cached)');
			return {
				isDirectory: () => false,
				isFile: () => true,
			};
		}

		// Check if it's a cached directory (has children)
		const prefix = `${path}/`;
		for (const filePath of this.files.keys()) {
			if (filePath.startsWith(prefix)) {
				console.log('  → Directory (cached)');
				return {
					isDirectory: () => true,
					isFile: () => false,
				};
			}
		}

		// Everything else with an extension is a file (dynamic)
		if (path.includes('.')) {
			console.log('  → File (dynamic)');
			return {
				isDirectory: () => false,
				isFile: () => true,
			};
		}

		// Paths without extension are directories (dynamic)
		console.log('  → Directory (dynamic)');
		return {
			isDirectory: () => true,
			isFile: () => false,
		};
	}

	/**
	 * Add or update a file in the mock filesystem
	 */
	setFile(path: string, content: string) {
		this.files.set(path, content);
	}

	/**
	 * Remove a file from the mock filesystem
	 */
	removeFile(path: string) {
		this.files.delete(path);
	}

	/**
	 * Get all file paths in the mock filesystem
	 */
	getAllFiles(): string[] {
		return Array.from(this.files.keys());
	}

	/**
	 * Clear all files
	 */
	clear() {
		this.files.clear();
	}
}
