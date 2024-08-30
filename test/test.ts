import { render, type PRFile } from '../src/render';
import { get_diagnostics } from '../src/diagnostic';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const diagnostics = await get_diagnostics(import.meta.dirname);

const pr_files = Array.from(new Set(diagnostics.map((d) => d.path))).map(
	(file): PRFile => ({
		relative_path: file.replace(import.meta.dirname, ''),
		blob_url:
			'https://github.com/ghostdevv/svelte-check-action/blob/fake-commit-hash',
	}),
);

const markdown = await render(diagnostics, import.meta.dirname, pr_files);

await writeFile(join(import.meta.dirname, './test.md'), markdown, 'utf-8');
