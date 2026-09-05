/**
 * 第五章：文档与知识库
 * 前缀 25doc
 * 已验证：
 *   getWikiFolders ✅ 25doc/wiki/folder/list GET
 * 待测：
 *   searchDoc      25doc/document/search POST (参数待调)
 */
const { get, post, postJson } = require('../../utils/request');

/**
 * 获取知识库/文件夹列表
 */
async function getWikiFolders(opts = {}) {
  const r = await get('25doc/wiki/folder/list', { cp_id: 1, ...opts });
  if (r.code !== 200) throw new Error(`getWikiFolders failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 搜索文档（参数体系待验证）
 */
async function searchDoc(querystr, opts = {}) {
  const r = await post('25doc/document/search', {
    querystr,
    cp_id: 1,
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`searchDoc failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 知识库/文件夹详情
 * 路由：wiki/folder/detail（knowledgeBaseDetail）
 */
async function getWikiFolderDetail(folderId) {
  const r = await get('25doc/wiki/folder/detail', { folder_id: String(folderId), cp_id: 1 });
  if (r.code !== 200) throw new Error(`getWikiFolderDetail failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * wiki 文件列表
 * 路由：wiki/file/list（wikiFileList）
 */
async function getWikiFiles(folderId, opts = {}) {
  const r = await get('25doc/wiki/file/list', {
    folder_id: String(folderId), cp_id: 1,
    page: opts.page ?? 1, pagesize: opts.pagesize ?? 50,
  });
  if (r.code !== 200) throw new Error(`getWikiFiles failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 群文档列表
 * ⭐ 真实（doc.js + 实测）：`space/file/list` 必须用 **GET**（POST 报 10011），且需 group_id（群ID不能空 170012）
 *   —— 它是“群文档”列表，非知识库空间。知识库目录用 getWikiFolders。
 * @param {string|number} groupId  群 tid
 */
async function getSpaceList(groupId, opts = {}) {
  if (!groupId) throw new Error('getSpaceList 需 groupId（群文档列表按群查）');
  const r = await get('25doc/space/file/list', { cp_id: 1, group_id: String(groupId), ...opts });
  if (r.code !== 200) throw new Error(`getSpaceList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 建文档（写操作）
 * ⭐ 真实参数（home.js createDoc，实测验证）：只需 `{type:"newdoc"}` → 返回 obj.url（新文档地址）
 * 路由：`25doc/document/file/create`（documentFileCreate）
 * @param {object} params { type?:"newdoc", ... }
 * @returns {Promise<{url:string}>}
 */
async function createDocument(params = {}) {
  const r = await post('25doc/document/file/create', { type: 'newdoc', ...params });
  if (r.code !== 200) throw new Error(`createDocument failed: ${r.code} ${r.msg}`);
  return r.obj; // { url }
}

/**
 * 建 wiki 文件（写操作）
 * 路由：wiki/file/create（wikiFileCreat）
 */
async function createWikiFile(params = {}) {
  const r = await post('25doc/wiki/file/create', { cp_id: 1, ...params });
  if (r.code !== 200) throw new Error(`createWikiFile failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 最近访问文档列表（625doc 前缀）
 * 路由：625doc/lore/recent
 */
async function getRecentDocs(opts = {}) {
  const r = await get('625doc/lore/recent', {
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getRecentDocs failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 文档空间文件列表（625doc/client/file/list）
 * 含文件夹/文档，返回 full_url/guid/name/type 等
 */
async function getTorchFileList(opts = {}) {
  const r = await get('625doc/client/file/list', {
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
    ...(opts.parent_guid ? { parent_guid: opts.parent_guid } : {}),
  });
  if (r.code !== 200) throw new Error(`getTorchFileList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 重命名 wiki 文件（写操作）
 * 路由：25doc/wiki/file/rename
 * @param {string} fileId
 * @param {string} newName
 */
async function renameWikiFile(fileId, newName) {
  if (!fileId) throw new Error('renameWikiFile 需要 fileId');
  if (!newName) throw new Error('renameWikiFile 需要新名称');
  const r = await post('25doc/wiki/file/rename', { cp_id: 1, file_id: String(fileId), name: newName });
  if (r.code !== 200) throw new Error(`renameWikiFile failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除 wiki 文件（写操作）
 * 路由：25doc/wiki/file/delete
 * @param {string} fileId
 * @param {string} [folderId]
 */
async function deleteWikiFile(fileId, folderId) {
  if (!fileId) throw new Error('deleteWikiFile 需要 fileId');
  const body = { cp_id: 1, file_id: String(fileId) };
  if (folderId) body.folder_id = String(folderId);
  const r = await post('25doc/wiki/file/delete', body);
  if (r.code !== 200) throw new Error(`deleteWikiFile failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 搜索文档（625doc/client/file/search 或 25doc/document/search）
 * 625doc 路由可用，25doc/document/search 需 querystr 参数
 */
async function searchDocFull(query, opts = {}) {
  // ⭐ 真调验证（2026-07-20）：参数为 keyword（非 querystr），支持分页（page/pagesize）
  // 返回 { next, result: [{name, url, type, created_at, updated_at, highlight, ...}] }
  const r = await post('25doc/document/search', {
    keyword:  query,
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`searchDocFull failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取文档空间快捷入口列表（625doc/lore/quick/list）
 */
async function getQuickAccessList() {
  const r = await get('625doc/lore/quick/list', {});
  if (r.code !== 200) throw new Error(`getQuickAccessList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 团队文档空间列表（625doc/client/teamspace）
 * 返回我参与的团队空间（含 guid/name/role/user）
 */
async function getTeamspace() {
  const r = await get('625doc/client/teamspace', {});
  if (r.code !== 200) throw new Error(`getTeamspace failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 文档空间全文搜索（625doc/client/file/search）
 * ⭐ 真调验证（2026-07-20）：参数 keyword，返回带正文高亮 highlight 的结果
 * 与 25doc/document/search 区别：此为文档空间（桌面/团队）级搜索，返回 results[]
 */
async function searchClientFiles(keyword, opts = {}) {
  const r = await post('625doc/client/file/search', {
    keyword,
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 15,
  });
  if (r.code !== 200) throw new Error(`searchClientFiles failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 从最近访问列表移除一条（625doc/lore/recent/remove）
 * @param {string|number} id  来自 getRecentDocs 返回的 list[].id（注意是 id 不是 guid）
 */
async function removeRecentDoc(id) {
  if (!id && id !== 0) throw new Error('removeRecentDoc 需要 id（来自 getRecentDocs 的 list[].id）');
  const r = await post('625doc/lore/recent/remove', { id: String(id) });
  if (r.code !== 200) throw new Error(`removeRecentDoc failed: ${r.code} ${r.msg}`);
  return r.obj;
}

// ── 薪火知识库 617lorebase（全部用 postJson，JSON body，桌面端 jsonRequest 方式）──
// ⭐ 根因：form-urlencoded 会把数组字段搞坏 → 61000101；JSON body 全部 200（2026-07-20 真调验证）

/**
 * 获取我的薪火知识库列表（617lorebase/space/manage/list）
 * req_type: 1=我的知识库, 2=共享给我的
 */
async function loreManageList(reqType = 1) {
  const r = await postJson('617lorebase/space/manage/list', { req_type: reqType });
  if (r.code !== 200) throw new Error(`loreManageList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 进入/获取或创建我的个人知识库（617lorebase/space/create）
 * 幂等：有则返回现有，无则新建。返回 {topic_id, home_page_key}
 */
async function loreSpaceCreate(opts = {}) {
  const body = {
    is_my_doc: opts.isMyDoc !== false ? 1 : 0,
    is_desktop_file_import: opts.isDesktopFileImport ? 1 : 0,
    win_id: opts.winId || '',
  };
  const r = await postJson('617lorebase/space/create', body);
  if (r.code !== 200) throw new Error(`loreSpaceCreate failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取知识库目录树（617lorebase/space/sidenodes）
 * @param {string} topicId  来自 loreManageList 的 topic_id
 * @param {Object} opts     { nodeIds:[], actType:'reload' }
 */
async function loreSidenodes(topicId, opts = {}) {
  const body = {
    topic_id: topicId,
    is_need_use_config_sort: true,
    act_type: opts.actType || 'reload',
  };
  if (opts.nodeIds && opts.nodeIds.length) body.node_id = opts.nodeIds;
  const r = await postJson('617lorebase/space/sidenodes', body);
  if (r.code !== 200) throw new Error(`loreSidenodes failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 在知识库中新增节点（617lorebase/space/node/add）
 * @param {string} topicId       知识库 topic_id
 * @param {string} parentNodeId  父节点 node_id（根目录传 topicId）
 * @param {string} nodeType      doc / excel / ppt / form / folder
 *                               (newdoc→doc, mosheet→excel, slides→ppt, forms→form)
 * @param {string} name          节点名称（可选）
 * @param {Object} opts          { templateId, templateName }
 */
async function loreNodeAdd(topicId, parentNodeId, nodeType = 'doc', name = '', opts = {}) {
  const node = { node_type: nodeType };
  if (name) {
    node.name = name;
    node.title = name;
    node.node_name = name;
  }
  const r = await postJson('617lorebase/space/node/add', {
    topic_id: topicId,
    parent_node_id: parentNodeId || topicId,
    nodes: [node],
    template_id: opts.templateId || '',
    template_name: opts.templateName || '',
  });
  if (r.code !== 200) throw new Error(`loreNodeAdd failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 重命名知识库节点（617lorebase/space/node/edit/name）
 * @param {string} topicId  知识库 topic_id
 * @param {string} nodeId   节点 key（来自 sidenodes 的 key 字段）
 * @param {string} name     新名称
 */
async function loreNodeRename(topicId, nodeId, name) {
  const r = await postJson('617lorebase/space/node/edit/name', {
    topic_id: topicId,
    node_id: nodeId,
    name,
    node_open_url: '',
  });
  if (r.code !== 200) throw new Error(`loreNodeRename failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 移动知识库节点（617lorebase/space/node/drag）
 * @param {string} topicId          知识库 topic_id
 * @param {string} nodeId           要移动的节点 key
 * @param {string} parentNodeId     目标父节点（移到根传 topicId）
 * @param {string} targetNodeId     目标参考节点（排在此节点之后，空=移到开头）
 * @param {number} targetNodeIndex  目标位置 index
 * @param {string} originParentId   原父节点 id
 * @param {number} originNodeIndex  原 index
 */
async function loreNodeDrag(topicId, nodeId, parentNodeId, opts = {}) {
  const r = await postJson('617lorebase/space/node/drag', {
    topic_id: topicId,
    node_id: nodeId,
    parent_node_id: parentNodeId || topicId,
    target_node_id: opts.targetNodeId || '',
    target_node_index: opts.targetNodeIndex ?? 0,
    origin_node_index: opts.originNodeIndex ?? 0,
    origin_parent_id: opts.originParentId || topicId,
  });
  if (r.code !== 200) throw new Error(`loreNodeDrag failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除知识库节点（617lorebase/space/node/del）
 * @param {string} topicId  知识库 topic_id
 * @param {string} nodeId   节点 key
 * @param {number} all      0=仅此节点，1=含子节点
 */
async function loreNodeDelete(topicId, nodeId, all = 0) {
  const r = await postJson('617lorebase/space/node/del', {
    topic_id: topicId,
    node_id: nodeId,
    all,
    op_type: 'node',
  });
  if (r.code !== 200) throw new Error(`loreNodeDelete failed: ${r.code} ${r.msg}`);
  return r.obj;
}

// ── 薪火知识库权限管理（617lorebase，全部 postJson/get，真调验证 2026-07-20）──

/**
 * 知识库成员权限列表（617lorebase/space/auth/list）
 * 返回 { list: [{user_id, name, type, auth, ...}], total }
 * auth 枚举：1=可查看, 2=可编辑, 4=管理员
 */
async function loreSpaceAuthList(topicId, opts = {}) {
  const r = await postJson('617lorebase/space/auth/list', {
    topic_id: topicId,
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 50,
  });
  if (r.code !== 200) throw new Error(`loreSpaceAuthList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 添加知识库成员（617lorebase/space/auth/add）
 * @param {string} topicId
 * @param {number|string} userId   user_id
 * @param {number} auth            1=可查看 2=可编辑 4=管理员
 * @param {string} type            'user'|'dept'|'group'
 */
async function loreSpaceAuthAdd(topicId, userId, auth = 1, type = 'user') {
  const r = await postJson('617lorebase/space/auth/add', {
    topic_id: topicId,
    user_id: Number(userId),
    auth,
    type,
  });
  if (r.code !== 200) throw new Error(`loreSpaceAuthAdd failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 修改知识库成员权限（617lorebase/space/auth/edit）
 */
async function loreSpaceAuthEdit(topicId, userId, auth, type = 'user') {
  const r = await postJson('617lorebase/space/auth/edit', {
    topic_id: topicId,
    user_id: Number(userId),
    auth,
    type,
  });
  if (r.code !== 200) throw new Error(`loreSpaceAuthEdit failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除知识库成员（617lorebase/space/auth/del）
 */
async function loreSpaceAuthDel(topicId, userId, type = 'user') {
  const r = await postJson('617lorebase/space/auth/del', {
    topic_id: topicId,
    user_id: Number(userId),
    type,
  });
  if (r.code !== 200) throw new Error(`loreSpaceAuthDel failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 节点协作者列表（617lorebase/node/content/collaborators/list）
 * 返回 { list, inherit_list: [{name, auth, user_id, is_owner, ...}] }
 */
async function loreNodeCollaboratorsList(topicId, nodeId) {
  const r = await postJson('617lorebase/node/content/collaborators/list', {
    topic_id: topicId,
    node_id: nodeId,
  });
  if (r.code !== 200) throw new Error(`loreNodeCollaboratorsList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 添加节点协作者（617lorebase/node/content/collaborators/add）
 */
async function loreNodeCollaboratorsAdd(topicId, nodeId, userId, auth = 1, type = 'user') {
  const r = await postJson('617lorebase/node/content/collaborators/add', {
    topic_id: topicId,
    node_id: nodeId,
    user_id: Number(userId),
    auth,
    type,
  });
  if (r.code !== 200) throw new Error(`loreNodeCollaboratorsAdd failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除节点协作者（617lorebase/node/content/collaborators/del）
 */
async function loreNodeCollaboratorsDel(topicId, nodeId, userId, type = 'user') {
  const r = await postJson('617lorebase/node/content/collaborators/del', {
    topic_id: topicId,
    node_id: nodeId,
    user_id: Number(userId),
    type,
  });
  if (r.code !== 200) throw new Error(`loreNodeCollaboratorsDel failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 修改节点协作者权限（617lorebase/node/content/collaborators/edit）
 */
async function loreNodeCollaboratorsEdit(topicId, nodeId, userId, auth, type = 'user') {
  const r = await postJson('617lorebase/node/content/collaborators/edit', {
    topic_id: topicId,
    node_id: nodeId,
    user_id: Number(userId),
    auth,
    type,
  });
  if (r.code !== 200) throw new Error(`loreNodeCollaboratorsEdit failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 节点分享配置（617lorebase/node/share/get_conf）
 * 返回 { node_share_config: [{range_key, range_title, range_desc, ...}] }
 * range_key: 0=仅部分人可见, 1=企业内公开
 */
async function loreNodeShareGetConf(topicId, nodeId) {
  const r = await postJson('617lorebase/node/share/get_conf', {
    topic_id: topicId,
    node_id: nodeId,
  });
  if (r.code !== 200) throw new Error(`loreNodeShareGetConf failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 节点当前分享状态（617lorebase/node/share/get_content_conf）
 * 返回 { range_auth_key, range_key }
 */
async function loreNodeShareGetContentConf(topicId, nodeId) {
  const r = await postJson('617lorebase/node/share/get_content_conf', {
    topic_id: topicId,
    node_id: nodeId,
  });
  if (r.code !== 200) throw new Error(`loreNodeShareGetContentConf failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 设置文档/节点当前分享状态。
 * yach-aio 2.1.5 使用 guid 调用此接口；部分薪火节点也接受 node key 作为 guid。
 */
async function loreNodeShareSetContentConf(guid, rangeKey, rangeAuthKey) {
  const r = await postJson('617lorebase/node/share/set_content_conf', {
    guid: String(guid),
    range_key: Number(rangeKey),
    range_auth_key: Number(rangeAuthKey),
  });
  if (r.code !== 200) throw new Error(`loreNodeShareSetContentConf failed: ${r.code} ${r.msg}`);
  return loreNodeShareGetContentConfByGuid(guid);
}

async function loreNodeShareGetContentConfByGuid(guid) {
  const r = await postJson('617lorebase/node/share/get_content_conf', {
    guid: String(guid),
  });
  if (r.code !== 200) throw new Error(`loreNodeShareGetContentConfByGuid failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/** 通过 625doc 新建普通文档或文件夹。 */
async function createClientDocument(name, type = 'newdoc', parentGuid = '') {
  const body = { name: String(name), type: String(type) };
  if (parentGuid) body.folder = String(parentGuid);
  const r = await postJson('625doc/lore/doc/create', body);
  if (r.code !== 200) throw new Error(`createClientDocument failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 节点安全权限列表（617lorebase/node/security/list，GET）
 * 返回 { list: [{id, user_id, name, type, auth, ...}] }
 */
async function loreNodeSecurityList(topicId, nodeId) {
  const r = await get('617lorebase/node/security/list', {
    topic_id: topicId,
    node_id: nodeId,
  });
  if (r.code !== 200) throw new Error(`loreNodeSecurityList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 节点详情（617lorebase/space/node/info）
 * 返回 { node_info: {topic_id, topic_name, key, title, node_open_url, type, parent_node_id, ...} }
 */
async function loreNodeInfo(topicId, nodeId) {
  const r = await postJson('617lorebase/space/node/info', {
    topic_id: topicId,
    node_id: nodeId,
  });
  if (r.code !== 200) throw new Error(`loreNodeInfo failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 上传本地文件到薪火知识库 folder（sign → COS putObject → save 三段链路，真调打通 2026-07-20）
 * ⭐ folder_guid 必须传短 guid（如 KrkEVQO2m0izprAJ，来自节点 node_open_url），不是数字 node_id（传数字报 10001）
 * @param {string} folderGuid 目标文件夹短 guid（sign.parent_guid 与 save.folder_guid 必须一致）
 * @param {string} filePath   本地文件绝对路径
 * @param {Object} opts        { fileName }
 */
async function loreUploadFile(folderGuid, filePath, opts = {}, mediaContext) {
  const { readAuthorizedMediaFile } = require('../../utils/media-access');
  let COS;
  try { COS = require('cos-nodejs-sdk-v5'); }
  catch (e) { throw new Error('loreUploadFile 需要 cos-nodejs-sdk-v5 依赖，请 npm install'); }
  if (!folderGuid) throw new Error('loreUploadFile: folderGuid 必填（短 guid，非数字 node_id）');
  const media = await readAuthorizedMediaFile(filePath, mediaContext);
  const fileName = opts.fileName || media.name;

  // 1. sign：拿 STS 临时凭证 + file_key + JWT token
  const sr = await postJson('617lorebase/file/upload/sign', { file_name: fileName, parent_guid: folderGuid });
  if (sr.code !== 200) throw new Error(`loreUploadFile sign failed: ${sr.code} ${sr.msg}`);
  const o = sr.obj, sts = o.sts_credential;

  // 2. COS putObject 上传
  const cos = new COS({
    getAuthorization: (o2, cb) => cb({
      TmpSecretId: sts.tmp_secret_id, TmpSecretKey: sts.tmp_secret_key,
      SecurityToken: sts.session_token, StartTime: sts.start_time, ExpiredTime: sts.expired_time,
    }),
  });
  const put = await new Promise((res, rej) => {
    cos.putObject({ Bucket: sts.bucket, Region: sts.region, Key: o.file_key, Body: media.buffer },
      (err, data) => err ? rej(err) : res(data));
  });
  if (put.statusCode !== 200) throw new Error(`loreUploadFile COS failed: ${put.statusCode}`);

  // 3. save 落库
  const sv = await postJson('617lorebase/file/upload/save', {
    file_size: media.size, file_key: o.file_key, token: o.token,
    folder_guid: folderGuid, is_folder: false, file_name: fileName,
  });
  if (sv.code !== 200) throw new Error(`loreUploadFile save failed: ${sv.code} ${sv.msg}`);
  return sv.obj; // { guid, name }
}

// ── OKR ──
// ✅ OKR 已实现（真调打通 2026-07-13），见 ch7-workbench/okr/（独立域名 okr-api.zhiyinlou.com）。

// ── 企业邮箱（真调打通 2026-07-13，网易企业邮/Coremail）──
// ⭐ 企业邮箱登录使用 POST 94capi/txmail/login 的兼容 client-ver 字段，
//   拿到 entry.qiye.163.com SSO → mailh.qiye.163.com/js6（Coremail wmsvr）。
//   实现在 ./mail/{client,service,store}.js。
const mail = require('./mail/service');

// shimo 文档正文读写（HTTP/2）
const shimo = require('./shimo-client');

function extractDocGuid(value) {
  let text = String(value || '').trim();
  if (/^[A-Za-z0-9]+$/.test(text)) return text;
  for (let i = 0; i < 3; i++) {
    const match = text.match(/\/docs\/([A-Za-z0-9]+)/);
    if (match) return match[1];
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch { break; }
  }
  return '';
}

async function resolveDocGuid(value) {
  let guid = extractDocGuid(value);
  if (guid) return guid;
  const text = String(value || '').trim();
  if (/^https:\/\/s\.tal\.com\//i.test(text)) {
    const { shortLinkTransLong } = require('../ch32-shortlink');
    const result = await shortLinkTransLong(text);
    guid = extractDocGuid(result?.long || result?.longUrl || result?.url);
  }
  if (!guid) throw new Error('无法从输入中识别文档 guid；请传 guid、Shimo 文档 URL 或 s.tal.com 短链');
  return guid;
}

async function readDocMarkdown(input) {
  return shimo.readDocMarkdown(await resolveDocGuid(input));
}

module.exports = {
  // shimo 正文读写
  readDocMarkdown,
  writeDocMarkdown:     shimo.writeDocMarkdown,
  extractGuidFromNodeUrl: shimo.extractGuidFromNodeUrl,
  extractDocGuid,
  resolveDocGuid,
  getWikiFolders, searchDoc,
  getWikiFolderDetail, getWikiFiles, getSpaceList, createDocument, createWikiFile,
  // 新增
  getRecentDocs, getTorchFileList,
  renameWikiFile, deleteWikiFile,
  searchDocFull, getQuickAccessList,
  // 新增 2
  getTeamspace, searchClientFiles, removeRecentDoc,
  // 薪火知识库 617lorebase CRUD
  loreManageList, loreSpaceCreate, loreSidenodes,
  loreNodeAdd, loreNodeRename, loreNodeDrag, loreNodeDelete,
  // 薪火知识库权限管理
  loreSpaceAuthList, loreSpaceAuthAdd, loreSpaceAuthEdit, loreSpaceAuthDel,
  loreNodeCollaboratorsList, loreNodeCollaboratorsAdd, loreNodeCollaboratorsDel, loreNodeCollaboratorsEdit,
  loreNodeShareGetConf, loreNodeShareGetContentConf,
  loreNodeShareSetContentConf, loreNodeShareGetContentConfByGuid,
  createClientDocument,
  loreNodeSecurityList, loreNodeInfo,
  // 薪火知识库文件上传（sign→COS→save）
  loreUploadFile,
  // 企业邮箱
  listMailFolders: mail.listMailFolders,
  listMailMessages: mail.listMailMessages,
  readMailMessage: mail.readMailMessage,
  sendMailText: mail.sendMailText,
  recallMail: mail.recallMail,
};
