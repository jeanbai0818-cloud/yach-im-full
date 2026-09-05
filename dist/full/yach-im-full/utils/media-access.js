'use strict';

const path = require('node:path');
const { readLocalFileFromRoots } = require('openclaw/plugin-sdk/file-access-runtime');
const { getAgentScopedMediaLocalRoots } = require('openclaw/plugin-sdk/media-local-roots');

const DEFAULT_MEDIA_MAX_BYTES = 100 * 1024 * 1024;

function uniqueRoots(values) {
  return [...new Set(values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim()))];
}

function resolveMediaRoots(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('本地媒体读取必须通过 OpenClaw 工具上下文执行。');
  }

  const cfg = ctx.runtimeConfig ?? ctx.config ?? {};
  let roots = [];
  try {
    roots = [...getAgentScopedMediaLocalRoots(cfg, ctx.agentId)];
  } catch {
    roots = [];
  }

  // workspaceDir and fsPolicy.root are host-selected roots. Do not add cwd,
  // process home, arbitrary environment paths, or another plugin's state.
  roots.push(ctx.workspaceDir, ctx.fsPolicy?.root);
  const normalized = uniqueRoots(roots);
  if (normalized.length === 0) {
    throw new Error('OpenClaw 没有为当前 Agent 提供可读取的媒体目录。');
  }
  return normalized;
}

function resolveMaxBytes(ctx, requested) {
  const configuredMb = Number(
    ctx?.runtimeConfig?.agents?.defaults?.mediaMaxMb
      ?? ctx?.config?.agents?.defaults?.mediaMaxMb,
  );
  const configured = Number.isFinite(configuredMb) && configuredMb > 0
    ? Math.floor(configuredMb * 1024 * 1024)
    : DEFAULT_MEDIA_MAX_BYTES;
  const requestedBytes = Number(requested);
  return Number.isFinite(requestedBytes) && requestedBytes > 0
    ? Math.min(Math.floor(requestedBytes), configured)
    : configured;
}

async function readAuthorizedMediaFile(filePath, ctx, options = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('媒体文件路径不能为空。');
  }

  const roots = resolveMediaRoots(ctx);
  const result = await readLocalFileFromRoots({
    filePath,
    roots,
    label: 'OpenClaw agent media roots',
    maxBytes: resolveMaxBytes(ctx, options.maxBytes),
    hardlinks: 'reject',
    symlinks: 'reject',
  });
  if (!result) {
    throw new Error('媒体文件不在 OpenClaw 当前 Agent 的授权媒体目录内。');
  }

  return {
    buffer: result.buffer,
    size: result.buffer.length,
    filePath,
    name: path.basename(filePath),
    root: result.root,
  };
}

module.exports = {
  DEFAULT_MEDIA_MAX_BYTES,
  readAuthorizedMediaFile,
  resolveMediaRoots,
};
