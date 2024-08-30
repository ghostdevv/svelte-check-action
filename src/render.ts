import type { Diagnostic } from './diagnostic';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PRFile {
	blob_url: string;
	relative_path: string;
}

/**
 * Render a set of diagnostics to markdown, will filter by changed files
 * @param all_diagnostics
 * @param cwd
 * @param pr_files
 */
export async function render(all_diagnostics: Diagnostic[], repo_root: string, pr_files: PRFile[]) {
	let diagnostic_count = 0;
	let markdown = ``;

	for (const pr_file of pr_files) {
		const path = join(repo_root, pr_file.relative_path);

		const diagnostics = all_diagnostics.filter((d) => d.path == path);
		if (diagnostics.length == 0) continue;

		const readable_path = path.replace(repo_root, '').replace(/^\/+/, '');
		const lines = await readFile(path, 'utf-8').then((c) => c.split('\n'));

		const diagnostics_markdown = diagnostics.map(
			// prettier-ignore
			(d) => `#### [${readable_path}:${d.start.line}:${d.start.character}](${pr_file.blob_url}#L${d.start.line}${d.start.line != d.end.line ? `-L${d.end.line}` : ''})\n\n\`\`\`ts\n${d.message}\n\n${lines[d.start.line - 1].trim()}\n\`\`\`\n`,
		);

		diagnostic_count += diagnostics.length;
		// prettier-ignore
		markdown += `\n\n<details>\n<summary>${readable_path}</summary>\n\n${diagnostics_markdown.join('\n')}\n</details>`;
	}

	// prettier-ignore
	return `# Svelte Check Results\n\nFound **${diagnostic_count}** errors (${all_diagnostics.length} total)\n\n${markdown.trim()}\n`;
}
