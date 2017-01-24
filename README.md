# GitHub Changelog Generator

[![Greenkeeper badge](https://badges.greenkeeper.io/tschaub/github-changelog.svg)](https://greenkeeper.io/)

Create a simple changelog based on closed GitHub issues.

## Installation

    npm install -g github-changelog

## Usage

See `gh-changelog --help` for detailed usage.

    Usage: gh-changelog [options]

    Options:

      -h, --help                     output usage information
      -o, --owner <name>             Repository owner name (required).
      -r, --repo <repo>              Repository name (required).
      -t, --token <token>            Your GitHub token (required).
      -s, --since <iso-date-or-sha>  Initial date or commit sha (required).
      -u, --until <iso-date-or-sha>  Limit date or commit sha.
      -p, --template <path>          EJS template to format data.The default bundled template generates a list of issues in Markdown
      -g, --gist                     Publish output to a Github gist.
      -d, --data <data>              Set arbitrary JSON data available in the template.
      -j, --json                     Get output in JSON.

## Examples

Create a new `changelog.md` file listing issues closed in the `my-username/my-repo` repository since 2013-06-01.

    gh-changelog --owner my-username --repo my-repo --since 2013-06-01 --token my-token > changelog.md
