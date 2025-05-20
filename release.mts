import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import semver from 'semver'
import spawn from 'nano-spawn'
import json from 'magic-json'

// Fields of interest in package.json.
interface PackageJson {
    name: string
    version: string

    // Only in packages/@koffi/*/package.json
    os: string[]
    cpu: string[]
    libc?: string[]

    // Only in packages/koffi-cream/package.json
    optionalDependencies: Record<string, string>
}

// Some paths
const CREAM_PACKAGES_BASE = path.join('packages', '@koffi')           // Where individual packages are stored
const MASTER_CREAM_BASE   = path.join('packages', 'koffi-cream')      // Where our main cream package is stored

// This maps the various Koffi builds we support to our Cream packages.
const koffiToCream: Record<string, string> = {
    darwin_arm64:  'darwin-arm64',
    darwin_x64:    'darwin-x64',
    freebsd_arm64: 'freebsd-arm64',
    freebsd_x64:   'freebsd-x64',
    linux_arm64:   'linux-arm64',
    linux_riscv64: 'linux-riscv64',
    linux_x64:     'linux-x64-glibc',
    musl_x64:      'linux-x64-musl',
    openbsd_x64:   'openbsd-x64',
    win32_arm64:   'win32-arm64',
    win32_x64:     'win32-x64'
}

try {

    // Ensure a supported version of Node is used (we use import.meta.XXX).
    if (!semver.satisfies(process.versions.node, '^20.11.0 || >= 22'))
        throw new Error('This script requires Node.js 20.11.0+ or 22+')

    // Also ensure the script is run from the root of the monorepo.
    if (process.cwd() !== import.meta.dirname)
        throw new Error(`Please run ${path.basename(import.meta.filename)} from the root of the monorepo.`)

    // Get the version of Koffi currently installed in the repo.
    const koffiBase = fileURLToPath(new URL('./', import.meta.resolve('koffi')))
    const { version: koffiVersion }: PackageJson = await json.fromFile(path.join(koffiBase, 'package.json'))
    if (semver.major(koffiVersion) !== 2)
        throw new Error('This script only supports Koffi 2.x')

    // Check the latest version of Koffi on npm.
    console.info("Checking latest version of Koffi on npm registry...")
    const { stdout: koffiLatest } = await spawn('npm', [ 'view', 'koffi@latest', 'version' ])
    if (semver.gt(koffiLatest, koffiVersion))
        console.warn(`*** Koffi ${koffiLatest} is available!`)

    // Get the main package's package.json.
    const mainManifest: PackageJson = await json.fromFile(path.join(MASTER_CREAM_BASE, 'package.json'))

    // Do we need to update?
    if (semver.gt(koffiVersion, mainManifest.version)) {

        // Package each koffi build we support as an optional dependency to our main package.
        // This involves:
        // - copying the koffi.node binary to the package's directory
        // - updating the package's package.json `version`, `os`, `cpu` and `libc` fields
        // - updating the main package's package.json `version` and `optionalDependencies` fields
        console.group('Packaging...')
        const packages: Record<string, string> = {}
        const binaries: string[] = []
        for (const koffiBuild in koffiToCream) {
            const cream = koffiToCream[koffiBuild]
            console.info(`${koffiBuild} => ${cream}`)

            // Make sure we have a package for this build.
            const pkgBase = path.join(CREAM_PACKAGES_BASE, cream)
            if (!await fs.stat(pkgBase).then(stat => stat.isDirectory()).catch(() => false))
                throw new Error(`Unsupported Koffi build ${koffiBuild}`)

            // Copy the big binary.
            const binary = path.join(pkgBase, `koffi.node`)
            await fs.copyFile(path.join(koffiBase, 'build', 'koffi', koffiBuild, 'koffi.node'), binary)

            // Update the package's package.json.
            const [ platform, arch, libc ] = cream.split('-')
            const pkgManifest: PackageJson = await json.fromFile(path.join(pkgBase, 'package.json'))
            pkgManifest.name = `@koffi/${cream}`
            pkgManifest.version = koffiVersion
            pkgManifest.os = [ platform ]
            pkgManifest.cpu = [ arch ]
            if (libc)
                pkgManifest.libc = [ libc ]
            else
                delete pkgManifest.libc
            await json.write(pkgManifest)

            // Remember this dependency and binary.
            packages[pkgManifest.name] = pkgManifest.version
            binaries.push(binary)
        }
        console.groupEnd()

        // Update our main package:
        // - update index.d.ts
        // - update package.json
        console.info('Updating main package...')
        const typings = await fs.readFile(path.join(koffiBase, 'index.d.ts'))
            .then(buf => buf.toString())
            .then(str => str.replace("declare module 'koffi'", "declare module 'koffi-cream'"))
        await fs.writeFile(path.join(MASTER_CREAM_BASE, 'index.d.ts'), typings)

        mainManifest.version = koffiVersion
        mainManifest.optionalDependencies = packages
        await json.write(mainManifest)

        // And now, publish'em all!
        console.info('Publishing all packages with npm...')
        await spawn('npm', [ 'publish', '--workspaces', '--access=public',
            // '--registry=http://localhost:4873/',    // I use Verdaccio (https://www.verdaccio.org) for local tests
            '--dry-run'
        ], { stdio: 'inherit' })

        // Update the repo
        console.info('Updating the repo...')
        await Promise.all(binaries.map(bin => fs.rm(bin)))
        await spawn('git', [ 'commit', '-a', '-m', `Update to Koffi ${koffiVersion}` ])
        await spawn('git', [ 'tag', `v${koffiVersion}`])
    }
    else console.info("No need to update.")
}
catch(e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(msg)
    process.exitCode = 1
}
finally {
    console.info('Done')
}
