import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { NimListener } = require("./nim/nim-listener.cjs");
const { loadSession } = require("./auth/session.cjs");
const nimBridge = require("./nim-bridge.cjs");

let serviceContext = null;
let serviceStateDir = null;
let activeListener = null;
let activeResponder = null;
let serviceStopping = false;

function pluginConfig(ctx) {
  const config = ctx?.config ?? {};
  return config.plugins?.entries?.["yach-im-full"]?.config ?? {};
}

function configurePaths(ctx) {
  const config = pluginConfig(ctx);
  const { configurePayrollToken } = require("./yach-im-full/api/ch7-workbench/payroll/index.js");
  configurePayrollToken(config.payrollAdminToken);
  serviceStateDir = path.join(ctx.stateDir, "yach-im-full");
  fs.mkdirSync(serviceStateDir, { recursive: true, mode: 0o700 });
  process.env.YACH_IM_FULL_STATE_DIR = serviceStateDir;
  if (config.sessionPath) process.env.YACH_IM_FULL_SESSION_PATH = path.resolve(String(config.sessionPath));
  else delete process.env.YACH_IM_FULL_SESSION_PATH;
  return config;
}

function stopActiveListener() {
  activeResponder?.stop?.();
  activeResponder = null;
  nimBridge.clearActiveListener(activeListener);
  if (!activeListener) return;
  activeListener.destroy();
  activeListener = null;
}

async function startActiveListener(ctx, { force = false } = {}) {
  if (serviceStopping || !serviceContext) return { started: false, reason: "NIM 服务尚未运行" };
  const config = pluginConfig(ctx);
  if (config.nimEnabled === false || config.autoStartNim === false) return { started: false, reason: "NIM 自动连接已关闭" };
  if (activeListener && !force) return { started: true, connected: activeListener.isConnected };
  stopActiveListener();
  let session;
  try { session = loadSession(); } catch (error) {
    ctx.logger.error?.(`[yach-im-full][nim] session 加载失败：${error.message}`);
    return { started: false, reason: error.message };
  }
  if (!session?.user?.id || !session?.cloudtoken) {
    ctx.logger.info?.("[yach-im-full][nim] 尚未登录，NIM 保持空闲；执行 /yach_login 后即可连接");
    return { started: false, reason: "尚未登录（缺少 user.id/cloudtoken）" };
  }
  const listener = new NimListener({ logger: ctx.logger });
  let messaging = null;
  if (ctx.runtime?.agent?.runEmbeddedAgent) {
    const { AutoResponder } = require("./yach-im-full/daemon/auto-responder.js");
    messaging = require("./yach-im-full/api/ch1-messaging/index.js");
    activeResponder = new AutoResponder({
      runtime: ctx.runtime,
      config: ctx.config,
      selfId: String(session.user.id),
      selfNames: [session.user.name, session.user.name_nick].filter(Boolean),
      messaging,
      logger: ctx.logger,
    });
  }
  listener.on("disconnect", (error) => {
    const log = serviceStopping ? ctx.logger.info : ctx.logger.warn;
    log?.(`[yach-im-full][nim] 断线 ${error?.code ?? ""} ${error?.message ?? ""}`);
  });
  listener.on("error", (error) => ctx.logger.error?.(`[yach-im-full][nim] 错误：${error?.message ?? error}`));
  listener.on("authRequired", (error) => ctx.logger.warn?.(`[yach-im-full][nim] ${error.message}`));
  listener.on("message", (message, meta) => {
    ctx.logger.debug?.(`[yach-im-full][nim] 收到消息 scene=${message?.scene ?? "?"} source=${meta?.source ?? "?"}`);
    if (activeResponder) void activeResponder.handle(message, meta);
  });
  activeListener = listener;
  nimBridge.setActiveListener(listener);
  listener.start();
  ctx.logger.info?.(`[yach-im-full][nim] NIM 长连接启动 account=${session.user.id}`);
  return { started: true, connected: listener.isConnected };
}

function waitForAbort(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
}

export const nimService = {
  id: "yach-im-full-nim",
  async start(ctx) {
    serviceContext = ctx;
    serviceStopping = false;
    const config = configurePaths(ctx);
    if (config.nimEnabled !== false && config.autoStartNim !== false) await startActiveListener(ctx);
    else ctx.logger.info?.("[yach-im-full][nim] NIM 自动连接已关闭");
  },
  async stop(ctx) {
    serviceStopping = true;
    stopActiveListener();
    const { configurePayrollToken } = require("./yach-im-full/api/ch7-workbench/payroll/index.js");
    configurePayrollToken("");
    serviceContext = null;
    delete process.env.YACH_IM_FULL_STATE_DIR;
    delete process.env.YACH_IM_FULL_SESSION_PATH;
  },
};

export async function startNimFromLogin() {
  if (!serviceContext || serviceStopping) return { started: false, reason: "Gateway 尚未启动 yach-im-full NIM 服务" };
  return startActiveListener(serviceContext, { force: true });
}

export function getNimStatus() {
  let session = null;
  try { session = loadSession(); } catch {}
  return {
    serviceRunning: Boolean(serviceContext && !serviceStopping),
    configured: Boolean(session?.user?.id && session?.cloudtoken),
    accountId: session?.user?.id ? String(session.user.id) : undefined,
    connected: Boolean(activeListener?.isConnected),
  };
}

export function getActiveNimListener() {
  return activeListener;
}

export function getActiveNim() {
  return activeListener?.nim ?? null;
}
