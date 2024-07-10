import { get_diagnostics } from './diagnostic';
import { writeFile } from 'node:fs/promises';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { render } from './render';

async function main() {
	const token = core.getInput('github-token', { required: true });
	const octokit = github.getOctokit(token);

	const pr_number = github.context.payload.pull_request?.number;
	if (!pr_number) throw new Error("Can't find a pull request, are you running this on a pr?");

	const { owner, repo } = github.context.repo;

	const { data: pr } = await octokit.rest.pulls.get({
		pull_number: pr_number,
		owner,
		repo,
	});

	console.log(`PR Title: ${pr.title}`);
	console.log(`PR Body: ${pr.body}`);
	console.log(`PR Author: ${pr.user.login}`);
	console.log(`PR Base Branch: ${pr.base.ref}`);
	console.log(`PR Head Branch: ${pr.head.ref}`);
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
