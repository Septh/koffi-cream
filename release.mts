import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import readline from 'node:readline/promises'
import { styleText } from 'node:util'
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

// This maps the various Koffi builds we know and support to our Cream packages.
const supportedBuilds: Record<string, string | false> = {
    darwin_arm64:   'darwin-arm64',
    darwin_x64:     'darwin-x64',
    freebsd_arm64:  'freebsd-arm64',
    freebsd_ia32:   false,
    freebsd_x64:    'freebsd-x64',
    linux_arm64:    'linux-arm64-glibc',
    linux_armhf:    false,
    linux_ia32:     false,
    linux_loong64:  'linux-loong64',
    linux_riscv64d: 'linux-riscv64',
    linux_x64:      'linux-x64-glibc',
    musl_arm64:     'linux-arm64-musl',
    musl_x64:       'linux-x64-musl',
    openbsd_ia32:   false,
    openbsd_x64:    'openbsd-x64',
    win32_arm64:    'win32-arm64',
    win32_ia32:     false,
    win32_x64:      'win32-x64',
}

try {
    debugger
    const DEBUG = !!process.env['DEBUG']

    // Check availability of used APIs.
    if (!semver.satisfies(process.versions.node, '>= 22'))
        throw new Error('This script requires NodeJS 22+')

    // Ensure the script is run from the root of the monorepo.
    process.chdir(import.meta.dirname)

    // Get the version of Koffi currently installed in the repo.
    const koffiBase = fileURLToPath(new URL('./', import.meta.resolve('koffi')))
    const koffiManifest = await json.fromFile<PackageJson>(path.join(koffiBase, 'package.json'))

    console.info(`Koffi version ${koffiManifest.version} found at ${koffiBase}`)
    if (semver.major(koffiManifest.version) !== 2)
        throw new Error('This script only supports Koffi 2.x')

    // Check the latest version of Koffi on npm.
    console.info("Checking latest version of Koffi in the npm registry...")
    const { stdout: koffiLatest } = await spawn('npm', [ 'view', 'koffi@latest', 'version' ])
    if (semver.gt(koffiLatest, koffiManifest.version)) {
        const rl = readline.createInterface(process.stdin, process.stderr)
        let answer = ''
        do {
            answer = await rl.question(`*** Koffi ${koffiLatest} is available on npm, continue with ${koffiManifest.version} anyway (Y/N)? `) || 'n'
        } while (!/^[yYnN]$/.test(answer))
        rl.close()

        if (answer[0] === 'n' || answer[0] === 'N')
            throw new Error('Aborted')
    }

    // Do we need to update?
    const repoManifest = await json.fromFile<PackageJson>('package.json')
    if (semver.lte(koffiManifest.version, repoManifest.version) && !DEBUG)
        console.info("Nothing to update.")
    else {
        const CREAM_PACKAGES = path.resolve('packages', '@koffi')       // Where individual packages are stored
        const MAIN_PACKAGE   = path.resolve('packages', 'koffi-cream')  // Where our main package is stored

        // Package each koffi build we support as an optional dependency to our main package.
        // This involves:
        // - copying the koffi.node binary to the package's directory
        // - updating the package's package.json `version`, `os`, `cpu` and `libc` fields
        // - updating the main package's package.json `version` and `optionalDependencies` fields
        console.log('Packaging...')
        const copiedBinaries: string[] = []
        const optionalDependencies: Record<string, string> = {}
        for await (const binary of fs.glob('**/*.node', { cwd: koffiBase })) {
            const build = path.basename(path.dirname(binary))
            const cream = supportedBuilds[build]

            process.stdout.write(`  ${build} `)
            if (cream) {
                process.stdout.write(`=> ${cream}... `)

                // Read this build's manifest.
                const pkgBase = path.join(CREAM_PACKAGES, cream)
                const pkgManifest = await json.fromFile<PackageJson>(path.join(pkgBase, 'package.json'))

                // Copy the big binary.
                const srcBinary = path.join(koffiBase, binary)
                const dstBinary = path.join(pkgBase, pkgManifest.main)
                await fs.copyFile(srcBinary, dstBinary)

                // Update the package's package.json.
                const [ platform, arch, libc ] = cream.split('-') as [ string, string, string | undefined ]
                pkgManifest.name = `@septh/koffi-${cream}`
                pkgManifest.version = koffiManifest.version
                pkgManifest.os = [ platform ]
                pkgManifest.cpu = [ arch ]
                if (libc)
                    pkgManifest.libc = [ libc ]
                await json.write(pkgManifest)

                // Remember this dependency and binary.
                optionalDependencies[pkgManifest.name] = pkgManifest.version
                copiedBinaries.push(dstBinary)

                console.log('ok')
            }
            else if (cream === false) {
                console.log(styleText('yellow', 'skipped'))
            }
            else {
                console.log(styleText('redBright', 'unknown'))
                throw new Error(`Unknown binary ${build}`)
            }
        }

        // Update our main package (koffi-cream):
        // - update version and optionalDependencies in package.json
        // - copy index.d.ts from Koffi
        console.info('Updating main package...')
        const mainManifest = await json.fromFile<PackageJson>(path.join(MAIN_PACKAGE, 'package.json'))
        mainManifest.version = koffiManifest.version
        mainManifest.optionalDependencies = optionalDependencies
        await json.write(mainManifest)

        // Copy the typings (index.d.ts) in case they were updated.
        const srcTypes = path.join(koffiBase, koffiManifest.types)
        const dstTypes = path.join(MAIN_PACKAGE, mainManifest.types)
        await fs.cp(srcTypes, dstTypes)

        // And now, publish'em all!
        let success = false
        try {
            console.info('Publishing all packages with npm...')
            await spawn('npm', [
                'publish', '--workspaces', '--access=public', DEBUG ? '--dry-run' : ''
            ].filter(Boolean), { stdio: 'inherit' })

            success = true
        }
        // Note: no catch block here, the outer catch block will be executed afer this finally block
        finally {
            console.info('Cleaning up...')
            await Promise.all(copiedBinaries.map(bin => fs.rm(bin)))
            await spawn('git', [ 'checkout', 'packages' ])

            if (success && !DEBUG) {
                console.info('Bumping repo version...')
                await spawn('npm', [ 'version', '--no-git-tag-version', koffiManifest.version ])

                console.info('Updating the repo...')
                await spawn('git', [ 'commit', '-a', '-m', `Update to Koffi ${koffiManifest.version}` ])

                const tag = `v${koffiManifest.version}`
                console.info('Creating and pushing tag', tag)
                await spawn('git', [ 'tag', tag ])
                await spawn('git', [ 'push', '--follow-tags' ])
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
