import { DecodingMode } from './DecodingMode'
import { EntityDecoder } from './EntityDecoder'

/**
 * Creates a function that decodes entities in a string.
 *
 * @param decodeTree The decode tree.
 * @returns A function that decodes entities in a string.
 */
export function getDecoder(decodeTree: Uint16Array) {
  let returnValue = "";
  const decoder = new EntityDecoder(
    decodeTree,
    (data) => (returnValue += String.fromCodePoint(data)),
  );

  return function decodeWithTrie(
    input: string,
    decodeMode: DecodingMode,
  ): string {
    let lastIndex = 0;
    let offset = 0;

    while ((offset = input.indexOf("&", offset)) >= 0) {
      returnValue += input.slice(lastIndex, offset);

      decoder.startEntity(decodeMode);

      const length = decoder.write(
        input,
        offset + 1,
      );

      if (length < 0) {
        lastIndex = offset + decoder.end();
        break;
      }

      lastIndex = offset + length;
      offset = length === 0 ? lastIndex + 1 : lastIndex;
    }

    const result = returnValue + input.slice(lastIndex);

    returnValue = "";

    return result;
  };
}
