import { get_diagnostics, type Diagnostic } from './diagnostic';
import { join, relative, normalize } from 'node:path';
import { render, type PRFile } from './render';
import * as github from '@actions/github';
import * as core from '@actions/core';

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

	const { owner, repo } = github.context.repo;

	const diagnostic_paths = core.getMultilineInput('paths').map((path) => join(repo_root, path));
	if (diagnostic_paths.length == 0) diagnostic_paths.push(repo_root);

	const { data: pr_files_list } = await octokit.rest.pulls.listFiles({
		pull_number,
		owner,
		repo,
	});

	const pr_files = pr_files_list.map(
		(file): PRFile => ({
			local_path: join(repo_root, file.filename),
			relative_path: file.filename,
			blob_url: file.blob_url,
		}),
	);

	const filterChanges = core.getBooleanInput('filterChanges') ?? true;

	console.log('debug:', {
		diagnostic_paths,
		root: repo_root,
		pull_number,
		pr_files,
		owner,
		repo,
		filterChanges,
	});

	const diagnostics: Diagnostic[] = [];

	for (const d_path of diagnostic_paths) {
		const has_changed = filterChanges
			? pr_files.some((pr_file) => is_subdir(d_path, pr_file.local_path))
			: true;

		console.log(has_changed ? 'checking' : 'skipped', d_path);

		if (has_changed) {
			const new_diagnostics = await get_diagnostics(d_path);
			diagnostics.push(...new_diagnostics);
		}
	}

	const markdown = await render(
		diagnostics,
		repo_root,
		filterChanges
			? pr_files
			: diagnostics.flatMap((d) => ({
					relative_path: d.fileName,
					local_path: d.path,
					blob_url: 'https://todo',
				})),
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
