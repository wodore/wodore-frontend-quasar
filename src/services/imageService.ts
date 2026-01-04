import hmacSHA256 from 'crypto-js/hmac-sha256';
import Base64 from 'crypto-js/enc-base64';

function signPath(path: string, secret: string) {
  return hmacSHA256(path, secret)
    .toString(Base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function dimensionToArray(size: string) {
  const sizeList = size.split('x');
  return [Math.abs(parseInt(sizeList[0])), Math.abs(parseInt(sizeList[1]))];
}
// https://github.com/cshum/imagor?tab=readme-ov-file#image-endpoint
type ImagorOptions = {
  unsafe?: boolean;
  cropStart?: string;
  cropStop?: string;
  smart?: boolean;
  trim?: boolean;
  fit?: boolean;
  stretch?: boolean;
  size: string;
  halign?: 'left' | 'right' | 'center';
  valign?: 'top' | 'bottom' | 'middle';
  // shortcuts for filters:
  focal?: string; // rectangle or point: 0.1,0.8:0.2,0.9 or 0.1,0.8 , also in pixel, sets start automatically
  quality?: number; // integer 0 .. 100
  filters?: Array<string>; // https://github.com/cshum/imagor?tab=readme-ov-file#filters
};
export default function getImageUrl(
  path: string,
  options: ImagorOptions = {
    size: '600x400',
  },
): string {
  // Replace API host + /media URLs with configured value if enabled
  const replaceWith = process.env.WODORE_IMAGOR_REPLACE_API_HOST_MEDIA;
  const apiHost = process.env.WODORE_API_HOST;

  if (replaceWith !== 'disabled' && apiHost) {
    const apiHostWithMedia = apiHost + '/media/';

    if (path.startsWith(apiHostWithMedia)) {
      // Strip API host + /media/ prefix and replace with configured value
      const pathWithoutPrefix = path.substring(apiHostWithMedia.length);
      path = replaceWith
        ? replaceWith + '/' + pathWithoutPrefix
        : pathWithoutPrefix;
    }
  }

  if (!options.filters) {
    options.filters = [];
  }
  const trim = options.trim ? '/trim' : '';
  let crop = '';
  if (options.cropStart && options.cropStop) {
    crop = '/' + options.cropStart + ':' + options.cropStop;
  } else if (options.cropStart) {
    const sizeList = dimensionToArray(options.size);
    const cropList = dimensionToArray(options.cropStart);
    crop =
      '/' +
      options.cropStart +
      ':' +
      (cropList[0] + sizeList[0]).toString() +
      'x' +
      (cropList[1] + sizeList[1]).toString();
  }
  if (options.focal) {
    options.filters?.push(`focal(${options.focal})`);
  }
  if (options.quality) {
    options.filters?.push(`quality(${options.quality})`);
  }
  const size = options.size ? '/' + options.size : '';
  const fit = options.trim ? '/fit' : '';
  const stretch = options.stretch ? '/stretch' : '';
  const smart = options.smart ? '/smart' : '';
  const halign = options.halign ? '/' + options.halign : '';
  const valign = options.valign ? '/' + options.valign : '';
  const filters =
    options.filters.length > 0 ? '/filters:' + options.filters.join(':') : '';
  const url = process.env.WODORE_IMAGOR_URL
    ? process.env.WODORE_IMAGOR_URL
    : 'https://img.MISSING';
  const trimString = (str: string, chars: string) =>
    str.split(chars).filter(Boolean).join(chars);
  const rawPath = trimString(
    trim +
      crop +
      fit +
      stretch +
      size +
      halign +
      valign +
      smart +
      filters +
      '/' +
      encodeURIComponent(path),
    '/',
  );
  let hash = 'unsafe';

  if (!options.unsafe) {
    hash = signPath(
      rawPath,
      process.env.WODORE_IMAGOR_KEY ? process.env.WODORE_IMAGOR_KEY : 'my_key',
    );
  }
  return url + '/' + hash + '/' + rawPath;
}

//console.log(
//  'Test path hash:',
//  signPath(
//    '500x500/top/raw.githubusercontent.com/cshum/imagor/master/testdata/gopher.png',
//    'mysecret',
//  ),
//);
//console.log(
//  'final test hash',
//  getImageUrl(
//    'raw.githubusercontent.com/cshum/imagor/master/testdata/gopher.png',
//    { size: '500x500', valign: 'top' },
//  ),
//);
