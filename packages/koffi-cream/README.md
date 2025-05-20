# Koffi-Cream

A lighter packaging of Niels Martignène's excellent [Koffi](https://koffi.dev).

Just `npm install koffi-cream` instead of `koffi` and use it like the real thing:

```ts
import koffi from 'koffi-cream'

const lib = koffi.lib('some_lib')
const fn = lib.func('int some_func(int a, int b)')
// etc.
```

## The why and the how

Most importantly: **this package is neither a fork nor a patch. It *is* the original Koffi**, only packaged differently to avoid downloading a megalithic[^1] package full of unnecessary files[^2].

`koffi-cream` repackages Koffi using the same strategy as many popular packages in the JavaScript community like `esbuild` or `swc`: by leveraging the `optionalDependencies`, `os`, `cpu` and `libc` properties in `package.json`.

This way, when you install `koffi-cream`, your package manager will only download and install the build that is right for your platform. For example, on Windows AMD/Intel 64 bit, your package manager will install:
- `koffi-cream` (this package): 3.4 kB compressed / 12.8 kB uncompressed
- `@koffi/win32-x64`: 455 kB compressed / 2.3 MB uncompressed

**That's 97% off compared to the original Koffi package!**

[^1]: As of 2.11.0, Koffi weights 15 MB compressed and 75 MB uncompressed!
[^2]: Koffi's package includes 16 natives binaries (of which 15 won't work on your platform), the build tools and the full source code!

## Available packages

`koffi-cream` only offers a subset of Koffi's 16 builds:

* @koffi/darwin-arm64
* @koffi/darwin-x64
* @koffi/freebsd-arm64
* @koffi/freebsd-x64
* @koffi/linux-arm64
* @koffi/linux-riscv64
* @koffi/linux-x64-glibc
* @koffi/linux-x64-musl
* @koffi/openbsd-x64
* @koffi/win32-arm64
* @koffi/win32-x64

I do not plan to add other builds, especially not the 32 bit binaries. If you need these, stick with Koffi.

## Version numbering

To make things easy on the user, `koffi-cream`'s version number will always be aligned with Koffi's.

Hence, the first version available of `koffi-cream` is 2.11.0 because that version ships with Koffi 2.11.0.

## Related

- The discussion at https://github.com/Koromix/koffi/issues/201 explains why I decided to create `koffi-cream` myself.

## License
MIT
