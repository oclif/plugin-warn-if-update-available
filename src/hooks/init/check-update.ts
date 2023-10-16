import {Hook, Interfaces} from '@oclif/core'
import chalk from 'chalk'
import makeDebug from 'debug'
import {spawn} from 'node:child_process'
import {Stats} from 'node:fs'
import {stat as fsStat, readFile, utimes} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

async function readJSON<T>(file: string): Promise<{contents: T; stat: Stats}> {
  const [contents, stat] = await Promise.all([readFile(file, 'utf8'), fsStat(file)])
  return {contents: JSON.parse(contents), stat}
}

export function hasNotBeenMsSinceDate(ms: number, now: Date, date: Date): boolean {
  const diff = now.getTime() - date.getTime()
  return diff < ms
}

export function convertToMs(
  frequency: number,
  unit: 'days' | 'hours' | 'milliseconds' | 'minutes' | 'seconds',
): number {
  switch (unit) {
    case 'days': {
      return frequency * 24 * 60 * 60 * 1000
    }

    case 'hours': {
      return frequency * 60 * 60 * 1000
    }

    case 'milliseconds': {
      return frequency
    }

    case 'minutes': {
      return frequency * 60 * 1000
    }

    case 'seconds': {
      return frequency * 1000
    }

    default: {
      // default to minutes
      return frequency * 60 * 1000
    }
  }
}

export function getEnvVarNumber(envVar: string, defaultValue?: number): number | undefined {
  const envVarRaw = process.env[envVar]
  if (!envVarRaw) return defaultValue
  const parsed = Number.parseInt(envVarRaw, 10)
  if (Number.isNaN(parsed)) return defaultValue
  return parsed
}

export function getEnvVarEnum<T extends string>(envVar: string, allowed: T[], defaultValue: T): T
export function getEnvVarEnum<T extends string>(envVar: string, allowed: T[], defaultValue?: T): T | undefined
export function getEnvVarEnum<T extends string>(envVar: string, allowed: T[], defaultValue?: T): T | undefined {
  const envVarRaw = process.env[envVar] as T | undefined
  if (!envVarRaw) return defaultValue
  if (!allowed.includes(envVarRaw)) return defaultValue
  return envVarRaw
}

export function semverGreaterThan(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}) > 0
}

export async function getNewerVersion({
  argv,
  config,
  file,
}: {
  argv: string[]
  config: Interfaces.Config
  file: string
}): Promise<string | undefined> {
  // do not show warning if running `update` command of <CLI>_SKIP_NEW_VERSION_CHECK=true
  if (argv[2] === 'update' || config.scopedEnvVarTrue('SKIP_NEW_VERSION_CHECK')) return

  // TODO: handle prerelease channels
  if (config.version.includes('-')) return

  const {frequency, frequencyUnit} = config.pjson.oclif['warn-if-update-available'] ?? {}

  const warningFrequency = getEnvVarNumber(config.scopedEnvVarKey('NEW_VERSION_CHECK_FREQ'), frequency)
  const warningFrequencyUnit = getEnvVarEnum(
    config.scopedEnvVarKey('NEW_VERSION_CHECK_FREQ_UNIT'),
    ['days', 'hours', 'minutes', 'seconds', 'milliseconds'],
    frequencyUnit ?? 'minutes',
  )

  const tag = config.scopedEnvVar('NEW_VERSION_CHECK_TAG') ?? 'latest'
  const {contents: distTags, stat} = await readJSON<{[tag: string]: string}>(file)
  // If the file was modified before the timeout, don't show the warning
  if (
    warningFrequency &&
    warningFrequencyUnit &&
    hasNotBeenMsSinceDate(convertToMs(warningFrequency, warningFrequencyUnit), new Date(), stat.mtime)
  )
    return

  if (distTags[tag] && semverGreaterThan(distTags[tag].split('-')[0], config.version.split('-')[0]))
    return distTags[tag]
}

const hook: Hook<'init'> = async function ({config}) {
  const debug = makeDebug('update-check')
  const file = join(config.cacheDir, 'version')

  // Destructure package.json configuration with defaults
  const {
    authorization = '',
    message = '<%= config.name %> update available from <%= chalk.greenBright(config.version) %> to <%= chalk.greenBright(latest) %>.',
    registry = 'https://registry.npmjs.org',
    timeoutInDays = 60,
  } = config.pjson.oclif['warn-if-update-available'] ?? {}

  const refreshNeeded = async () => {
    if (this.config.scopedEnvVarTrue('FORCE_VERSION_CACHE_UPDATE')) return true
    if (this.config.scopedEnvVarTrue('SKIP_NEW_VERSION_CHECK')) return false
    try {
      const {mtime} = await fsStat(file)
      const staleAt = new Date(mtime.valueOf() + 1000 * 60 * 60 * 24 * timeoutInDays)
      return staleAt < new Date()
    } catch (error) {
      debug(error)
      return true
    }
  }

  const spawnRefresh = async () => {
    const versionScript = resolve(dirname(fileURLToPath(import.meta.url)), '../../../lib/get-version')
    debug('spawning version refresh')
    debug(process.execPath, versionScript, config.name, file, config.version, registry, authorization)
    spawn(process.execPath, [versionScript, config.name, file, config.version, registry, authorization], {
      detached: !config.windows,
      stdio: 'ignore',
    }).unref()
  }

  try {
    const newerVersion = await getNewerVersion({argv: process.argv, config, file})
    if (newerVersion) {
      // Default message if the user doesn't provide one
      const [template] = await Promise.all([
        import('lodash.template'),
        // Update the modified time (mtime) of the version file so that we can track the last time we
        // showed the warning. This makes it possible to respect the frequency and frequencyUnit options.
        utimes(file, new Date(), new Date()),
      ])
      this.warn(
        template.default(message)({
          chalk,
          config,
          latest: newerVersion,
        }),
      )

      // await utimes(file, new Date(), new Date())
    }
  } catch (error: unknown) {
    const {code} = error as {code: string}
    if (code !== 'ENOENT') throw error
  }

  if (await refreshNeeded()) await spawnRefresh()
}

export default hook
