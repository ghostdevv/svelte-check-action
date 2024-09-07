import { get_diagnostics } from '../src/diagnostic';
import { writeFile } from 'node:fs/promises';
import { render } from '../src/render';
import { join } from 'node:path';

const diagnostics = await get_diagnostics(import.meta.dirname);

const markdown = await render(
	diagnostics,
	import.meta.dirname,
	'https://github.com/ghostdevv/svelte-check-action/blob/fake-commit-hash',
);

await writeFile(join(import.meta.dirname, './test.md'), markdown, 'utf-8');
