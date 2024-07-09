// Based on MIT Licenced code from SvelteLab
// https://github.com/SvelteLab/SvelteLab/blob/a3fb823356a9ed1d16eb8535340c9813b7eb547d/src/lib/stores/editor_errors_store.ts#L19
// https://github.com/SvelteLab/SvelteLab/blob/a3fb823356a9ed1d16eb8535340c9813b7eb547d/src/lib/webcontainer.ts#L301

import { exec } from 'node:child_process';
import { join } from 'node:path/posix';
import { z } from 'zod';

const diagnosticSchema = z.object({
	type: z
		.string()
		.toLowerCase()
		.refine((type): type is 'error' | 'warning' =>
			['error', 'warning'].includes(type),
		),
	filename: z.string().transform((filename) => `./${filename}`),
	start: z.object({
		line: z.number().transform((line) => line + 1),
		character: z.number(),
	}),
	end: z.object({
		line: z.number().transform((line) => line + 1),
		character: z.number(),
	}),
	message: z.string(),
	code: z.union([z.number(), z.string()]).optional(),
	source: z.string().optional(),
});

type RawDiagnostic = z.infer<typeof diagnosticSchema>;

/**
 * A svelte-check diagnostic provides an issue in the codebase
 * patched to include an aboslute file path
 */
export interface Diagnostic extends Omit<RawDiagnostic, 'filename'> {
	fileName: string;
	path: string;
}

/**
 * Run svelte-check at a given directory and return all the issues it finds
 * @param cwd The directory to run svelte-check in
 * @returns Diagnostics
 */
export async function get_diagnostics(cwd: string) {
	return new Promise<Diagnostic[]>((resolve) => {
		exec(
			'pnpm exec svelte-check --output machine-verbose',
			{ cwd },
			(error, stdout, stderr) => {
				const lines = [...stdout.split('\n'), ...stderr.split('\n')];
				const diagnostics: Diagnostic[] = [];

				for (const line of lines) {
					const result = line
						.trim()
						.match(/^\d+\s(?<diagnostic>.*)$/);

					if (result && result.groups) {
						try {
							const raw = JSON.parse(result.groups.diagnostic);
							const { filename, ...diagnostic } =
								diagnosticSchema.parse(raw);

							diagnostics.push({
								...diagnostic,
								fileName: filename,
								path: join(cwd, filename),
							});
						} catch (e) {}
					}
				}

				resolve(diagnostics);
			},
		);
	});
}
