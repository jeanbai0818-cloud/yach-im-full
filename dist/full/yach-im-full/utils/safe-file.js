'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

function parseConfiguredRoots() {
  const roots = [];
  if (process.env.YACH_IM_FULL_STATE_DIR) roots.push(process.env.YACH_IM_FULL_STATE_DIR);
  if (process.env.YACH_STATE_DIR) roots.push(process.env.YACH_STATE_DIR);
  if (process.env.YACH_FILE_ROOTS) {
    roots.push(...process.env.YACH_FILE_ROOTS.split(path.delimiter).filter(Boolean));
  } else {
    roots.push(process.cwd(), os.tmpdir());
  }
  return [...new Set(roots.map((root) => path.resolve(root)))];
}

function isInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function realRoot(root) {
  try {
    return fs.realpathSync(root);
  } catch {
    return path.resolve(root);
  }
}

/**
 * Resolve and validate a user-supplied local upload path.
 *
 * The final real path must stay within one of the configured roots. Resolving
 * both the file and roots prevents symlink traversal outside an allowed root.
 */
function resolveSafeFile(filePath, options = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('本地文件路径不能为空');
  }

  const requested = path.resolve(filePath);
  let realPath;
  try {
    realPath = fs.realpathSync(requested);
  } catch {
    throw new Error(`本地文件不存在：${requested}`);
  }

  const stat = fs.statSync(realPath);
  if (!stat.isFile()) throw new Error(`本地路径不是普通文件：${requested}`);

  const roots = (options.allowedRoots || parseConfiguredRoots()).map(realRoot);
  if (!roots.some((root) => isInside(realPath, root))) {
    throw new Error('拒绝读取允许目录之外的本地文件；请配置 allowedFileRoots');
  }

  const configuredMax = Number(process.env.YACH_MAX_UPLOAD_BYTES);
  const maxBytes = Number(options.maxBytes)
    || (Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : DEFAULT_MAX_BYTES);
  if (stat.size > maxBytes) {
    throw new Error(`本地文件超过上传上限：${stat.size} > ${maxBytes} bytes`);
  }

  return realPath;
}

module.exports = { DEFAULT_MAX_BYTES, parseConfiguredRoots, resolveSafeFile };
