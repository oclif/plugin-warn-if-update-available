import {Hook} from '@oclif/config'
import Chalk from 'chalk'
import {spawn} from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as semver from 'semver'

const debug = require('debug')('update-check')

const hook: Hook<'init'> = async function ({config}) {
  const file = path.join(config.cacheDir, 'version')

  // Destructure package.json configuration with defaults
  const {
    timeoutInDays = 60,
    registry = 'https://registry.npmjs.org',
    authorization = '',
  } = (config.pjson.oclif as any)['warn-if-update-available'] || {}

  const checkVersion = async () => {
    try {
      const distTags = await fs.readJSON(file)
      if (config.version.includes('-')) {
        // TODO: handle channels
        return
      }
      if (distTags && distTags.latest && semver.gt(distTags.latest.split('-')[0], config.version.split('-')[0])) {
        const chalk: typeof Chalk = require('chalk')
        this.warn(`${config.name} update available from ${chalk.greenBright(config.version)} to ${chalk.greenBright(distTags.latest)}`)
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }

  const refreshNeeded = async () => {
    try {
      const {mtime} = await fs.stat(file)
      const staleAt = new Date(mtime.valueOf() + 1000 * 60 * 60 * 24 * timeoutInDays)
      return staleAt < new Date()
    } catch (err) {
      debug(err)
      return true
    }
  }

  const spawnRefresh = async () => {
    debug('spawning version refresh')
    spawn(
      process.execPath,
      [path.join(__dirname, '../../../lib/get-version'), config.name, file, config.version, registry, authorization],
      {
        detached: !config.windows,
        stdio: 'ignore',
      }
    ).unref()
  }

  await checkVersion()
  if (await refreshNeeded()) await spawnRefresh()
}

export default hook
