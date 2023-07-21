import * as path from 'node:path'
import {Hook} from '@oclif/core'
import {readJSON, stat} from 'fs-extra'
import debugLib from 'debug'
import {spawn} from 'node:child_process'
import {gt} from 'semver'

const hook: Hook<'init'> = async function ({config}) {
  const file = path.join(config.cacheDir, 'version')
  const debug = debugLib('update-check')

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
      const distTags = await readJSON(file)
      if (config.version.includes('-')) {
        // to-do: handle channels
        return
      }
      if (
        distTags?.latest &&
        gt(distTags.latest.split('-')[0], config.version.split('-')[0])
      ) {
        const [chalk, {template}] = await Promise.all([import('chalk'), import('lodash')])
        // Default message if the user doesn't provide one
        this.warn(
          template(message)({
            chalk,
            config,
            ...distTags,
          }),
        )
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  const refreshNeeded = async () => {
    if (this.config.scopedEnvVarTrue('FORCE_VERSION_CACHE_UPDATE')) return true
    try {
      const {mtime} = await stat(file)
      const staleAt = new Date(
        mtime.valueOf() + (1000 * 60 * 60 * 24 * timeoutInDays),
      )
      return staleAt < new Date()
    } catch (error) {
      debug(error)
      return true
    }
  }

  const spawnRefresh = async () => {
    debug('spawning version refresh')

    spawn(
      process.execPath,
      [
        path.join(__dirname, '../../../lib/get-version'),
        config.name,
        file,
        config.version,
        registry,
        authorization,
      ],
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
