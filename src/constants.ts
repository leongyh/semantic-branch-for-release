export const SIMPLE_GIT_CONFIG = {
  config: ['versionsort.suffix=-']
}

export const enum RELEASE_TYPES {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
  NONE = 'none'
}

export const CONVENTIONAL_COMMIT_REGEX: RegExp =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([\w\-]+\))?(!)?: [^\r\n]+((\s)((\s)[^\r\n]+)+)*(\s)?$/

export const SEMANTIC_VERSION_REGEX: RegExp =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
