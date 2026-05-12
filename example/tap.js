const pkg = { name: 'tap', version: '99.999.9999', description: 'blorg' }

const reporters = ['tap', 'base', 'speccy', 'classic']

const parseArgv = cliEnvConfig({
  prefix: 'TIER',
  options: [['api-url', 'a'], ['web-url', 'w'], ['key', 'k'], 'auth-type'],
  switches: [['debug', 'd'], ['help', 'h']],
  switchInverts: [['noDebug', 'debug', 'D']],
})

const parseArgv = cliEnvConfig({
  prefix: 'TAP',
  options: [
    ['reporter', 'R'],
    ['save', 's'],
    'before',
    'after',
    ['coverage-map', 'M'],
  ],

