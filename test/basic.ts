import t from 'tap'
import { cliEnvConfig } from '@isaacs/cli-env-config'
import type { ConfigDef } from '@isaacs/cli-env-config'

t.test('basics', t => {
  const env = {} as { [k: string]: string }
  const clearEnv = () => Object.keys(env).forEach(k => delete env[k])
  t.afterEach(clearEnv)

  const confDef: ConfigDef = {
    env,
    prefix: 'TEST_APP',
    options: ['api', 'foo', ['bar', 'b'], 'css-opt', 'camelOpt'],
    switches: ['camelCase', ['debug', 'd']],
    switchInverts: [['noDebug', 'debug', 'D']],
    counts: [['inc', 'i']],
    countInverts: [['dec', 'inc', 'x']],
    multivars: ['name', ['header', 'H']],
  }
  const parse = cliEnvConfig(confDef)
  const parseAllow = cliEnvConfig({ ...confDef, allowUnknown: true })

  t.test('set some stuff, no positionals', t => {
    const { config, argv } = parse([
      '--api',
      'apival',
      '--foo=fooval',
      '--bar=',
    ])
    t.strictSame(config, { api: 'apival', foo: 'fooval', bar: '' })
    t.strictSame(argv, [])
    t.strictSame(env, {
      TEST_APP_API: 'apival',
      TEST_APP_FOO: 'fooval',
      TEST_APP_BAR: '',
    })
    t.end()
  })

  t.test('set a camel-case option', t => {
    const { config, argv } = parse([
      '--css-opt=asdf',
      '--camelOpt=only a model',
    ])
    t.strictSame(config, { cssOpt: 'asdf', camelOpt: 'only a model' })
    t.strictSame(argv, [])
    t.strictSame(env, {
      TEST_APP_CSS_OPT: 'asdf',
      TEST_APP_CAMEL_OPT: 'only a model',
    })
    t.end()
  })

  t.test('inc/dec', t => {
    const res = parse(['--inc', 'pos', '-i'])
    t.strictSame(res.config, { inc: 2 })
    t.strictSame(res.argv, ['pos'])
    t.strictSame(env, { TEST_APP_INC: '2' })
    const res2 = parse(['-i', '-i', '-x', '--dec', '--inc'])
    t.strictSame(res2.config, { inc: 3 })
    t.strictSame(res2.argv, [])
    t.strictSame(env, { TEST_APP_INC: '3' })
    t.end()
  })

  t.test('env sets defaults if not on cli', t => {
    env.TEST_APP_CAMEL_CASE = '1'
    env.TEST_APP_NAME = 'x\n\ny\n\nz\n\n\n'
    const res = parse(['x', 'y', 'z'])
    t.strictSame(res.argv, ['x', 'y', 'z'])
    t.strictSame(env, {
      TEST_APP_CAMEL_CASE: '1',
      TEST_APP_NAME: 'x\n\ny\n\nz\n\n\n',
    })
    t.strictSame(res.config, {
      camelCase: true,
      name: ['x', 'y', 'z'],
    })
    const res2 = parse(['--name=bob'])
    t.strictSame(res2.config, {
      camelCase: true,
      name: ['x', 'y', 'z', 'bob'],
    })
    t.strictSame(res2.argv, [])
    t.strictSame(env, {
      TEST_APP_CAMEL_CASE: '1',
      TEST_APP_NAME: 'x\n\ny\n\nz\n\nbob',
    })
    t.end()
  })

  t.test('stop at -- positional', t => {
    const res = parse(['asdf', '--inc', '--', '--inc'])
    t.strictSame(res.argv, ['asdf', '--', '--inc'])
    t.strictSame(res.config, { inc: 1 })
    t.strictSame(env, {
      TEST_APP_INC: '1',
    })
    t.end()
  })

  t.test('value types need a value, nonvalue types need none', t => {
    t.throws(() => parse(['--name']))
    t.throws(() => parse(['-H']))
    t.throws(() => parse(['--inc=9']))
    t.throws(() => parse(['--camel-case=']))
    t.throws(() => parse(['-idXxYz']))
    t.end()
  })

  t.test('short flags', t => {
    env.TEST_APP_BAR = 'bar'
    const res = parseAllow([
      '-iHcontent-type:text/plain',
      '-idXxYz',
      '-iH=foo:bar',
      '--unknown=true',
    ])
    t.strictSame(res.argv, ['-idXxYz', '--unknown=true'])
    t.strictSame(res.config, {
      inc: 2,
      bar: 'bar',
      header: ['content-type:text/plain', 'foo:bar'],
    })
    t.strictSame(env, {
      TEST_APP_INC: '2',
      TEST_APP_BAR: 'bar',
      TEST_APP_HEADER: 'content-type:text/plain\n\nfoo:bar',
    })
    t.end()
  })

  t.test('debug special handling', t => {
    {
      const res = parse(['-d'])
      t.strictSame(res.config, { debug: true })
      t.strictSame(env, {
        NODE_DEBUG: 'test-app',
        TEST_APP_DEBUG: '1',
      })
    }
    {
      const res = parse(['-d', '--debug'])
      t.strictSame(res.config, { debug: true })
      t.strictSame(env, {
        NODE_DEBUG: 'test-app',
        TEST_APP_DEBUG: '1',
      })
    }
    {
      env.NODE_DEBUG = 'foo,bar,baz,,,,asdf'
      const res = parse(['-d'])
      t.strictSame(res.config, { debug: true })
      t.strictSame(env, {
        NODE_DEBUG: 'foo,bar,baz,asdf,test-app',
        TEST_APP_DEBUG: '1',
      })
    }
    {
      env.NODE_DEBUG = 'foo,bar,test-app,baz'
      const res = parse(['-d', '-D'])
      t.strictSame(res.config, { debug: false })
      t.strictSame(env, {
        NODE_DEBUG: 'foo,bar,baz',
        TEST_APP_DEBUG: '0',
      })
    }
    t.end()
  })

  t.end()
})

t.test('invalid config definitions', t => {
  t.throws(() => cliEnvConfig({ options: ['foo', 'foo'], prefix: 'x' }))
  t.throws(() =>
    cliEnvConfig({
      options: [
        ['foo', 'f'],
        ['far', 'f'],
      ],
      prefix: 'x',
    }),
  )
  t.throws(() =>
    cliEnvConfig({ switchInverts: [['asdf', 'foo']], prefix: 'x' }),
  )
  t.throws(() =>
    cliEnvConfig({ countInverts: [['asdf', 'foo']], prefix: 'x' }),
  )
  t.throws(() =>
    cliEnvConfig({
      counts: [['asdf', 'a']],
      countInverts: [['fdsa', 'asdf', 'a']],
      prefix: 'x',
    }),
  )
  t.throws(() =>
    cliEnvConfig({
      options: ['fdsa'],
      counts: [['asdf', 'a']],
      countInverts: [['fdsa', 'asdf']],
      prefix: 'x',
    }),
  )
  t.end()
})
