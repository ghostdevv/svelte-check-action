import { get_diagnostics } from './diagnostic';
import { writeFile } from 'node:fs/promises';
import * as core from '@actions/core';
import { render } from './render';

core.setFailed('testing');

// const CWD = '';

// const CHANGED_FILES: string[] = [];

// const all_diagnostics = await get_diagnostics(CWD);
// const markdown = await render(all_diagnostics, CWD, CHANGED_FILES);

// await writeFile('./output.md', markdown, 'utf-8');
