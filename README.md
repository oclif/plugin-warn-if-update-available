@oclif/plugin-warn-if-update-available
======================================

warns if there is a newer version of CLI released

[![Version](https://img.shields.io/npm/v/@oclif/plugin-warn-if-update-available.svg)](https://npmjs.org/package/@oclif/plugin-warn-if-update-available)
[![CircleCI](https://circleci.com/gh/jdxcode/plugin-warn-if-update-available/tree/master.svg?style=shield)](https://circleci.com/gh/jdxcode/plugin-warn-if-update-available/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/jdxcode/plugin-warn-if-update-available?branch=master&svg=true)](https://ci.appveyor.com/project/jdxcode/plugin-warn-if-update-available/branch/master)
[![Codecov](https://codecov.io/gh/jdxcode/plugin-warn-if-update-available/branch/master/graph/badge.svg)](https://codecov.io/gh/jdxcode/plugin-warn-if-update-available)
[![Downloads/week](https://img.shields.io/npm/dw/@oclif/plugin-warn-if-update-available.svg)](https://npmjs.org/package/@oclif/plugin-warn-if-update-available)
[![License](https://img.shields.io/npm/l/@oclif/plugin-warn-if-update-available.svg)](https://github.com/jdxcode/plugin-warn-if-update-available/blob/master/package.json)

<!-- toc -->
* [What is this?](#what-is-this)
* [Installation](#installation)
<!-- tocstop -->

# What is this?

This plugin shows a warning message if a user is running an out of date CLI.

# Installation

Add the plugin to your project with `yarn add @oclif/plugin-warn-if-update-available`, then add it to the `package.json` of the oclif CLI:

```js
{
  "name": "mycli",
  "version": "0.0.0",
  // ...
  "oclif": {
    "plugins": ["@oclif/plugin-help", "@oclif/plugin-warn-if-update-available"]
  }
}
```
