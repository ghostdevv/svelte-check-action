import { get_diagnostics } from '../src/diagnostic';
import { writeFile } from 'node:fs/promises';
import { render } from '../src/render';
import { join } from 'node:path';

const diagnostics = await get_diagnostics(import.meta.dirname);

console.log(Array.from(new Set(diagnostics.map((d) => d.path))));

const markdown = await render(
	diagnostics,
	import.meta.dirname,
	Array.from(new Set(diagnostics.map((d) => d.path))),
);

await writeFile(join(import.meta.dirname, './test.md'), markdown, 'utf-8');
