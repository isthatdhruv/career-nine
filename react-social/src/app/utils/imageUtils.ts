/**
 * Utility for converting images to WebP format, compressing them,
 * and compressing videos using FFmpeg.wasm (lazy-loaded).
 */

/**
 * Converts an image File to WebP format with compression.
 * @param file - The image File to convert
 * @param quality - WebP quality (0 to 1). Default 0.8
 * @param maxWidth - Maximum width in pixels. Image will be scaled down if larger. Default 1920
 * @param maxHeight - Maximum height in pixels. Image will be scaled down if larger. Default 1080
 * @returns A promise that resolves to { base64: string, blob: Blob, file: File }
 */
export async function convertImageToWebP(
  file: File,
  quality: number = 0.8,
  maxWidth: number = 1920,
  maxHeight: number = 1080
): Promise<{ base64: string; blob: Blob; file: File }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate scaled dimensions while maintaining aspect ratio
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to convert image to WebP"));
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const webpFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".webp"),
              { type: "image/webp" }
            );
            resolve({ base64, blob, file: webpFile });
          };
          reader.onerror = () => reject(new Error("Failed to read WebP blob"));
          reader.readAsDataURL(blob);
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Converts a File to a base64 data URL string (no compression).
 * @param file - The File
 * @returns A promise that resolves to the base64 data URL
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generates a video thumbnail from the first frame.
 * @param videoFile - The video File
 * @returns A promise that resolves to a base64 thumbnail image (JPEG)
 */
export function generateVideoThumbnail(videoFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(videoFile);
    video.preload = "metadata";

    video.onloadeddata = () => {
      video.currentTime = 0.5; // Seek to 0.5s for thumbnail
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL("image/jpeg", 0.7);
      URL.revokeObjectURL(url);
      resolve(thumbnail);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };

    video.src = url;
  });
}

// Lazy-loaded FFmpeg singleton
let ffmpegInstance: any = null;
let ffmpegLoading: Promise<void> | null = null;

/**
 * Get or initialize the FFmpeg.wasm instance (singleton, lazy-loaded).
 * FFmpeg modules are dynamically imported only when video compression is needed.
 */
async function getFFmpeg(): Promise<any> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (ffmpegLoading) {
    await ffmpegLoading;
    return ffmpegInstance!;
  }

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");

  ffmpegInstance = new FFmpeg();

  ffmpegLoading = (async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpegInstance!.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
  })();

  await ffmpegLoading;
  return ffmpegInstance!;
}

/**
 * Compress a video file using FFmpeg.wasm.
 * Outputs MP4 (H.264 + AAC) with reduced bitrate and resolution.
 *
 * @param file - The video File to compress
 * @param onProgress - Optional callback for progress updates (0-100)
 * @param maxWidth - Maximum width. Default 1280 (720p)
 * @param crf - Constant Rate Factor (quality). Higher = smaller/lower quality. Default 28.
 * @returns A promise resolving to { base64: string, blob: Blob, file: File }
 */
export async function compressVideo(
  file: File,
  onProgress?: (progress: number) => void,
  maxWidth: number = 1280,
  crf: number = 28
): Promise<{ base64: string; blob: Blob; file: File }> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getFFmpeg();

  // Set up progress handler
  if (onProgress) {
    ffmpeg.on("progress", ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });
  }

  const inputName = "input" + getExtension(file.type);
  const outputName = "output.mp4";

  // Write input file to FFmpeg virtual filesystem
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Run FFmpeg compression
  await ffmpeg.exec([
    "-i", inputName,
    "-vf", `scale='min(${maxWidth},iw)':-2`,
    "-c:v", "libx264",
    "-crf", String(crf),
    "-preset", "fast",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outputName,
  ]);

  // Read the output file
  const outputData = await ffmpeg.readFile(outputName);
  const outputBlob = new Blob([outputData], { type: "video/mp4" });

  // Clean up FFmpeg virtual filesystem
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  // Convert to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read compressed video"));
    reader.readAsDataURL(outputBlob);
  });

  const compressedFile = new File(
    [outputBlob],
    file.name.replace(/\.[^.]+$/, ".mp4"),
    { type: "video/mp4" }
  );

  return { base64, blob: outputBlob, file: compressedFile };
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "video/mp4": return ".mp4";
    case "video/webm": return ".webm";
    case "video/ogg": return ".ogg";
    case "video/quicktime": return ".mov";
    case "video/x-msvideo": return ".avi";
    case "video/x-matroska": return ".mkv";
    default: return ".mp4";
  }
}
