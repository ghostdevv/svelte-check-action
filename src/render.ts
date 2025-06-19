import { fmt_path, get_blob_base } from './files';
import type { DiagnosticStore } from './index';
import type { Diagnostic } from './diagnostic';
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { format } from 'date-fns';
import type { CTX } from './ctx';

/**
 * Get the latest git commit of the current repo
 */
function get_latest_commit() {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'unknown';
	}
}

/**
 * Prettify the diagnostic type
 */
function pretty_type(type: Diagnostic['type']) {
	return type == 'error' ? 'Error' : 'Warn';
}

/**
 * Render number + word taking into account simple plural
 */
function pl(num: number, word: string) {
	return `**${num}** ${word}${num == 1 ? '' : 's'}`;
}

/**
 * Render a set of diagnostics to markdown
 */
export async function render(ctx: CTX, diagnostics_store: DiagnosticStore) {
	const blob_base = await get_blob_base(ctx);
	const output = ['# Svelte Check Results\n'];
	const now = new Date();

	if (diagnostics_store.count == 0) {
		output.push('No issues found! 🎉');
	} else {
		output.push(
			`Found ${pl(diagnostics_store.error_count, 'error')} ` +
				`and ${pl(diagnostics_store.warning_count, 'warning')} ` +
				`(${diagnostics_store.error_count + diagnostics_store.warning_count} total) ` +
				(ctx.config.filter_changes === true ? ' with the files in this PR' : '') +
				'.\n',
		);

		for (const [path, diagnostics] of diagnostics_store.entries()) {
			const readable_path = fmt_path(path, ctx);
			const lines = await readFile(path, 'utf-8').then((c) => c.split('\n'));

			const diagnostics_markdown = diagnostics.map(
				// prettier-ignore
				(d) => `#### [${readable_path}:${d.start.line}:${d.start.character}](${blob_base}${readable_path}#L${d.start.line}${d.start.line != d.end.line ? `-L${d.end.line}` : ''})\n\n\`\`\`ts\n${pretty_type(d.type)}: ${d.message}\n\n${lines.slice(d.start.line - 1, d.end.line).join('\n').trim()}\n\`\`\`\n`,
			);

			output.push(
				// prettier-ignore
				`\n\n<details>\n<summary>${readable_path}</summary>\n\n${diagnostics_markdown.join('\n')}\n</details>`,
			);
		}
	}

	output.push('\n---\n');
	// prettier-ignore
	output.push(`Last Updated: <span title="${now.toISOString()}">${format(now, 'do MMMM \'at\' HH:mm')}</span> (${get_latest_commit()})`)

	return output.join('\n');
}
