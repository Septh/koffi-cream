# koffi-cream
A lighter repackaging of Niels Martignène's excellent [Koffi](https://koffi.dev).

Just `npm install koffi-cream` instead of `koffi` and use it like the real thing:

```ts
import koffi from 'koffi-cream'

const lib = koffi.lib('some_lib')
const some_func = lib.func('int some_func(int a, int b)')
// etc.
```

> [!IMPORTANT]
> **koffi-cream is neither a fork nor a patch. It *is* the original Koffi**, only packaged differently to avoid downloading a megalithic[^1] package bloated with files unnecessary to the average user[^2].

[^1]: As of 2.14.0, Koffi weights 16.9 MB compressed and 86 MB uncompressed.
[^2]: Koffi's package includes 18 native binaries (of which 17 are not compatible with your platform), the build tools and the full source code.


## The why and the how
The discussion at https://github.com/Koromix/koffi/issues/201 explains why I decided to create `koffi-cream`.

`koffi-cream` repackages Koffi using the same strategy as many popular packages in the JavaScript community like `esbuild` or `swc`: by leveraging the `optionalDependencies`, `os`, `cpu` and `libc` properties in `package.json`.

This way, when you install `koffi-cream`, your package manager will only download and install the build that is right for your platform. For example, on Windows AMD/Intel 64 bit, your package manager will install:
- `koffi-cream` (this package): 5.1 kB compressed / 19.8 kB uncompressed
- `@septh/koffi-win32-x64`: 536.2 kB compressed / 2.4 MB uncompressed

**That's 74.2% off compared to the original Koffi package!**

> [!NOTE]
> The `libc` property, used to distinguish Linux distros between gnu and musl, is only supported by `npm 10.4.0` and later, `pnpm 7.1.0` and later, and `yarn 3.2.0` and later.


## Available packages
`koffi-cream` purposely only offers a subset of Koffi's 18 native builds:

| Koffi binary  | koffi-cream package                                                                        |
|---------------|--------------------------------------------------------------------------------------------|
| darwin-arm64  | [@septh/koffi-darwin-arm64](https://www.npmjs.com/package/@septh/koffi-darwin-arm64)       |
| darwin-x64    | [@septh/koffi-darwin-x64](https://www.npmjs.com/package/@septh/koffi-darwin-x64)           |
| freebsd-arm64 | [@septh/koffi-freebsd-arm64](https://www.npmjs.com/package/@septh/koffi-freebsd-arm64)     |
| freebsd-ia32  | ❌                                                                                        |
| freebsd-x64   | [@septh/koffi-freebsd-x64](https://www.npmjs.com/package/@septh/koffi-freebsd-x64)         |
| linux-arm64   | [@septh/koffi-linux-arm64-glibc](https://www.npmjs.com/package/@septh/koffi-linux-arm64)   |
| linux-armhf   | ❌                                                                                        |
| linux-ia32    | ❌                                                                                        |
| linux-loong64 | [@septh/koffi-linux-loong64](https://www.npmjs.com/package/@septh/koffi-linux-loong64)     |
| linux-riscv64 | [@septh/koffi-linux-riscv64](https://www.npmjs.com/package/@septh/koffi-linux-riscv64)     |
| linux-x64     | [@septh/koffi-linux-x64-glibc](https://www.npmjs.com/package/@septh/koffi-linux-x64-glibc) |
| musl-arm64    | [@septh/koffi-linux-arm64-musl](https://www.npmjs.com/package/@septh/koffi-linux-arm64)    |
| musl-x64      | [@septh/koffi-linux-x64-musl](https://www.npmjs.com/package/@septh/koffi-linux-x64-musl)   |
| openbsd-ia32  | ❌                                                                                        |
| openbsd-x64   | [@septh/koffi-openbsd-x64](https://www.npmjs.com/package/@septh/koffi-openbsd-x64)         |
| win32-arm64   | [@septh/koffi-win32-arm64](https://www.npmjs.com/package/@septh/koffi-win32-arm64)         |
| win32-ia32    | ❌                                                                                        |
| win32-x64     | [@septh/koffi-win32-x64](https://www.npmjs.com/package/@septh/koffi-win32-x64)             |

I do not plan to add the other builds. If you need one of these, you'll have to stick with Koffi.


## Version numbering
To make things easy on the user, `koffi-cream`'s version number will always be aligned with Koffi's.

Hence, there is no `koffi-cream` 1.x or 2.0; the first version published is 2.11.0 which ships with Koffi 2.11.0 binaries.


## Related
- [libwin32](https://github.com/Septh/libwin32#readme): Node bindings to native Win32 DLLs through ~~Koffi~~ koffi-cream.


## License
MIT
