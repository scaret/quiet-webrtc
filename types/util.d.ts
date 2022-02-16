/**
 * Convert an array buffer in UTF8 to string
 * @function ab2str
 * @memberof Quiet
 * @param {ArrayBuffer} ab - array buffer to be converted
 * @returns {string} s - converted string
 */
export declare function ab2str(ab: ArrayBuffer): string;
export declare function str2ab(str: string): Uint8Array;
export declare function mergeab(ab1: ArrayBuffer, ab2: ArrayBuffer): ArrayBufferLike;
