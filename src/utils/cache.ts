// declare an interface for the object that is
// used to describe each script and stored in the
// map
export interface ScriptState {
  _callbacks?: Array<() => void>
  hasLoaded: boolean
  wasRejected: boolean
  error?: any
  promise: Promise<ScriptState>
  tag: HTMLScriptElement
}

/**
 * map for script names against utility objects
 */
export const loadedScripts = new Map<string, ScriptState>()

/**
 * script tags to be generated by the cache method
 */
export let scriptTags: ScriptTags = {}

// declare an interface for the scripts object
// that is passed into the cache function
export interface Scripts {
  [name: string]: string
}

// declare a standard callback type
export type Callback = (error: any, result?: any) => void
export type AllCallback = (errors?: any[], results?: any[]) => void

// declare an interface for a single script tag object
export interface ScriptTag {
  name: string
  script: string
  tag: ScriptState
  onLoad(callback: Callback): void
}

// declare an interface for the script tags object
// that stores info on each requested script
export interface ScriptTags {
  [name: string]: ScriptTag
}

/**
 *
 * @param scripts {Scripts} - An object with all the scripts required.
 * Keys are script names, values are URLs.
 */
export function cache(scripts: Scripts): void {
  Object.entries(scripts).forEach(([script, name]) => {
    const tag = getScript(script, name)
    if (tag) {
      scriptTags = {
        ...scriptTags,
        [name]: {
          name,
          onLoad: onLoad.bind(null, name),
          script,
          tag,
        },
      }
    }
  })
}

export function getScriptStub(name: string): ScriptTag {
  return scriptTags[name]
}

/**
 * Callback to be fired when each script has loaded.
 * @param name {string} - The name of the string that has just loaded.
 * @param callback {Callback} - A callback to execute when the script has loaded.
 */
export function onLoad(name: string, callback: Callback): void {
  const stored = loadedScripts.get(name)

  if (stored && stored.hasLoaded) {
    callback(null, stored)
  } else if (stored) {
    stored.promise.then(() => {
      stored.wasRejected ? callback(stored.error) : callback(null, stored)
    })
  }
}

/**
 * Callback to be fired when all scripts have loaded
 * @param callback {Function} - The callback to be executed.
 */
export function onAllLoad(callback: AllCallback) {
  const promises: Array<Promise<ScriptState>> = []
  const results: ScriptState[] = []

  loadedScripts.forEach((value: ScriptState) => {
    if (value.hasLoaded) {
      results.push(value)
    } else {
      promises.push(value.promise)
    }
  })

  if (promises.length > 0) {
    Promise.all(promises)
      .then((res: any[]) => callback(undefined, res))
      .catch((errs: any[]) => callback(errs, undefined))
  } else {
    callback(undefined, results)
  }
}

/**
 * Get a script from a remote location.
 * @param name {string} - The name of the script to be retrieved.
 * @param url {string} - The URL/location of the script to be retrieved.
 */
export function getScript(url: string, name: string): ScriptState | undefined {
  if (
    !loadedScripts.has(name) &&
    !document.querySelector(`script[src="${url}"]`)
  ) {
    let tag: HTMLScriptElement = document.createElement('script')

    const promise = new Promise<ScriptState>((resolve, reject) => {
      const body = document.getElementsByTagName('body')[0]

      // make sure the script type is javascript
      // and that scripts are loaded in order using
      // the "async" option
      tag = {
        ...tag,
        async: false,
        type: 'text/javascript',
      }

      function handleResult(event: Event) {
        const stored = loadedScripts.get(name)

        if (stored) {
          if (event.type === 'load') {
            stored.hasLoaded = true
            resolve(stored)
          } else if (event.type === 'error') {
            stored.wasRejected = true
            reject(stored.error)
          }
        } else {
          reject('Script does not exist')
        }
      }

      // add load and error event listeners
      tag.addEventListener('load', handleResult)
      tag.addEventListener('error', handleResult)

      tag = {
        ...tag,
        src: url,
      }

      body.appendChild(tag)
    })

    const scriptObject: ScriptState = {
      hasLoaded: false,
      promise,
      tag,
      wasRejected: false,
    }

    loadedScripts.set(name, scriptObject)
  }

  return loadedScripts.get(name)
}

// also make cache the default export
export default cache
