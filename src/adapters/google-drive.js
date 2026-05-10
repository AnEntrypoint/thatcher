/**
 * Google Drive Adapter - File storage and manipulation
 * Upload, download, copy, export to PDF
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { getJWTClient, getOAuth2Client } from './google-auth.js';
import { buildConfig } from '../config/env.js';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Get authenticated Drive API client
 * @param {object} [user] - User with oauth_token, or null for service account
 * @returns {object}
 */
export function getDriveClient(user = null) {
  let client;

  if (user?.oauth_token) {
    // User-delegated access
    client = getOAuth2Client();
    client.setCredentials({ access_token: user.oauth_token });
  } else {
    // Service account (app-wide)
    client = getJWTClient();
  }

  if (!client) throw new Error('Google Drive not configured');

  return google.drive({ version: 'v3', auth: client });
}

/**
 * Upload a file to Google Drive
 * @param {string} filePath - Local file path
 * @param {string} name - File name in Drive
 * @param {object} [options] - { folderId, mimeType, parents }
 * @param {object} [user] - Optional user context
 * @returns {object} File metadata
 */
export async function uploadFile(filePath, name, options = {}, user = null) {
  const drive = getDriveClient(user);
  const absPath = path.resolve(filePath);
  const fileSize = fs.statSync(absPath).size;

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: options.parents || [options.folderId || getDefaultFolder()],
      mimeType: options.mimeType || 'application/octet-stream',
    },
    media: {
      mimeType: options.mimeType || 'application/octet-stream',
      body: fs.createReadStream(absPath),
    },
  });

  return res.data;
}

/**
 * Download file from Drive
 * @param {string} fileId
 * @param {string} [destPath] - If provided, write to file; else return buffer
 * @param {object} [user] - Optional user context
 * @returns {Buffer|string}
 */
export async function downloadFile(fileId, destPath = null, user = null) {
  const drive = getDriveClient(user);
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: destPath ? 'stream' : 'arraybuffer' }
  );

  if (destPath) {
    const writeStream = fs.createWriteStream(destPath);
    res.data
      .on('end', () => {})
      .on('error', err => { throw err; })
      .pipe(writeStream);
    return destPath;
  }

  return Buffer.from(res.data);
}

/**
 * Create a copy of a file in Drive
 * @param {string} fileId
 * @param {string} [newName]
 * @param {string} [folderId]
 * @param {object} [user]
 * @returns {object}
 */
export async function copyFile(fileId, newName = null, folderId = null, user = null) {
  const drive = getDriveClient(user);
  const res = await drive.files.copy({
    requestBody: {
      name: newName,
      parents: folderId ? [folderId] : undefined,
    },
    fileId,
  });
  return res.data;
}

/**
 * Export Google Doc to PDF
 * @param {string} fileId
 * @param {object} [user]
 * @returns {Buffer}
 */
export async function exportToPdf(fileId, user = null) {
  const drive = getDriveClient(user);
  const res = await drive.files.export(
    { fileId, mimeType: 'application/pdf' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

/**
 * List files in folder
 * @param {string} [folderId]
 * @param {object} [query]
 * @param {object} [user]
 * @returns {Array}
 */
export async function listFiles(folderId = null, query = {}, user = null) {
  const drive = getDriveClient(user);
  const qParts = [];

  if (folderId) {
    qParts.push(`'${folderId}' in parents`);
  }
  if (query.trashed === false) {
    qParts.push("trashed = false");
  }
  if (query.mimeType) {
    qParts.push(`mimeType = '${query.mimeType}'`);
  }
  if (query.name) {
    qParts.push(`name = '${query.name}'`);
  }

  const res = await drive.files.list({
    q: qParts.length ? qParts.join(' AND ') : undefined,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    pageSize: 100,
  });

  return res.data.files || [];
}

/**
 * Delete file
 * @param {string} fileId
 * @param {object} [user]
 */
export async function deleteFile(fileId, user = null) {
  const drive = getDriveClient(user);
  await drive.files.delete({ fileId });
}

/**
 * Get default root folder from config
 * @returns {string}
 */
function getDefaultFolder() {
  const cfg = buildConfig();
  return cfg.drive.rootFolderId || 'root';
}

/**
 * Ensure folder exists, create if not
 * @param {string} name
 * @param {string} [parentId]
 * @param {object} [user]
 * @returns {string} folderId
 */
export async function ensureFolder(name, parentId = null, user = null) {
  const drive = getDriveClient(user);
  const queryParts = [`name = '${name}'`, "mimeType = 'application/vnd.google-apps.folder'"];
  if (parentId) queryParts.push(`'${parentId}' in parents`);

  const res = await drive.files.list({
    q: queryParts.join(' AND '),
    fields: 'files(id)',
    pageSize: 1,
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Create folder
  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
  });

  return createRes.data.id;
}
