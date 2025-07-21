import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import readline from 'node:readline/promises'
import semver from 'semver'
import spawn from 'nano-spawn'
import json from 'magic-json'

// Fields of interest in package.json.
interface PackageJson {
    name: string
    version: string

    // Used in packages/@koffi/*/package.json
    main: string
    os: string[]
    cpu: string[]
    libc?: string[]

    // Used in packages/koffi-cream/package.json
    types: string
    optionalDependencies: Record<string, string>
}

// This maps the various Koffi builds we support to our Cream packages.
const koffiToCream: Record<string, string> = {
    darwin_arm64:   'darwin-arm64',
    darwin_x64:     'darwin-x64',
    linux_arm64:    'linux-arm64-glibc',
    musl_arm64:     'linux-arm64-musl',
    linux_x64:      'linux-x64-glibc',
    musl_x64:       'linux-x64-musl',
    linux_loong64:  'linux-loong64',
    linux_riscv64d: 'linux-riscv64',
    win32_arm64:    'win32-arm64',
    win32_x64:      'win32-x64',
    freebsd_arm64:  'freebsd-arm64',
    freebsd_x64:    'freebsd-x64',
    openbsd_x64:    'openbsd-x64',
}

try {
    // Check availability of `import.meta.dirname` and `import.meta.resolve`.
    if (!semver.satisfies(process.versions.node, '^20.11.0 || >= 22'))
        throw new Error('This script requires Node.js 20.11.0+ or 22+')

    // Ensure the script is run from the root of the monorepo.
    if (process.cwd() !== import.meta.dirname)
        throw new Error(`Please run ${path.basename(import.meta.filename)} from the root of the monorepo.`)

    // Get the version of Koffi currently installed in the repo.
    const koffiBase = fileURLToPath(new URL('./', import.meta.resolve('koffi')))
    const { version: koffiVersion } = await json.fromFile<PackageJson>(path.join(koffiBase, 'package.json'))
    console.info(`Koffi version ${koffiVersion} found at ${koffiBase}`)
    if (semver.major(koffiVersion) !== 2)
        throw new Error('This script only supports Koffi 2.x')

    // Check the latest version of Koffi on npm.
    console.info("Checking latest version of Koffi on the npm registry...")
    const { stdout: koffiLatest } = await spawn('npm', [ 'view', 'koffi@latest', 'version' ])
    if (semver.gt(koffiLatest, koffiVersion)) {
        const rl = readline.createInterface(process.stdin, process.stderr)
        let answer = ''
        do {
            answer = await rl.question(`*** Koffi ${koffiLatest} is available on npm, continue with ${koffiVersion} anyway (Y/N)? `) || 'n'
        } while (!/^[yYnN]$/.test(answer))
        rl.close()

        if (answer[0] === 'n' || answer[0] === 'N')
            throw new Error('Aborted')
    }

    // Do we need to update?
    const repoManifest = await json.fromFile<PackageJson>('package.json')
    if (semver.lte(koffiVersion, repoManifest.version))
        console.info("Nothing to update.")
    else {
        const CREAM_PACKAGES = path.resolve('packages', '@koffi')       // Where individual packages are stored
        const MAIN_PACKAGE   = path.resolve('packages', 'koffi-cream')  // Where our main cream package is stored

        // Package each koffi build we support as an optional dependency to our main package.
        // This involves:
        // - copying the koffi.node binary to the package's directory
        // - updating the package's package.json `version`, `os`, `cpu` and `libc` fields
        // - updating the main package's package.json `version` and `optionalDependencies` fields
        console.group('Packaging...')
        const supportedPackages: Record<string, string> = {}
        const copiedBinaries: string[] = []
        for (const koffiBuild in koffiToCream) {
            const cream = koffiToCream[koffiBuild]
            process.stdout.write(`${koffiBuild} => ${cream}...`)

            // Make sure we have a package for this build and read its manifest.
            const pkgBase = path.join(CREAM_PACKAGES, cream)
            if (!await fs.stat(pkgBase).then(stat => stat.isDirectory()).catch(() => false))
                throw new Error(`Unsupported Koffi build ${koffiBuild}`)
            const pkgManifest = await json.fromFile<PackageJson>(path.join(pkgBase, 'package.json'))

            // Copy the big binary.
            const destinationBinary = path.join(pkgBase, pkgManifest.main)
            await fs.copyFile(path.join(koffiBase, 'build', 'koffi', koffiBuild, 'koffi.node'), destinationBinary)

            // Update the package's package.json.
            const [ platform, arch, libc ] = cream.split('-') as [ string, string, string | undefined ]
            pkgManifest.name = `@septh/koffi-${cream}`
            pkgManifest.version = koffiVersion
            pkgManifest.os = [ platform ]
            pkgManifest.cpu = [ arch ]
            if (libc)
                pkgManifest.libc = [ libc ]
            await json.write(pkgManifest)

            // Remember this dependency and binary.
            supportedPackages[pkgManifest.name] = pkgManifest.version
            copiedBinaries.push(destinationBinary)

            console.log('ok')
        }
        console.groupEnd()

        // Update our main package:
        // - update version and optionalDependencies in package.json
        // - copy index.d.ts from Koffi
        console.info('Updating main package...')
        const mainManifest = await json.fromFile<PackageJson>(path.join(MAIN_PACKAGE, 'package.json'))
        mainManifest.version = koffiVersion
        mainManifest.optionalDependencies = supportedPackages
        await json.write(mainManifest)

        const typings = await fs.readFile(path.join(koffiBase, 'index.d.ts'))
            .then(buf => buf.toString())
            .then(str => str.replace("declare module 'koffi'", "declare module 'koffi-cream'"))
        await fs.writeFile(path.join(MAIN_PACKAGE, mainManifest.types), typings)

        // And now, publish'em all!
        let success = false
        try {
            console.info('Publishing all packages with npm...')
            await spawn('npm', [ 'publish', '--workspaces', '--access=public',
                // '--dry-run'
            ], { stdio: 'inherit' })

            success = true
        }
        finally {
            console.info('Cleaning up...')
            await Promise.all(copiedBinaries.map(bin => fs.rm(bin)))
            await spawn('git', [ 'checkout', 'packages' ])

            // Update the repo
            if (success) {
                repoManifest.version = koffiVersion
                await json.write(repoManifest)

                await spawn('git', [ 'commit', '-a', '-m', `Update to Koffi ${koffiVersion}` ])
                await spawn('git', [ 'tag', `v${koffiVersion}`])
            }
        }
    }
    console.info('Done')
}
catch(e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(msg)
    process.exitCode = 1
}
