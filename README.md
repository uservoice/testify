# testify
An opinionated configuration and tool for testing browser-based Typescript projects with Mocha.

💡 Builds upon many of the ideas from [@tomazzaman](https://github.com/tomazzaman)'s excellent article “[How to get fast unit tests with(out) Webpack](https://medium.com/@TomazZaman/how-to-get-fast-unit-tests-with-out-webpack-793c408a076f)”

### What it does
Initializes and configures a testing environment with the following:
- [ts-node](https://github.com/TypeStrong/ts-node) for writing tests and transpiling `.ts` imports
- [mocha](https://github.com/mochajs/mocha) for running tests
- [sinon](https://github.com/sinonjs/sinon) for mocking/stubbing functions
- [chai](https://github.com/chaijs/chai) for assertions w/
  - [sinon-chai](https://github.com/domenic/sinon-chai)
  - [chai-dom](https://github.com/nathanboktae/chai-dom)
- [jsdom](https://github.com/jsdom/jsdom) for a browser-esque environment
#### ✨ Bonus features
- 😏 No webpack
- 🚀 Tracks dependencies in watch mode and only re-runs tests that are affected

### Using it in your projects
#### Install with yarn or npm
```bash
yarn add @snaptopixel/testify
```
#### Configure with cosmiconfig
Testify can be configured via:
- `testify` object in `package.json`
- `.testifyrc` file in yaml or json format
- `testify.config.js` file

Supported properties:
- **files** - minimatch glob pattern for test files, ie: `src/**/*.spec.ts`
- **require** - array of file paths to include, useful for [customizing the test environment](#customizing-the-test-environment)
- **alias** - map of path/file aliases for requiring files,ie: `"@": "src"`

#### Add run script(s) to `package.json`
##### Single test run  
```json
{
  "test": "testify"
}
```
##### Watch mode (re-run tests when files are changed)
```json
{
  "test:watch": "testify -w"
}
```
##### Single test run w/coverage
> 🗒 Install [nyc](https://github.com/istanbuljs/nyc) and prepend it to your script before `testify`. Check nyc's README for configuration options
```js
{
  "test": "nyc testify -t tests/**/*.spec.ts"
}
```

### The test environment
`chai` `describe` `it` `expect` and `sinon` are available globally and don't need to be imported in your tests or `require` files

### Customizing the test environment
Required files will be executed in the node environment once jsdom has been initialized.  

This is useful if your scripts depend on global variables, for example:

```js
// In required js/ts file
window.SomeGlobal = {
  someMethod: sinon.spy()
}

// In test file
describe('globals', () => {
  it('can access global', () => {
    window.SomeGlobal.someMethod('hey')
    expect(window.SomeGlobal.someMethod).calledWith('hey')
  })
})
```

You can also customize `chai` etc using the provided globals.

### Type checking
Note that testify will not type check your files. For the sake of simplicity and speed ts-node runs in "transpile only" mode.

It's recommended to type check your project via `tsc --noEmit` as part of your ci and/or development process.