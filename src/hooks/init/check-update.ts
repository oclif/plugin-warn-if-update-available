import {Hook} from '@oclif/core'
import type {Chalk} from 'chalk'
import {spawn} from 'child_process'
import {readFile, stat} from 'fs/promises'
import {join} from 'path'

const hook: Hook<'init'> = async function ({config}) {
  const file = join(config.cacheDir, 'version')

  // Destructure package.json configuration with defaults
  const {
    timeoutInDays = 60,
    message = '<%= config.name %> update available from <%= chalk.greenBright(config.version) %> to <%= chalk.greenBright(latest) %>.',
    registry = 'https://registry.npmjs.org',
    authorization = '',
  } = (config.pjson.oclif as any)['warn-if-update-available'] || {}

  const checkVersion = async () => {
    try {
      // do not show warning if updating
      if (process.argv[2] === 'update') return
      const distTags = JSON.parse(await readFile(file, 'utf8'))
      if (config.version.includes('-')) {
        // to-do: handle channels
        return
      }
      const semverGt = await import('semver/functions/gt')
      if (distTags && distTags.latest && semverGt(distTags.latest.split('-')[0], config.version.split('-')[0])) {
        const chalk: Chalk = require('chalk')
        // Default message if the user doesn't provide one
        const template = require('lodash.template')
        this.warn(template(message)({
          chalk,
          config,
          ...distTags,
        }))
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  const refreshNeeded = async () => {
    if (this.config.scopedEnvVarTrue('FORCE_VERSION_CACHE_UPDATE')) return true
    try {
      const {mtime} = await stat(file)
      const staleAt = new Date(mtime.valueOf() + (1000 * 60 * 60 * 24 * timeoutInDays))
      return staleAt < new Date()
    } catch (error) {
      const debug = require('debug')('update-check')
      debug(error)
      return true
    }
  }

  const spawnRefresh = async () => {
    const debug = require('debug')('update-check')
    debug('spawning version refresh')
    spawn(
      process.execPath,
      [join(__dirname, '../../../lib/get-version'), config.name, file, config.version, registry, authorization],
      {
        detached: !config.windows,
        stdio: 'ignore',
      },
    ).unref()
  }

  await checkVersion()
  if (await refreshNeeded()) await spawnRefresh()
}

export default hook
