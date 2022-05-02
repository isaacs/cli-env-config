# @isaacs/cli-env-config

An options parser for environment variable configuration.

All options correspond to environment variables. So, if you
define `foo-bar`, then you can use `--foo-bar=value` on the
command line, or set `MY_APP_FOO_BAR=value` in the environment,
and get `fooBar: 'value'` in the options object.

CLI options override the environment. Whatever the settings are,
they are put into the environment, so your cli app can consume
them from there, or from the `options` object it creates.

Options like `--key=value` and `--key value` are supported for
value-taking keys. Switches are booleans, so `--key` sets them
true. Counts are switches that return the number of times
they're set. Multivars are options that can be set multiple
times.

Counts are numbers. Switches are booleans. Options are stringly
typed. Multivars are arrays of strings (zero-length
when not set, so they're always an array).

In the environment, multivars are `\n\n`-delimited. Switches are
set/read in the environment as `'1'` for true and `'0'` for
false. Counts are set/read in the environment as decimal
integer strings.

Short options are supported POSIX-style, so if `-b` is a
shorthand for `--bar` switch, and `-f` is shorthand for the
`--foo` option, then `-bfasdf` and `-bf asdf` are both equivalent
to `--bar --foo=asfd`.

This library does not print your usage banner for you, sorry.

## INSTALL

```bash
npm install cli-env-config
```

## USAGE

```js
const { cliEnvConfig } = require('cli-env-config')

// create a config parser based on our app's needs
const parse = cliEnvConfig({
  // all envs are prefixed with 'MY_APP_...'
  prefix: 'MY_APP'

  // these take a value, stringly typed, last one wins
  options: ['api', 'foo'],

  // these are on or off.  '1' in env for true, '0' for false
  // string name, or [name, short flag].
  //
  // the camelcase name here is what ends up in the env.  the cli
  // flag is the css-case form, so --camel-case.
  // the env is prefixed with ${prefix}, and upper-snake case, so
  // MY_APP_CAMEL_CASE
  switches: ['camelCase', ['debug', 'd'], ['help', 'h']],
  // switch inverts make a switch be turned off
  // they don't end up on the config object
  switchInverts: [['noDebug', 'debug', 'D']],

  // these are set to the number of times they're specified
  counts: [['verbose', 'v']],
  // countDecrements make a counter go down
  countInverts: [['quiet', 'verbose', 'q']],

  // these return an array of all options, \n\n-delimited in env
  multivars: [['header', 'H']],

  // options:
  // true: leave unknown options in the argv array
  // false (default): throw an error on any unknown --option args
  allowUnknown: true,
})

// argv is what remains
// options is the resolved values
const {config, argv} = parse(process.argv.slice(2))

// then you can use the config object and the argv to do whatever
```

## API

### `cliEnvConfig(configDefs: ConfigDef) => ConfigParseFunction`

Return a function that parses an argv array and returns the
config object and sets environment variables.

### `ConfigDef` type

* `prefix` The name of your app.  Required.
* `options`: Array of option name strings or `[name, shortFlag]`
  tuples.  These keys must take a value.
* `switches`: Array of switch name strings or `[name, shortFlag]`
  tuples.  These keys must not take a value, they are true if
  set.
* `switchInverts`: Array of `[name, target]` or `[name, target,
  shortFlag]` tuples.  The `target` is a `switch` that this
  switch sets to `false`.
* `counts`: Array of counter name strings or `[name, shortFlag]`
  tuples.  These may be set multiple times, each time increments
  the counter.
* `countInverts`: Array of `[name, target]` or `[name, target,
  shortFlag]` tuples.  The `target` is a `count` that this switch
  decrements.
* `multivars`: Array of multivar name strings or `[name,
  shortFlag]` tuples.  These take a value, and may be set
  multiple times.  The resulting value is an array of all values
  provided.
* `allowUnknown`: Boolean, default false.  Treats unrecognized
  `-flag` and `--option` arguments as positionals, including them
  in the returned `argv`
* `env`: The environment object to use, defaults to `process.env`

### `ConfigParseFunction`

Returned by `cliEnvConfig`.

Parses an `argv` array of strings, returning a `config` object
and `argv` of remaining positional arguments.

Stops parsing when `--` is encountered, and includes the `--` in
the returned `argv`.

Sets all environment variables appropriately in the `env` object
provided in the `ConfigDef` to `cliEnvConfig()`.

Throws if the argv cannot be parsed correctly.  (For example, if
a value is provided to a `switch` type argument, or no value is
provided to an `option` type argument.)

### Option Types

* `option` Value must be provided.  Uses the last value
  specified.  Stored in the environment as the last string value.
  Set to an empty string with `--name=`.
* `switch` Value must not be provided.  Boolean, set true by
  setting the option, or set false with a `switchInvert`
  argument.  Stored in the environment as `'1'` for true and
  `'0'` for false.
* `count` Value must not be provided, may be specified multiple
  times.  Integer, incremented by setting the option, or
  decremented by a `countInvert` argument.  Set in the
  environment as a decimal string.
* `multivar` Value must be provided, may be specified multiple
  times.  Array of all string values provided.  Set in the
  environment as a `\n\n`-delimited list of all values provided.

## WHY

The absolutely _last_ thing that the npm registry needs in 2022
is yet another cli options parser, it's true.

But I found that I kept having to re-implement the same bit of
functionality, where I'd check the env, then have the cli parser
know to set this flag to that environment variable, use the env
as a default but still override it when it's explicitly set, and
so on. And then does the code use the env, or the an explicit
option? Always a pile of decisions to be made, none of them
entirely obvious. Sometimes I'd add a new config key, but forget
to default it to the environment, so things would get out of sync.

I thought it might be easier to just have one way to do that,
define a bunch of switches and options and booleans, and then get
configuration and environment variable handling all included in
one consistent thing, so the env is always set, the config always
matches it, and the user can set it either way to get the same
effect.

Also, all the other cli options definition systems were really
verbose, even [jackspeak](http://npm.im/jackspeak) which I
specifically designed to be as terse as I could make it. I
thought it might be nice to see how minimal I could get the
interface.
