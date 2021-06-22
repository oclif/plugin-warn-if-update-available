# @envoy/plugin-warn-if-update-available

warns if there is a newer version of CLI released

[![Version](https://img.shields.io/github/package-json/v/envoy/plugin-warn-if-update-available)](https://github.com/envoy/plugin-warn-if-update-available/packages/860241)
[![CircleCI](https://circleci.com/gh/envoy/plugin-warn-if-update-available/tree/master.svg?style=shield)](https://circleci.com/gh/envoy/plugin-warn-if-update-available/tree/master.svg?style=shield)
[![License](https://img.shields.io/github/license/envoy/plugin-warn-if-update-available)](https://github.com/envoy/plugin-warn-if-update-available/blob/master/package.json)

<!-- toc -->
* [@envoy/plugin-warn-if-update-available](#envoyplugin-warn-if-update-available)
* [What is this?](#what-is-this)
* [How it works](#how-it-works)
* [Installation](#installation)
* [Configuration](#configuration)
<!-- tocstop -->

# What is this?

This plugin shows a warning message if a user is running an out of date CLI.

![screenshot](./assets/screenshot.png)

# How it works

This checks the version against the npm registry asynchronously in a forked process, at most once per 7 days. It then saves a version file to the cache directory that will enable the warning. The upside of this method is that it won't block a user while they're using your CLI—the downside is that it will only display _after_ running a command that fetches the new version.

# Installation

Add the plugin to your project with `yarn add @envoy/plugin-warn-if-update-available`, then add it to the `package.json` of the oclif CLI:

```js
{
  "name": "mycli",
  "version": "0.0.0",
  // ...
  "oclif": {
    "plugins": ["@oclif/plugin-help", "@envoy/plugin-warn-if-update-available"]
  }
}
```

# Configuration

In `package.json`, set `oclif['warn-if-update-available']` to an object with
any of the following configuration properties:

- `timeoutInDays` - Duration between update checks. Defaults to 60.
- `message` - Customize update message.

## Example configuration

```json
{
  "oclif": {
    "plugins": ["@envoy/plugin-warn-if-update-available"],
    "warn-if-update-available": {
      "timeoutInDays": 7,
      "message": "<%= config.name %> update available from <%= chalk.greenBright(config.version) %> to <%= chalk.greenBright(latest) %>."
    }
  }
}
```
