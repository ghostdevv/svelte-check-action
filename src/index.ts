import { get_diagnostics } from './diagnostic';
import { writeFile } from 'node:fs/promises';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { render } from './render';
import { join } from 'node:path';

async function main() {
	const token = process.env.GITHUB_TOKEN;
	if (!token) throw new Error('Please add the GITHUB_TOKEN environment variable');

	const root = process.env.GITHUB_WORKSPACE;
	if (!root) throw new Error('Missing GITHUB_WORKSPACE environment variable');

	const given_root = join(root, core.getInput('path') || '.');

	const octokit = github.getOctokit(token);

	const pull_number = github.context.payload.pull_request?.number;
	if (!pull_number) throw new Error("Can't find a pull request, are you running this on a pr?");

	const { owner, repo } = github.context.repo;

	console.log('using context', {
		root,
		given_root,
		pull_number,
		owner,
		repo,
	});

	const { data: pr_files } = await octokit.rest.pulls.listFiles({
		pull_number,
		owner,
		repo,
	});

	const changed_files = pr_files.map((file) => join(root, file.filename));
	const diagnostics = await get_diagnostics(given_root);
	const markdown = await render(diagnostics, changed_files);

	await octokit.rest.issues.createComment({
		issue_number: pull_number,
		body: markdown,
		owner,
		repo,
	});
}

main()
	.then(() => console.log('Finished'))
	.catch((error) => core.setFailed(error instanceof Error ? error.message : `${error}`));

// const CWD = '';

// const CHANGED_FILES: string[] = [];

// const all_diagnostics = await get_diagnostics(CWD);
// const markdown = await render(all_diagnostics, CWD, CHANGED_FILES);

// await writeFile('./output.md', markdown, 'utf-8');

// hello world
