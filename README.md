# Svelte Check Action

This action runs [svelte-check](http://npmjs.com/svelte-check) on the files that change in a PR, then adds a comment which reports any errors in those files. The inspiration came from wanting to have svelte-check run in CI without failing, so that we can progressively fix a codebase with a lot of issues.

## Example

```yaml
name: Svelte Check

on:
    - pull_request

jobs:
    demo:
        runs-on: ubuntu-latest
        steps:
            - name: Checkout
              uses: actions/checkout@v4

            # You can replace these steps with your specific setup steps
            # This example assumes Node 22 and pnpm 8
            - name: Setup Node 22
              uses: actions/setup-node@v4
              with:
                  node-version: 22
                  registry-url: https://registry.npmjs.org/

            - name: Setup PNPM
              uses: pnpm/action-setup@v3.0.0
              with:
                  version: 8.12.1

            - name: Install
              run: pnpm install

            # Run the svelte check action
            - name: Svelte Check
              uses: ghostdevv/svelte-check-action@main
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Options

| Option  | Description                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| `paths` | The folder(s) to run svelte-check in, one per line. It'll only run svelte-check if files in that folder have changed |

You can configure the action by passing the options under the `with` key, for example:

```yaml
- name: Svelte Check
  uses: ghostdevv/svelte-check-action@main
  with:
      paths: |
          ./packages/app
  env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
