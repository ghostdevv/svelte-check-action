import { get_diagnostics } from './diagnostic';
import { relative } from 'node:path/posix';
import cardinal from 'cardinal';

const TARGET = '';

const diagnostics = await get_diagnostics(TARGET);

for (const diagnostic of diagnostics) {
	console.log(
		`[${diagnostic.type.toUpperCase()}]`,
		// prettier-ignore
		`${relative(TARGET, diagnostic.path)}:${diagnostic.start.line}:${diagnostic.start.character}\n`,
		cardinal.highlight(diagnostic.message),
		'\n\n',
	);
}

console.log('results', diagnostics.length);
