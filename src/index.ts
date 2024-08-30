import { render, type PRFile } from './render';
import { get_diagnostics } from './diagnostic';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { join } from 'node:path';

async function main() {
	const token = process.env.GITHUB_TOKEN;
	if (!token) throw new Error('Please add the GITHUB_TOKEN environment variable');

	const repo_root = process.env.GITHUB_WORKSPACE;
	if (!repo_root) throw new Error('Missing GITHUB_WORKSPACE environment variable');

	const given_root = join(repo_root, core.getInput('path') || '.');

	const octokit = github.getOctokit(token);

	const pull_number = github.context.payload.pull_request?.number;
	if (!pull_number) throw new Error("Can't find a pull request, are you running this on a pr?");

	const { owner, repo } = github.context.repo;

	console.log('using context', {
		root: repo_root,
		given_root,
		pull_number,
		owner,
		repo,
	});

	const { data: comments } = await octokit.rest.issues.listComments({
		issue_number: pull_number,
		owner,
		repo,
	});

	console.log(
		JSON.stringify(
			comments.map((c) => ({
				id: c.id,
				author: c.user?.name,
				content: c.body?.slice(0, 100),
			})),
			null,
			2,
		),
	);

	const { data: pr_files_list } = await octokit.rest.pulls.listFiles({
		pull_number,
		owner,
		repo,
	});

	const pr_files = pr_files_list.map(
		(file): PRFile => ({
			relative_path: file.filename,
			blob_url: file.blob_url,
		}),
	);

	const diagnostics = await get_diagnostics(given_root);
	const markdown = await render(diagnostics, repo_root, pr_files);

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
