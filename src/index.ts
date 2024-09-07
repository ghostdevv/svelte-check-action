import { get_diagnostics, type Diagnostic } from './diagnostic';
import { join, relative, normalize } from 'node:path';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { render } from './render';

function is_subdir(parent: string, child: string) {
	return !relative(normalize(parent), normalize(child)).startsWith('..');
}

async function main() {
	const token = process.env.GITHUB_TOKEN;
	if (!token) throw new Error('Please add the GITHUB_TOKEN environment variable');

	const repo_root = process.env.GITHUB_WORKSPACE;
	if (!repo_root) throw new Error('Missing GITHUB_WORKSPACE environment variable');

	const octokit = github.getOctokit(token);

	const pull_number = github.context.payload.pull_request?.number;
	if (!pull_number) throw new Error("Can't find a pull request, are you running this on a pr?");

	const filter_changes = core.getBooleanInput('filterChanges') ?? true;
	const { owner, repo } = github.context.repo;

	const pr_files_response = filter_changes
		? await octokit.rest.pulls.listFiles({
				pull_number,
				owner,
				repo,
			})
		: null;

	const { data: pr } = await octokit.rest.pulls.get({
		pull_number,
		owner,
		repo,
	});

	const diagnostic_paths = core.getMultilineInput('paths').map((path) => join(repo_root, path));
	if (diagnostic_paths.length == 0) diagnostic_paths.push(repo_root);

	const pr_files = pr_files_response?.data.map((file) => join(repo_root, file.filename));
	const latest_commit = pr.head.sha;

	console.log('debug:', {
		diagnostic_paths,
		filter_changes,
		latest_commit,
		pull_number,
		repo_root,
		pr_files,
		owner,
		repo,
	});

	const diagnostics: Diagnostic[] = [];

	for (const d_path of diagnostic_paths) {
		const has_changed = pr_files && pr_files.some((pr_file) => is_subdir(d_path, pr_file));
		console.log(has_changed ? 'checking' : 'skipped', d_path);

		if (has_changed) {
			const new_diagnostics = await get_diagnostics(d_path);
			diagnostics.push(...new_diagnostics);
		}
	}

	const markdown = await render(
		diagnostics,
		repo_root,
		`https://github.com/${owner}/${repo}/blob/${latest_commit}`,
		filter_changes ? pr_files : diagnostics.map((d) => d.path),
	);

	const { data: comments } = await octokit.rest.issues.listComments({
		issue_number: pull_number,
		owner,
		repo,
	});

	const last_comment = comments
		.filter((comment) => comment.body?.startsWith('# Svelte Check Results'))
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		.at(0);

	if (last_comment) {
		await octokit.rest.issues.updateComment({
			comment_id: last_comment.id,
			issue_number: pull_number,
			body: markdown,
			owner,
			repo,
		});
	} else {
		await octokit.rest.issues.createComment({
			issue_number: pull_number,
			body: markdown,
			owner,
			repo,
		});
	}
}

main()
	.then(() => console.log('Finished'))
	.catch((error) => core.setFailed(error instanceof Error ? error.message : `${error}`));
