import type { Diagnostic } from './diagnostic';
import { join } from 'node:path/posix';

/**
 * Render a set of diagnostics to markdown, will filter by changed files
 * @param all_diagnostics
 * @param cwd
 * @param changed_files
 */
export async function render(all_diagnostics: Diagnostic[], changed_files: string[]) {
	let diagnostic_count = 0;
	let markdown = ``;

	for (const file of changed_files) {
		const diagnostics = all_diagnostics.filter((d) => d.path == file);
		if (diagnostics.length == 0) continue;

		const diagnostics_markdown = diagnostics.map(
			// prettier-ignore
			(d) => `#### ${file}:${d.start.line}:${d.start.character}\n\n\`\`\`ts\n${d.message}\n\`\`\`\n`,
		);

		diagnostic_count += diagnostics.length;
		// prettier-ignore
		markdown += `\n\n<details>\n<summary>${file}</summary>\n\n${diagnostics_markdown.join('\n')}\n</details>`;
	}

	// prettier-ignore
	return `# Svelte Check Results\n\nFound **${diagnostic_count}** errors (${all_diagnostics.length} total)\n\n${markdown.trim()}\n`;
}
