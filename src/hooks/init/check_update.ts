import {Hook} from '@oclif/config'
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
      if (distTags && distTags.latest && semver.gt(distTags.latest, config.version)) {
        this.warn(`${config.name} update available to ${distTags.latest} from ${config.version}`)
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }

  const refreshNeeded = async () => {
    try {
      const {mtime} = await fs.stat(file)
      const staleAt = new Date(mtime.valueOf() + 1000 * 60 * 60 * 24)
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
      [path.join(__dirname, '../../../lib/get_version'), config.name, file],
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
