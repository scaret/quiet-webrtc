
/**
 * Convert an array buffer in UTF8 to string
 * @function ab2str
 * @memberof Quiet
 * @param {ArrayBuffer} ab - array buffer to be converted
 * @returns {string} s - converted string
 */

let textEncoder: TextEncoder|null = null;
let textDecoder: TextDecoder|null = null;

export function ab2str(ab: ArrayBuffer) {
    if (!textDecoder){
        textDecoder = new TextDecoder()
    }
    return textDecoder.decode(ab)
}

export function str2ab(str: string) {
    if (!textEncoder){
        textEncoder = new TextEncoder()
    }
    return textEncoder.encode(str)
}

export function mergeab(ab1:ArrayBuffer, ab2:ArrayBuffer) {
    var tmp = new Uint8Array(ab1.byteLength + ab2.byteLength);
    tmp.set(new Uint8Array(ab1), 0);
    tmp.set(new Uint8Array(ab2), ab1.byteLength);
    return tmp.buffer;
}
