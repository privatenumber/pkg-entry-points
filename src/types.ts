export type ConditionToPath = [conditions: string[], internalPath: string];

export type PackageEntryPoints = {
	[subpath: string]: ConditionToPath[];
};

export type StarMatch = [filePath: string, starMatch: string];

export type ConditionsMap = {
	[conditions: string]: (string | StarMatch)[] | null;
};
