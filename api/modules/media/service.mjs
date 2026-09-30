import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../../database.mjs";
import { frontendDirectory, uploadsDirectory, uploadExtensions, uploadContentTypes, frontendContentTypes, maxUploadBytes, maxVideoUploadBytes, staleVideoPartAgeMs } from "../../runtime/constants.mjs";
import { ApiError, readBinary } from "../../http/response.mjs";
import { requireStaff } from "../../http/auth.mjs";
import { config } from "../../config.mjs";
import { getCampaign } from "../campaigns/service.mjs";
import { campaignPreviewHtml, campaignShareSource, renderShareImage } from "./campaign-preview.mjs";

export async function listSizes() {
  const [rows] = await pool.execute(
    "SELECT code, name, size_group FROM sizes WHERE active = TRUE ORDER BY sort_order",
  );
  return rows.map((row) => ({ code: row.code, name: row.name, group: row.size_group }));
}

export function looksLikeImage(buffer, extension) {
  if (extension === "png") return buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (extension === "jpg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  return buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP";
}

export async function uploadArtwork(request) {
  await requireStaff(request);
  const contentType = String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  const extension = uploadExtensions.get(contentType);
  if (!extension) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Envie a arte em PNG, JPG ou WEBP.");
  }
  const file = await readBinary(request, maxUploadBytes);
  if (!looksLikeImage(file, extension)) {
    throw new ApiError(422, "INVALID_IMAGE", "O arquivo enviado não é uma imagem válida.");
  }
  const filename = `${randomUUID()}.${extension}`;
  await fs.mkdir(uploadsDirectory, { recursive: true });
  await fs.writeFile(path.join(uploadsDirectory, filename), file);
  return { url: `/uploads/${filename}`, bytes: file.length };
}

export function looksLikeMp4(buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

export async function cleanupStaleVideoParts() {
  const temporaryDirectory = path.join(uploadsDirectory, ".tmp");
  const entries = await fs.readdir(temporaryDirectory, { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - staleVideoPartAgeMs;
  for (const entry of entries) {
    if (!entry.isFile() || !/^[0-9a-f-]{36}\.part$/i.test(entry.name)) continue;
    const candidate = path.join(temporaryDirectory, entry.name);
    const stats = await fs.stat(candidate).catch(() => null);
    if (stats && stats.mtimeMs < cutoff) await fs.unlink(candidate).catch(() => {});
  }
}

export async function uploadVideo(request) {
  await requireStaff(request);
  const contentType = String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "video/mp4") {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Envie o vídeo em MP4.");
  }
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > maxVideoUploadBytes) {
    throw new ApiError(413, "VIDEO_TOO_LARGE", "O vídeo excede o limite de 10 MB.");
  }

  const id = randomUUID();
  const temporaryDirectory = path.join(uploadsDirectory, ".tmp");
  const temporaryFile = path.join(temporaryDirectory, `${id}.part`);
  const finalFile = path.join(uploadsDirectory, `${id}.mp4`);
  await fs.mkdir(temporaryDirectory, { recursive: true });
  const handle = await fs.open(temporaryFile, "wx");
  let bytes = 0;
  let signature = Buffer.alloc(0);
  let completed = false;
  try {
    for await (const chunk of request) {
      if (request.aborted) throw new ApiError(400, "UPLOAD_INTERRUPTED", "O envio do vídeo foi interrompido.");
      bytes += chunk.length;
      if (bytes > maxVideoUploadBytes) throw new ApiError(413, "VIDEO_TOO_LARGE", "O vídeo excede o limite de 10 MB.");
      if (signature.length < 12) signature = Buffer.concat([signature, chunk.subarray(0, 12 - signature.length)]);
      let offset = 0;
      while (offset < chunk.length) {
        const result = await handle.write(chunk, offset, chunk.length - offset);
        offset += result.bytesWritten;
      }
    }
    if (bytes === 0 || !looksLikeMp4(signature)) {
      throw new ApiError(422, "INVALID_VIDEO", "O arquivo enviado não possui uma assinatura MP4 válida.");
    }
    await handle.sync();
    await handle.close();
    await fs.rename(temporaryFile, finalFile);
    completed = true;
    return { url: `/uploads/${id}.mp4`, bytes };
  } catch (error) {
    if (request.aborted || error?.code === "ECONNRESET") {
      throw new ApiError(400, "UPLOAD_INTERRUPTED", "O envio do vídeo foi interrompido.");
    }
    throw error;
  } finally {
    if (!completed) {
      await handle.close().catch(() => {});
      await fs.unlink(temporaryFile).catch(() => {});
    }
  }
}

export function parseByteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (!match[1] && !match[2])) return false;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return false;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

export async function serveUpload(request, response, filename) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|mp4)$/.test(filename)) {
    throw new ApiError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.");
  }
  const filePath = path.join(uploadsDirectory, filename);
  let stats;
  try {
    stats = await fs.stat(filePath);
    if (!stats.isFile()) throw new Error("not a file");
  } catch {
    throw new ApiError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.");
  }
  const extension = filename.split(".").pop();
  const range = extension === "mp4" ? parseByteRange(request.headers.range, stats.size) : null;
  if (range === false) {
    response.writeHead(416, {
      "Content-Range": `bytes */${stats.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    response.end();
    return;
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? stats.size - 1;
  response.writeHead(range ? 206 : 200, {
    "Content-Type": uploadContentTypes.get(extension),
    "Content-Length": Math.max(0, end - start + 1),
    ...(extension === "mp4" ? { "Accept-Ranges": "bytes" } : {}),
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${stats.size}` } : {}),
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD" || stats.size === 0) {
    response.end();
    return;
  }
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { start, end });
    stream.on("error", reject);
    response.on("close", resolve);
    stream.pipe(response);
  });
}

async function shareImage(source) {
  // Uploads are immutable by name, so the rendered thumbnail can be cached per source file.
  // It lives in .tmp because it is regenerable and must stay out of backups.
  const cacheDirectory = path.join(uploadsDirectory, ".tmp", "share-preview");
  const cacheFile = path.join(cacheDirectory, `${path.parse(source).name}.jpg`);
  const cached = await fs.readFile(cacheFile).catch(() => null);
  if (cached) return cached;
  const input = await fs.readFile(path.join(uploadsDirectory, source)).catch(() => null);
  if (!input) return null;
  let image;
  try {
    image = await renderShareImage(input);
  } catch {
    return null;
  }
  await fs.mkdir(cacheDirectory, { recursive: true });
  const partial = `${cacheFile}.${randomUUID()}.part`;
  await fs.writeFile(partial, image);
  await fs.rename(partial, cacheFile).catch(() => fs.unlink(partial).catch(() => {}));
  return image;
}

export async function serveShareImage(request, response, encodedCode) {
  let code;
  try {
    code = decodeURIComponent(encodedCode).trim().toUpperCase();
  } catch {
    code = "";
  }
  if (!code || code.length > 100) throw new ApiError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.");
  const source = campaignShareSource(await getCampaign(code), config.publicAppUrl);
  const image = source ? await shareImage(source) : null;
  if (!image) throw new ApiError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.");
  response.writeHead(200, {
    "Content-Type": "image/jpeg",
    "Content-Length": image.length,
    // The page links a versioned URL; the unversioned one may change when the campaign photo changes.
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : image);
}

export async function serveFrontend(request, response, requestPath) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const requestedFile = path.resolve(frontendDirectory, relativePath);
  const relativeToFrontend = path.relative(frontendDirectory, requestedFile);
  const staysInsideFrontend = relativeToFrontend
    && !relativeToFrontend.startsWith("..")
    && !path.isAbsolute(relativeToFrontend);

  let filePath = staysInsideFrontend ? requestedFile : path.join(frontendDirectory, "index.html");
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) filePath = path.join(frontendDirectory, "index.html");
  } catch {
    // Fallback do React para caminhos que nao correspondem a um arquivo compilado.
    filePath = path.join(frontendDirectory, "index.html");
  }

  let file;
  try {
    file = await fs.readFile(filePath);
  } catch {
    throw new ApiError(503, "FRONTEND_UNAVAILABLE", "O site ainda nao foi compilado neste servidor.");
  }

  const extension = path.extname(filePath).toLowerCase();
  if (filePath === path.join(frontendDirectory, "index.html")) {
    file = Buffer.from(await campaignPreviewHtml(file.toString("utf8"), request.url, config.publicAppUrl, getCampaign));
  }
  const immutableAsset = relativeToFrontend.startsWith(`assets${path.sep}`);
  response.writeHead(200, {
    "Content-Type": frontendContentTypes.get(extension) || "application/octet-stream",
    "Content-Length": file.length,
    "Cache-Control": immutableAsset ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : file);
}
