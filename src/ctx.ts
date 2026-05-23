import * as github from '@actions/github';
import * as core from '@actions/core';
import picomatch from 'picomatch';
import { join } from 'node:path';

export interface Config {
	/**
	 * The path(s) to run svelte-check from, one per line
	 * @default cwd
	 */
	diagnostic_paths: string[];

	/**
	 * When enabled only the files that change in the pull request will be checked. If a list of globs is provided, we will only apply this filtering to files matching the globs.
	 * @default true
	 */
	filter_changes: boolean | picomatch.Matcher;

	/**
	 * Should we cause CI to fail if there is a Svelte Check error?
	 * @default false
	 */
	fail_on_error: boolean;

	/**
	 * Should we cause CI to fail if there is a Svelte Check error?
	 * @default false
	 */
	fail_on_warning: boolean;

	/**
	 * The filter to check when finding errors
	 */
	fail_filter: picomatch.Matcher;
}

export interface CTX {
	/**
	 * The user given config
	 */
	config: Config;

	/**
	 * The absolute path to the root of the repository on the actions fs
	 */
	repo_root: string;

	/**
	 * The GitHub access token
	 */
	token: string;

	/**
	 * The number of the current pull request
	 */
	pr_number: number;

	/**
	 * The octokit instance to use for GitHub API
	 */
	octokit: ReturnType<typeof github.getOctokit>;

	/**
	 * The repo owner
	 */
	owner: string;

	/**
	 * The repo name
	 */
	repo: string;
}

/**
 * Get the actions current context
 */
export function get_ctx(): CTX {
	const token = core.getInput('token') || process.env.GITHUB_TOKEN;
	if (!token) {
		throw new Error(
			'Unable to find a GitHub token. Please set the `token` option if required.',
		);
	}

	if (process.env.GITHUB_TOKEN) {
		core.warning(
			'Support for the GITHUB_TOKEN environment variable will be removed in the next major version of ghostdevv/svelte-check-action',
		);
	}

	const octokit = github.getOctokit(token);

	const repo_root = process.env.GITHUB_WORKSPACE;
	if (!repo_root) throw new Error('Missing GITHUB_WORKSPACE environment variable');

	const pr_number = github.context.payload.pull_request?.number;
	if (!pr_number) throw new Error("Can't find a pull request, are you running this on a pr?");

	const diagnostic_paths = core.getMultilineInput('paths').map((path) => join(repo_root, path));
	if (!diagnostic_paths.length) diagnostic_paths.push(repo_root);

	const filter_changes = get_boolean_or_picomatch_input('filterChanges', repo_root);

	const fail_filter = picomatch(core.getMultilineInput('failFilter'));
	const fail_on_warning = core.getBooleanInput('failOnWarning');
	const fail_on_error = core.getBooleanInput('failOnError');

	return {
		token,
		octokit,
		pr_number,
		repo_root,
		repo: github.context.repo.repo,
		owner: github.context.repo.owner,
		config: {
			diagnostic_paths,
			filter_changes,
			fail_on_warning,
			fail_on_error,
			fail_filter,
		},
	};
}

function get_boolean_or_picomatch_input(
	name: string,
	repo_root: string,
): boolean | picomatch.Matcher {
	try {
		return core.getBooleanInput(name);
	} catch {
		return picomatch(core.getMultilineInput(name));
	}
}
