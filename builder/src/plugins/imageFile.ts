// Browser image-file helpers shared by figure editors.
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("The selected image could not be encoded"));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("The selected image could not be read"));
    });
    reader.readAsDataURL(file);
  });
}

export function readImageDimensions(
  source: string,
): Promise<Readonly<{ width: number; height: number }>> {
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image();
    image.addEventListener("load", () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    });
    image.addEventListener("error", () => {
      reject(new Error("The selected file is not a browser-renderable image"));
    });
    image.src = source;
  });
}

export function chooseImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.hidden = true;
    document.body.append(input);
    let settled = false;
    const finish = (file: File | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    }, { once: true });
    input.addEventListener("cancel", () => {
      finish(null);
    }, { once: true });
    input.click();
  });
}
