import type { Diagnostic } from './diagnostic';
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { format } from 'date-fns';

export interface PRFile {
	blob_url: string;
	relative_path: string;
	local_path: string;
}

function get_latest_commit() {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'unknown';
	}
}

function pretty_type(type: Diagnostic['type']) {
	return type == 'error' ? 'Error' : 'Warn';
}

/**
 * Render a set of diagnostics to markdown, will optionally filter by changed files
 */
export async function render(
	all_diagnostics: Diagnostic[],
	repo_root: string,
	file_url_base: string,
	changed_files?: string[],
) {
	const diagnostics_map = new Map<string, Diagnostic[]>();

	let diagnostic_count = 0;
	for (const diagnostic of all_diagnostics) {
		if (changed_files && !changed_files.includes(diagnostic.path)) continue;

		const current = diagnostics_map.get(diagnostic.path) ?? [];
		current.push(diagnostic);
		diagnostics_map.set(diagnostic.path, current);
		diagnostic_count++;
	}

	let markdown = ``;
	for (const [path, diagnostics] of diagnostics_map) {
		const readable_path = path.replace(repo_root, '').replace(/^\/+/, '');
		const lines = await readFile(path, 'utf-8').then((c) => c.split('\n'));

		const diagnostics_markdown = diagnostics.map(
			// prettier-ignore
			(d) => `#### [${readable_path}:${d.start.line}:${d.start.character}](${file_url_base}/${readable_path}#L${d.start.line}${d.start.line != d.end.line ? `-L${d.end.line}` : ''})\n\n\`\`\`ts\n${pretty_type(d.type)}: ${d.message}\n\n${lines.slice(d.start.line - 1, d.end.line).join('\n').trim()}\n\`\`\`\n`,
		);

		// prettier-ignore
		markdown += `\n\n<details>\n<summary>${readable_path}</summary>\n\n${diagnostics_markdown.join('\n')}\n</details>`;
	}

	const now = new Date();

	const main_content = diagnostic_count
		? // prettier-ignore
			`Found **${diagnostic_count}** issues ${changed_files ? 'with the files in this PR ' : ''}(${all_diagnostics.length} total)\n\n${markdown.trim()}`
		: 'No issues found! 🎉';

	// prettier-ignore
	return `# Svelte Check Results\n\n${main_content}\n\n---\n\nLast Updated: <span title="${now.toISOString()}">${format(now, 'do MMMM \'at\' HH:mm')}</span> (${get_latest_commit()})\n`;
}
