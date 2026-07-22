// Native picker commands shared by image block context menus.
import {
  createContentImageBlock,
  type ContentImageBlock,
} from "./contentImageModel";
import { chooseImageFile, readFileAsDataUrl, readImageDimensions } from "./imageFile";
import { createImageBlock, type ImageBlock } from "./imageModel";

export async function replaceContentImageFromPicker(
  block: ContentImageBlock,
): Promise<ContentImageBlock | null> {
  const file = await chooseImageFile();
  if (file === null) {
    return null;
  }
  const source = await readFileAsDataUrl(file);
  const dimensions = await readImageDimensions(source);
  return createContentImageBlock(
    block.id,
    source,
    block.widthFraction,
    dimensions.width,
    dimensions.height,
  );
}

export async function replaceImageFromPicker(
  block: ImageBlock,
): Promise<ImageBlock | null> {
  const file = await chooseImageFile();
  if (file === null) {
    return null;
  }
  const source = await readFileAsDataUrl(file);
  const dimensions = await readImageDimensions(source);
  return createImageBlock(
    block.id,
    source,
    block.captionInlines,
    block.referenceId,
    block.widthFraction,
    dimensions.width,
    dimensions.height,
  );
}
