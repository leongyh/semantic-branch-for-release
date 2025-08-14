import { SemanticVersion } from '../src/semantic-version'

describe('SemanticVersion class', () => {
  it('should parse a valid semantic version', () => {
    const version = new SemanticVersion('1.2.3-rc.1')
    expect(version.major).toBe(1)
    expect(version.minor).toBe(2)
    expect(version.patch).toBe(3)
    expect(version.prerelease).toBe('rc.1')
  })

  it('should throw an error for invalid semantic version', () => {
    expect(() => new SemanticVersion('invalid.version')).toThrow(`Invalid semantic version format: invalid.version`)
  })

  it('should bump major version', () => {
    const version = new SemanticVersion('1.2.3-rc.1')
    version.bumpMajor()
    expect(version.toString()).toBe('v2.0.0-rc.1')
  })

  it('should bump minor version', () => {
    const version = new SemanticVersion('1.2.3-rc.1')
    version.bumpMinor()
    expect(version.toString()).toBe('v1.3.0-rc.1')
  })

  it('should bump patch version from rc', () => {
    const version = new SemanticVersion('1.2.3-rc.1')
    version.bumpPatch()
    expect(version.toString()).toBe('v1.2.3-rc.2')
  })

  it('should bump patch version from release', () => {
    const version = new SemanticVersion('1.2.3')
    version.bumpPatch()
    expect(version.toString()).toBe('v1.2.4-rc.1')
  })

  it('should make a release', () => {
    const version = new SemanticVersion('1.2.3-rc.1')
    version.makeRelease()
    expect(version.toString()).toBe('v1.2.3')
  })

  it('should identify a prerelease version', () => {
    const version = new SemanticVersion('1.2.3-rc.1')
    expect(version.isPrerelease()).toBe(true)
  })

  it('should identify a final release version', () => {
    const version = new SemanticVersion('1.2.3')
    expect(version.isPrerelease()).toBe(false)
  })
})
