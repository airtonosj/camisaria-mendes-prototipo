import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.mjs";

export { campaignPhases } from '../../shared/domain.mjs';

export const campaignSizeCodesByModel = new Map([
  ["common", new Set(["P", "M", "G", "GG", "EXGG", "PB", "MB", "GB"])],
  ["oversized", new Set(["PP", "P", "M", "G", "GG", "XG"])],
]);

export const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const frontendDirectory = path.join(projectDirectory, "dist");

export const uploadsDirectory = config.uploadsDirectory;

export const migrationsDirectory = path.join(projectDirectory, "database", "migrations");

export const uploadExtensions = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export const uploadContentTypes = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["webp", "image/webp"],
  ["mp4", "video/mp4"],
]);

export const frontendContentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

export const maxUploadBytes = 2 * 1024 * 1024;

export const maxVideoUploadBytes = 10 * 1024 * 1024;

export const staleVideoPartAgeMs = 24 * 60 * 60 * 1000;

export const rateLimitEntries = new Map();
