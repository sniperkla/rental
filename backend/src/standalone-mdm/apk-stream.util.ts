import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';

/**
 * Resolves the absolute directory where APK files are stored.
 * Path: <backend_root>/uploads/apks/
 */
export function getApkStorageDir(): string {
  return path.resolve(process.cwd(), 'uploads', 'apks');
}

/**
 * Streams an APK file to the HTTP response.
 * Validates the file name to prevent directory traversal (only allows .apk files).
 * Sets Content-Type and Content-Disposition headers for silent background download by DPC.
 *
 * @param apkFileName  The base file name (e.g. 'my-dpc-agent.apk'). Must not contain path separators.
 * @param res          The Express Response object from the controller.
 * @returns            A NestJS StreamableFile piped to the response.
 */
export function streamApk(apkFileName: string, res: Response): StreamableFile {
  // Security: reject names with path separators or non-apk extensions
  const sanitizedName = path.basename(apkFileName);
  if (!sanitizedName.endsWith('.apk') || sanitizedName !== apkFileName) {
    throw new NotFoundException('Invalid APK file name');
  }

  const apkPath = path.join(getApkStorageDir(), sanitizedName);

  if (!fs.existsSync(apkPath)) {
    throw new NotFoundException(`APK file not found: ${sanitizedName}`);
  }

  const stat = fs.statSync(apkPath);
  const stream = fs.createReadStream(apkPath);

  res.set({
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': `attachment; filename="${sanitizedName}"`,
    'Content-Length': stat.size.toString(),
    // DPC should cache the downloaded APK using ETag
    'ETag': `"${stat.mtimeMs}-${stat.size}"`,
    'Cache-Control': 'no-store',
  });

  return new StreamableFile(stream);
}
