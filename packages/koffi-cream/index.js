// Copyright 2023 Niels Martignène <niels.martignene@protonmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the “Software”), to deal in
// the Software without restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
// Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

// Adapted by Stephan 'Septh' Schreiber
const { platform, arch } = require('node:process')
const { deprecate } = require('node:util')

let native
if (platform === 'linux' && (arch === 'x64' || arch === 'arm64')) {
    try {
        native = require(`@septh/koffi-linux-${arch}-glibc`)
    }
    catch {
        native = require(`@septh/koffi-linux-${arch}-musl`)
    }
}
else native = require(`@septh/koffi-${platform}-${arch}`)

module.exports = {
    ...native,

    // Deprecated functions in Koffi 2.x
    handle: deprecate(native.opaque, "The koffi.handle() function was deprecated in Koffi 2.1, use koffi.opaque() instead", "KOFFI001"),
    callback: deprecate(native.proto, "The koffi.callback() function was deprecated in Koffi 2.4, use koffi.proto() instead", "KOFFI002"),
    load: (...args) => {
        const lib = native.load(...args)
        lib.cdecl = deprecate((...args2) => lib.func("__cdecl", ...args2), "The koffi.cdecl() function was deprecated in Koffi 2.7, use koffi.func(...) instead", "KOFFI003")
        lib.stdcall = deprecate((...args2) => lib.func("__stdcall", ...args2), 'The koffi.stdcall() function was deprecated in Koffi 2.7, use koffi.func("__stdcall", ...) instead', "KOFFI004")
        lib.fastcall = deprecate((...args2) => lib.func("__fastcall", ...args2), 'The koffi.fastcall() function was deprecated in Koffi 2.7, use koffi.func("__fastcall", ...) instead', "KOFFI005")
        lib.thiscall = deprecate((...args2) => lib.func("__thiscall", ...args2), 'The koffi.thiscall() function was deprecated in Koffi 2.7, use koffi.func("__thiscall", ...) instead', "KOFFI006")
        return lib
    }
}
