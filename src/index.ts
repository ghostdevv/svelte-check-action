import { get_diagnostics } from './diagnostic';
import { writeFile } from 'node:fs/promises';
import { render } from './render';

const CWD = '';

const CHANGED_FILES = [];

const all_diagnostics = await get_diagnostics(CWD);
const markdown = await render(all_diagnostics, CWD, CHANGED_FILES);

await writeFile('./output.md', markdown, 'utf-8');
