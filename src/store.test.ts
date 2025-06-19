import { basename, join, isAbsolute } from 'node:path';
import type { Diagnostic } from './diagnostic';
import { describe, it, expect } from 'vitest';
import { DiagnosticStore } from './store';
import picomatch from 'picomatch';
import type { CTX } from './ctx';

function root_path(path?: string) {
	return path && isAbsolute(path) ? path : join(import.meta.dirname, '..', path || '');
}

function create_ctx(filter_changes: boolean | string[]): CTX {
	const repo_root = root_path();
	return {
		token: '',
		repo: 'ghostdevv/svelte-check-action',
		owner: 'ghostdevv',
		repo_root,
		pr_number: 1,
		octokit: {} as any,
		config: {
			fail_filter: picomatch('**'),
			fail_on_error: false,
			fail_on_warning: false,
			diagnostic_paths: [],
			filter_changes:
				typeof filter_changes === 'boolean'
					? filter_changes
					: picomatch(filter_changes, { cwd: repo_root }),
		},
	};
}

function create_diagnostic(path: string, type: 'error' | 'warning' = 'error'): Diagnostic {
	return {
		type,
		message: 'mock diagnostic',
		path: root_path(path),
		fileName: basename(path),
		start: { character: 3, line: 2 },
		end: { character: 5, line: 2 },
	};
}

describe('DiagnosticStore', () => {
	it('never skips when filter changes is false', () => {
		const ctx = create_ctx(false);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/b.svelte');

		const store = new DiagnosticStore(ctx, [a.path]);
		store.add(a);
		store.add(b);

		expect(store.list()).toMatchObject([a, b]);
		expect(store.count).toBe(2);
	});

	it('skips when filter changes is true', () => {
		const ctx = create_ctx(true);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/b.svelte');

		const store = new DiagnosticStore(ctx, [a.path]);
		store.add(a);
		store.add(b);

		expect(store.list()).toMatchObject([a]);
		expect(store.count).toBe(1);
	});

	it('skips when filter changes matches', () => {
		const ctx = create_ctx(['lib/**/*.svelte']);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/b.svelte');
		const c = create_diagnostic('lib/c.svelte');

		const store = new DiagnosticStore(ctx, [a.path]);
		store.add(a);
		store.add(b);
		store.add(c);

		expect(store.list()).toMatchObject([a, b]);
		expect(store.count).toBe(2);
	});

	it('never skips when changed_files is null regardless of filter_changes', () => {
		const ctx = create_ctx(true);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/b.svelte');

		const store = new DiagnosticStore(ctx, null);
		store.add(a);
		store.add(b);

		expect(store.list()).toMatchObject([a, b]);
		expect(store.count).toBe(2);
	});

	it('never skips when changed_files is null with glob pattern', () => {
		const ctx = create_ctx(['src/**/*.svelte']);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('lib/b.svelte');

		const store = new DiagnosticStore(ctx, null);
		store.add(a);
		store.add(b);

		expect(store.list()).toMatchObject([a, b]);
		expect(store.count).toBe(2);
	});

	it('does not skip when glob pattern does not match diagnostic path', () => {
		const ctx = create_ctx(['lib/**/*.svelte']);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/b.svelte');
		const c = create_diagnostic('lib/c.svelte');

		// Only 'a' is in changed files, but 'b' should not be skipped because
		// it doesn't match the glob pattern, so filtering doesn't apply to it
		const store = new DiagnosticStore(ctx, [a.path]);
		store.add(a);
		store.add(b);
		store.add(c);

		expect(store.list()).toMatchObject([a, b]);
		expect(store.count).toBe(2);
	});

	it('skips when glob pattern matches but file not in changed_files', () => {
		const ctx = create_ctx(['lib/**/*.svelte']);
		const a = create_diagnostic('src/a.svelte');
		const c = create_diagnostic('lib/c.svelte');
		const d = create_diagnostic('lib/d.svelte');

		// Only 'c' is in changed files, 'd' matches glob but should be skipped
		const store = new DiagnosticStore(ctx, [a.path, c.path]);
		store.add(a);
		store.add(c);
		store.add(d);

		expect(store.list()).toMatchObject([a, c]);
		expect(store.count).toBe(2);
	});

	it('handles mixed diagnostic types correctly', () => {
		const ctx = create_ctx(true);
		const error_diagnostic = create_diagnostic('src/error.svelte');
		const warning_diagnostic = create_diagnostic('src/warning.svelte', 'warning');

		const store = new DiagnosticStore(ctx, [error_diagnostic.path]);
		store.add(error_diagnostic);
		store.add(warning_diagnostic);

		expect(store.list()).toMatchObject([error_diagnostic]);
		expect(store.count).toBe(1);
		expect(store.error_count).toBe(1);
		expect(store.warning_count).toBe(0);
	});

	it('correctly counts diagnostics when some are skipped', () => {
		const ctx = create_ctx(true);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/b.svelte');
		const warning = create_diagnostic('src/warning.svelte', 'warning');

		const store = new DiagnosticStore(ctx, [a.path, warning.path]);
		store.add(a);
		store.add(b);
		store.add(warning);

		expect(store.list()).toMatchObject([a, warning]);
		expect(store.count).toBe(2);
		expect(store.error_count).toBe(1);
		expect(store.warning_count).toBe(1);
	});

	it('handles complex glob patterns correctly', () => {
		const ctx = create_ctx(['src/**/*.{svelte,ts}', 'lib/**/*.svelte']);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/utils.ts');
		const c = create_diagnostic('lib/c.svelte');
		const d = create_diagnostic('other/d.svelte');
		const e = create_diagnostic('src/nested/e.svelte');

		// Only a and c are in changed files
		const store = new DiagnosticStore(ctx, [a.path, c.path]);
		store.add(a);
		store.add(b); // matches pattern but not in changed_files, should be skipped
		store.add(c);
		store.add(d); // doesn't match pattern, should not be skipped
		store.add(e); // matches pattern but not in changed_files, should be skipped

		expect(store.list()).toMatchObject([a, c, d]);
		expect(store.count).toBe(3);
	});

	it('skips all diagnostics when filter_changes is true and changed_files is empty array', () => {
		const ctx = create_ctx(true);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/b.svelte');

		const store = new DiagnosticStore(ctx, []);
		store.add(a);
		store.add(b);

		expect(store.list()).toMatchObject([]);
		expect(store.count).toBe(0);
	});

	it('skips matching diagnostics when glob pattern is used and changed_files is empty array', () => {
		const ctx = create_ctx(['src/**/*.svelte']);
		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('lib/b.svelte');

		const store = new DiagnosticStore(ctx, []);
		store.add(a); // matches pattern but not in changed_files, should be skipped
		store.add(b); // doesn't match pattern, should not be skipped

		expect(store.list()).toMatchObject([b]);
		expect(store.count).toBe(1);
	});

	it('handles diagnostics with same basename but different directories', () => {
		const ctx = create_ctx(true);
		const a = create_diagnostic('src/component.svelte');
		const b = create_diagnostic('lib/component.svelte');

		const store = new DiagnosticStore(ctx, [a.path]);
		store.add(a);
		store.add(b);

		expect(store.list()).toMatchObject([a]);
		expect(store.count).toBe(1);
	});

	it('counts filtered diagnostics when fail_filter matches all paths', () => {
		const ctx = create_ctx(false);
		// fail_filter is already set to '**' in create_ctx, so it matches everything
		const a = create_diagnostic('src/a.svelte');
		const warning = create_diagnostic('src/warning.svelte', 'warning');

		const store = new DiagnosticStore(ctx, null);
		store.add(a);
		store.add(warning);

		expect(store.filtered_count).toBe(2);
		expect(store.filtered_error_count).toBe(1);
		expect(store.filtered_warning_count).toBe(1);
	});

	it('does not count filtered diagnostics when fail_filter does not match', () => {
		const repo_root = root_path();
		const ctx: CTX = {
			token: '',
			repo: 'ghostdevv/svelte-check-action',
			owner: 'ghostdevv',
			repo_root,
			pr_number: 1,
			octokit: {} as any,
			config: {
				fail_filter: picomatch('lib/**'), // Only match lib files
				fail_on_error: false,
				fail_on_warning: false,
				diagnostic_paths: [],
				filter_changes: false,
			},
		};

		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('lib/b.svelte');
		const warning = create_diagnostic('src/warning.svelte');

		const store = new DiagnosticStore(ctx, null);
		store.add(a); // src/a.svelte doesn't match lib/**, so not filtered
		store.add(b); // lib/b.svelte matches lib/**, so is filtered
		store.add(warning); // src/warning.svelte doesn't match lib/**, so not filtered

		expect(store.count).toBe(3);
		expect(store.filtered_count).toBe(1);
		expect(store.filtered_error_count).toBe(1);
		expect(store.filtered_warning_count).toBe(0);
	});

	it('handles filtered counts correctly with skip logic', () => {
		const repo_root = root_path();
		const ctx: CTX = {
			token: '',
			repo: 'ghostdevv/svelte-check-action',
			owner: 'ghostdevv',
			repo_root,
			pr_number: 1,
			octokit: {} as any,
			config: {
				fail_filter: picomatch('src/**'), // Only match src files
				fail_on_error: false,
				fail_on_warning: false,
				diagnostic_paths: [],
				filter_changes: true,
			},
		};

		const a = create_diagnostic('src/a.svelte');
		const b = create_diagnostic('src/b.svelte');
		const c = create_diagnostic('lib/c.svelte');

		// Only 'a' and 'c' are in changed files
		const store = new DiagnosticStore(ctx, [a.path, c.path]);
		store.add(a); // included, matches fail_filter
		store.add(b); // skipped due to filter_changes
		store.add(c); // included, doesn't match fail_filter

		expect(store.count).toBe(2); // a and c
		expect(store.filtered_count).toBe(1); // only a matches fail_filter
		expect(store.filtered_error_count).toBe(1);
		expect(store.filtered_warning_count).toBe(0);
	});

	it('handles multiple glob patterns correctly', () => {
		const ctx = create_ctx(['src/**/*.svelte', 'lib/**/*.ts', 'components/**/*.svelte']);
		const a = create_diagnostic('src/page.svelte');
		const b = create_diagnostic('lib/utils.ts');
		const c = create_diagnostic('components/Button.svelte');
		const d = create_diagnostic('src/helper.js'); // doesn't match any pattern
		const e = create_diagnostic('other/file.svelte'); // doesn't match any pattern
		const f = create_diagnostic('lib/config.js'); // doesn't match any pattern

		// Only a, c, and e are in changed files
		const store = new DiagnosticStore(ctx, [a.path, c.path, e.path]);
		store.add(a); // matches src/**/*.svelte, in changed files -> included
		store.add(b); // matches lib/**/*.ts, not in changed files -> skipped
		store.add(c); // matches components/**/*.svelte, in changed files -> included
		store.add(d); // doesn't match any pattern -> included (not filtered)
		store.add(e); // doesn't match any pattern -> included (not filtered)
		store.add(f); // doesn't match any pattern -> included (not filtered)

		expect(store.list()).toMatchObject([a, c, d, e, f]);
		expect(store.count).toBe(5);
	});

	it('handles extglob patterns to exclude directories', () => {
		const ctx = create_ctx(['!(src/**/*)/**/*']); // excludes src and everything under it
		const a = create_diagnostic('src/component.svelte');
		const b = create_diagnostic('src/nested/file.ts');
		const c = create_diagnostic('lib/utils.ts');
		const d = create_diagnostic('components/Button.svelte');
		const e = create_diagnostic('test/spec.js');

		// Only a and c are in changed files
		const store = new DiagnosticStore(ctx, [a.path, c.path]);
		store.add(a); // doesn't match !(src/**)/**/* (is excluded) -> included (not filtered)
		store.add(b); // doesn't match !(src/**)/**/* (is excluded) -> included (not filtered)
		store.add(c); // matches !(src/**)/**/* pattern, in changed files -> included
		store.add(d); // matches !(src/**)/**/* pattern, not in changed files -> skipped
		store.add(e); // matches !(src/**)/**/* pattern, not in changed files -> skipped

		expect(store.list()).toMatchObject([a, b, c]);
		expect(store.count).toBe(3);
	});
});
