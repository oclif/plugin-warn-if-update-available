/* eslint-disable valid-jsdoc */

import {Hook, Interfaces} from '@oclif/core'
import {Ansis} from 'ansis'
import makeDebug from 'debug'
import {spawn} from 'node:child_process'
import {readFile, stat, writeFile} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import getAuthToken from 'registry-auth-token';
import getRegistryUrl from 'registry-auth-token/registry-url.js';

const ansis = new Ansis()

async function readJSON<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T
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

/**
 * Returns the newest version of the CLI from the cache if it is newer than the current version.
 *
 * Returns undefined early if:
 * - `update` command is being run
 * - `<CLI>_SKIP_NEW_VERSION_CHECK` is set to true
 * - the current version is a prerelease
 * - the warning was last shown to the user within the frequency and frequencyUnit
 */
export async function getNewerVersion({
  argv,
  config,
  lastWarningFile,
  versionFile,
}: {
  argv: string[]
  config: Interfaces.Config
  lastWarningFile: string
  versionFile: string
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

  try {
    const {mtime} = await stat(lastWarningFile)
    // If the file was modified before the timeout, don't show the warning
    if (
      warningFrequency &&
      warningFrequencyUnit &&
      hasNotBeenMsSinceDate(convertToMs(warningFrequency, warningFrequencyUnit), new Date(), mtime)
    )
      return
  } catch {
    // The last-warning file doesn't exist, which is okay since it will be created the first time the warning is shown
  }

  const distTags = await readJSON<{[tag: string]: string}>(versionFile)

  const tag = config.scopedEnvVar('NEW_VERSION_CHECK_TAG') ?? 'latest'
  if (distTags[tag] && semverGreaterThan(distTags[tag].split('-')[0], config.version.split('-')[0]))
    return distTags[tag]
}

const hook: Hook.Init = async function ({config}) {
  const debug = makeDebug('update-check')
  const versionFile = join(config.cacheDir, 'version')
  const lastWarningFile = join(config.cacheDir, 'last-warning')
  const scope = config.name.split('/')[0];

  // Destructure package.json configuration with defaults
  const {
    message = '<%= config.name %> update available from <%= chalk.greenBright(config.version) %> to <%= chalk.greenBright(latest) %>.',
    registry = config.npmRegistry ?? getRegistryUrl(scope), // Use custom registry or fallback to 1) registry set for the scope, 2) default registry in the npmrc, or 3) the default registry
    timeoutInDays = 7,
  } = config.pjson.oclif['warn-if-update-available'] ?? {}

  // Get the authorization header next as we need the registry to be computed first
  let {
    authorization
  } = config.pjson.oclif['warn-if-update-available'] ?? {}

  if (!authorization) {
    const authToken = getAuthToken(registry);
    authorization = authToken ? `${authToken.type} ${authToken.token}` : '';
  }

  const refreshNeeded = async () => {
    if (this.config.scopedEnvVarTrue('FORCE_VERSION_CACHE_UPDATE')) return true
    if (this.config.scopedEnvVarTrue('SKIP_NEW_VERSION_CHECK')) return false
    try {
      const {mtime} = await stat(versionFile)
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
    debug(process.execPath, versionScript, config.name, versionFile, config.version, registry, authorization)
    spawn(process.execPath, [versionScript, config.name, versionFile, config.version, registry, authorization], {
      detached: !config.windows,
      stdio: 'ignore',
    }).unref()
  }

  try {
    const newerVersion = await getNewerVersion({argv: process.argv, config, lastWarningFile, versionFile})
    if (newerVersion) {
      // Default message if the user doesn't provide one
      const [lodash] = await Promise.all([
        import('lodash'),
        // Update the modified time (mtime) of the last-warning file so that we can track the last time we
        // showed the warning. This makes it possible to respect the frequency and frequencyUnit options.
        writeFile(lastWarningFile, ''),
      ])
      this.warn(
        lodash.default.template(message)({
          ansis,
          // Chalk and ansis have the same api. Keeping chalk for backwards compatibility.
          chalk: ansis,
          config,
          latest: newerVersion,
        }),
      )
    }
  } catch (error: unknown) {
    const {code} = error as {code: string}
    if (code !== 'ENOENT') throw error
  }

  if (await refreshNeeded()) await spawnRefresh()
}

export default hook
