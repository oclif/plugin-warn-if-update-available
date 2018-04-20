import {Hook} from '@oclif/config'
import Chalk from 'chalk'
import {spawn} from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as semver from 'semver'

const debug = require('debug')('update-check')

const hook: Hook<'init'> = async function ({config}) {
  const file = path.join(config.cacheDir, 'version')

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
      const cfg = (config.pjson.oclif as any)['warn-if-update-available'] || {}
      const timeoutInDays = cfg.timeoutInDays || 60
      const {mtime} = await fs.stat(file)
      const staleAt = new Date(mtime.valueOf() + 1000 * 60 * 60 * 24 * timeoutInDays)
      if (staleAt < new Date()) return true
      const versions = await fs.readJSON(file)
      return !versions.current || versions.current !== config.version
    } catch (err) {
      debug(err)
      return true
    }
  }

  const spawnRefresh = async () => {
    debug('spawning version refresh')
    spawn(
      process.execPath,
      [path.join(__dirname, '../../../lib/get_version'), config.name, file, config.version],
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
