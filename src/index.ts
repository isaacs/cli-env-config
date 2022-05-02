export type KeyList = Array<string | [string, string]>
export type NegList = Array<
  [string, string] | [string, string, string]
>

type ProcessEnv = typeof process.env

export type ConfigDef = {
  prefix: string
  options?: KeyList
  switches?: KeyList
  switchInverts?: NegList
  counts?: KeyList
  countInverts?: NegList
  multivars?: KeyList
  allowUnknown?: boolean
  env?: { [key: string]: string } | ProcessEnv
}

export type ResultConfig = {
  [key: string]: string | number | boolean | string[]
}

export type Result = {
  config: ResultConfig
  argv: string[]
}

export type ConfigParseFunction = (argv: string[]) => Result

const undef = (x: any): x is undefined => typeof x === 'undefined'

const toOptSet = (
  a: Array<string | [string, string]>,
  s: Map<string, string>,
  allKeys: Set<string>
): Set<string> => {
  const ret = new Set<string>()
  for (const opt of a) {
    const o = typeof opt === 'string' ? [opt] : opt
    const [key, flag] = o
    if (allKeys.has(key)) {
      throw new Error(`duplicate definition for option ${key}`)
    }
    allKeys.add(key)
    if (s.has(flag)) {
      throw new Error(
        `duplication definition for ${flag} -> ${s.get(
          flag
        )} and ${key}`
      )
    }
    ret.add(key)
    if (!undef(flag)) {
      s.set(flag, key)
    }
  }
  return ret
}

const toNegSet = (
  a: Array<[string, string, string] | [string, string]>,
  s: Map<string, string>,
  allKeys: Set<string>
): Map<string, string> => {
  const ret = new Map<string, string>()
  for (const opt of a) {
    const [neg, target, flag] = opt
    if (allKeys.has(neg)) {
      throw new Error(`duplicate definition for option ${neg}`)
    }
    if (!allKeys.has(target)) {
      throw new Error(
        `negation target doesn't exist: ${neg}=>${target}`
      )
    }
    if (!undef(flag) && s.has(flag)) {
      throw new Error(
        `duplicate definition for ${flag} -> ${s.get(
          flag
        )} and ${neg}`
      )
    }
    ret.set(neg, target)
    if (flag) {
      s.set(flag, neg)
    }
  }
  return ret
}

const snakeToCamel = (snake: string): string =>
  snake.toLowerCase().replace(/_(.)/g, ($0, $1) => $1.toUpperCase())

const snakeToCSS = (snake: string): string =>
  snake.toLowerCase().replace(/_/g, '-')

const camelToLoudSnake = (camel: string): string =>
  camel
    .replace(/([^a-z])([A-Z]+)/g, ($0, $1, $2) => $1 + '_' + $2)
    .toUpperCase()

const cssToCamel = (css: string): string =>
  css.toLowerCase().replace(/-(.)/g, ($0, $1) => $1.toUpperCase())

const readEnv = (
  env: { [k: string]: string } | ProcessEnv,
  prefix: string,
  options: Set<string>,
  switches: Set<string>,
  counts: Set<string>,
  multivars: Set<string>
): ResultConfig => {
  const conf: ResultConfig = {}
  for (const [k, v] of Object.entries(
    env as { [k: string]: string }
  )) {
    if (k.toUpperCase().startsWith(prefix.toUpperCase() + '_')) {
      const key = snakeToCamel(k.substr(prefix.length + 1))
      if (options.has(key)) {
        conf[key] = v
      } else if (switches.has(key) && (v === '0' || v === '1')) {
        conf[key] = v === '1'
      } else if (counts.has(key) && !isNaN(+v)) {
        conf[key] = parseInt(v, 10)
      } else if (multivars.has(key)) {
        conf[key] = v.trim().split('\n\n')
      }
    }
  }
  return conf
}

const getNum = (
  config: { [k: string]: any },
  ck: string,
  env: { [k: string]: string } | ProcessEnv,
  ek: string
): number => {
  return typeof config[ck] === 'number'
    ? (config[ck] as number)
    : typeof env[ek] === 'string'
    /* c8 ignore next */? parseInt(env[ek] as string)
    : 0
}

export const cliEnvConfig = (
  confDef: ConfigDef
): ConfigParseFunction => {
  const shorts = new Map<string, string>()
  const allKeys = new Set<string>()
  const options = toOptSet(confDef.options || [], shorts, allKeys)
  const switches = toOptSet(confDef.switches || [], shorts, allKeys)
  const counts = toOptSet(confDef.counts || [], shorts, allKeys)
  const multivars = toOptSet(confDef.multivars || [], shorts, allKeys)
  const countInverts = toNegSet(
    confDef.countInverts || [],
    shorts,
    allKeys
  )
  const switchInverts = toNegSet(
    /* c8 ignore next */ confDef.switchInverts || [],
    shorts,
    allKeys
  )
  const { prefix, env = process.env, allowUnknown = false } = confDef

  const envKey = (k: string): string =>
    prefix + '_' + camelToLoudSnake(k)

  const handleOption = (
    config: ResultConfig,
    k: string,
    val: string
  ): void => {
    env[envKey(k)] = val
    config[cssToCamel(k)] = val
  }

  const handleSwitch = (config: ResultConfig, k: string): void => {
    env[envKey(k)] = '1'
    if (k === 'debug') {
      const ds = new Set(
        (env.NODE_DEBUG || '').split(',').filter(f => !!f)
      )
      ds.add(snakeToCSS(prefix))
      env.NODE_DEBUG = [...ds].join(',')
    }
    config[cssToCamel(k)] = true
  }

  const handleMultivar = (
    config: ResultConfig,
    k: string,
    val: string
  ): void => {
    const ek = envKey(k)
    const curEnv = env[ek] || ''
    env[ek] = `${curEnv.trim()}\n\n${val}`.trim()
    const ck = cssToCamel(k)
    config[ck] = config[ck] || []
    const a = config[ck] as string[]
    a.push(val)
  }

  const handleCount = (config: ResultConfig, k: string): void => {
    const ek = envKey(k)
    const ck = cssToCamel(k)
    const start = getNum(config, ck, env, ek)
    config[ck] = start + 1
    env[ek] = String(config[ck])
  }

  const handleNegSwitch = (config: ResultConfig, k: string): void => {
    env[envKey(k)] = '0'
    if (k === 'debug' && env.NODE_DEBUG) {
      const ds = new Set(
        env.NODE_DEBUG.split(',').filter(f => !!f)
      )
      ds.delete(snakeToCSS(prefix))
      env.NODE_DEBUG = [...ds].join(',')
    }
    config[cssToCamel(k)] = false
  }

  const handleNegCount = (config: ResultConfig, k: string): void => {
    const ek = envKey(k)
    const ck = cssToCamel(k)
    const start: number = getNum(config, ck, env, ek)
    config[ck] = start - 1
    env[ek] = String(config[ck])
  }

  return (input: string[]): Result => {
    const config = readEnv(
      env,
      prefix,
      options,
      switches,
      counts,
      multivars
    )
    const argv: string[] = []

    for (let i = 0; i < input.length; i++) {
      const arg = input[i]
      if (arg === '--') {
        argv.push(...input.slice(i))
        return { config, argv }
      }
      const m = arg.match(/^--([^=]+)(?:=(.*))?$|^-([^ ]+)$/)

      // positional
      if (!m) {
        argv.push(arg)
        continue
      }

      const [_, k, v, flags] = m
      if (k) {
        const needVal = multivars.has(k) || options.has(k)
        const known =
          needVal ||
          counts.has(k) ||
          switches.has(k) ||
          switchInverts.has(k) ||
          countInverts.has(k)
        const val = needVal ? (undef(v) ? input[++i] : v) : v
        const invalid =
          (known && !needVal && !undef(val)) ||
          (needVal && undef(val))

        if (invalid) {
          throw new Error(`invalid option: ${arg} in ${input}`)
        }

        if (!known) {
          if (allowUnknown) {
            argv.push(arg)
            continue
          } else {
            throw new Error(`unknown option: ${arg}`)
          }
        }

        if (options.has(k)) {
          handleOption(config, k, val)
        } else if (switches.has(k) && !v) {
          handleSwitch(config, k)
        } else if (multivars.has(k)) {
          handleMultivar(config, k, val)
        } else if (counts.has(k) && !v) {
          handleCount(config, k)
        } else if (switchInverts.has(k)) {
          handleNegSwitch(config, switchInverts.get(k) as string)
        } else if (countInverts.has(k)) {
          handleNegCount(config, countInverts.get(k) as string)
        }

        continue
      }

      // expand flags
      const expanded = []
      for (let c = 0; c < flags.length; c++) {
        const f = flags.charAt(c)
        const k = shorts.get(f)
        if (!k) {
          if (allowUnknown) {
            argv.push(arg)
            expanded.length = 0
            break
          } else {
            throw new Error(`unknown short option: ${f} in ${arg}`)
          }
        }
        const needVal = multivars.has(k) || options.has(k)
        expanded.push(`--${k}`)
        if (needVal && c < flags.length - 1) {
          const valStart = flags.charAt(c + 1) === '=' ? c + 2 : c + 1
          expanded.push(flags.substring(valStart))
          break
        }
      }
      input.splice(i + 1, 0, ...expanded)
    }

    return { config, argv }
  }
}
