# GitHub Changelog Generator

Create a simple changelog based on closed GitHub issues.

## Installation

    npm install -g github-changelog

## Usage

See `gh-changelog --help` for detailed usage.

    Usage: gh-changelog [options]

    Options:

      -h, --help              output usage information
      -o, --owner <name>      Repository owner name.  If not provided, the
                              "username" option will be used.
      -r, --repo <repo>       Repository name (required).
      -u, --username <name>   Your GitHub username (only required for private
                              repos).
      -p, --password <pass>   Your GitHub password (only required for private
                              repos).
      -f, --file <filename>   Output file.  If the file exists, log will be
                              prepended to it.  Default is to write to stdout.
      -s, --since <iso-date>  Last changelog date.  If the "file" option is used
                              and "since" is not provided, the mtime of the
                              output file will be used.
      -e, --header <header>   Header text.  Default is "Changes since <since>".


## Examples

Create a new `changelog.md` file listing issues closed in the `my-username/my-repo` repository since 2013-06-01.

    gh-changelog --owner my-username --repo my-repo --since 2013-06-01 > changelog.md

Prepend new changes to existing `changelog.md` file (lists issues closed since `changelog.md` was last modified).

    gh-changelog --owner my-username --repo my-repo --file changelog.md

Generate a changelog for a private repository (requiring username and password to authenticate):

    gh-changelog --owner some-repo-owner --repo some-repo --username my-username --password my-password --since 2013-06-01
