import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { getJWTClient, getOAuth2Client } from './google-auth.js';
import { buildConfig } from '../config/env.js';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

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

export async function exportToPdf(fileId, user = null) {
  const drive = getDriveClient(user);
  const res = await drive.files.export(
    { fileId, mimeType: 'application/pdf' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

// Escape a value for inclusion in a single-quoted Google Drive query string.
// Drive Query Language escapes \ and ' with a backslash; without this an
// attacker-controlled name/id/mimeType could inject query operators.
function escapeGQLString(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function listFiles(folderId = null, query = {}, user = null) {
  const drive = getDriveClient(user);
  const qParts = [];

  if (folderId) {
    qParts.push(`'${escapeGQLString(folderId)}' in parents`);
  }
  if (query.trashed === false) {
    qParts.push("trashed = false");
  }
  if (query.mimeType) {
    qParts.push(`mimeType = '${escapeGQLString(query.mimeType)}'`);
  }
  if (query.name) {
    qParts.push(`name = '${escapeGQLString(query.name)}'`);
  }

  const res = await drive.files.list({
    q: qParts.length ? qParts.join(' AND ') : undefined,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    pageSize: 100,
  });

  return res.data.files || [];
}

export async function deleteFile(fileId, user = null) {
  const drive = getDriveClient(user);
  await drive.files.delete({ fileId });
}

function getDefaultFolder() {
  const cfg = buildConfig();
  return cfg.drive.rootFolderId || 'root';
}

export async function ensureFolder(name, parentId = null, user = null) {
  const drive = getDriveClient(user);
  const queryParts = [`name = '${escapeGQLString(name)}'`, "mimeType = 'application/vnd.google-apps.folder'"];
  if (parentId) queryParts.push(`'${escapeGQLString(parentId)}' in parents`);

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
