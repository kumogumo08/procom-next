import 'server-only';

import sharp from 'sharp';

import { FAN_ICON_SIZE } from '@/lib/fanIcon';

/** 正方形に切り出して WebP にする。入力の形式は呼び出し側で確認する。 */
export async function encodeFanIcon(bytes: Buffer): Promise<Buffer> {
  const output = await sharp(bytes, {
    failOn: 'error',
    limitInputPixels: 16_777_216,
    animated: false,
    pages: 1,
  })
    .rotate()
    .resize(FAN_ICON_SIZE, FAN_ICON_SIZE, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
  if (output.length <= 0 || output.length > 512 * 1024) {
    throw new Error('encoded fan icon out of range');
  }
  return output;
}
