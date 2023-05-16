import { STAR } from './constants.js';

export type PathMatcher = {
	prefix: string;
	middle: string[];
	suffix: string;
};

export const createPathMatcher = (
	patternPath: string,
): PathMatcher => {
	const pathComponents = patternPath.split(STAR);
	const prefix = pathComponents[0];
	const lastIndex = pathComponents.length - 1;
	const suffix = pathComponents[lastIndex];
	const middle = pathComponents.slice(1, lastIndex);

	return {
		prefix,
		middle,
		suffix,
	};
};

export const pathMatches = (
	{
		prefix,
		suffix,
		middle: middleSegments,
	}: PathMatcher,
	filePath: string,
) => {
	if (
		!filePath.startsWith(prefix)
		|| !filePath.endsWith(suffix)
	) {
		return;
	}

	const filePathMiddle = filePath.slice(prefix.length, -suffix.length || undefined);
	if (middleSegments.length === 0) {
		return filePathMiddle;
	}

	let lastIndex = 0;
	let starValue = '';
	for (const segment of middleSegments) {
		const segmentIndex = filePathMiddle.indexOf(segment, lastIndex);
		if (segmentIndex === -1) {
			return;
		}

		const extracted = filePathMiddle.slice(lastIndex, segmentIndex);
		if (!starValue) {
			starValue = extracted;
		} else if (starValue !== extracted) {
			return;
		}

		lastIndex = segmentIndex + segment.length;
	}

	return starValue;
};
