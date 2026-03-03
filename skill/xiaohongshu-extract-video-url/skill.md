---
name: xiaohongshu-extract-video-url
description: 提取小红书视频笔记的真实文件URL和封面图URL。当用户需要获取小红书视频和封面的直接链接时使用此技能（仅提取URL，不下载文件）。
---

# 小红书视频URL提取技能

此技能帮助用户使用kukutool.com快速提取小红书视频笔记的真实文件URL和封面图片URL。

## 功能说明

使用kukutool.com提取小红书视频URL和封面图URL：
- ✅ **简单快速**: 只需3步完成
- ✅ **完整文件**: 获取完整MP4文件URL
- ✅ **包含封面**: 同时提取封面图片URL
- ✅ **仅提取URL**: 不下载文件，只返回链接

---

## 提取流程

### 步骤1：打开kukutool网站

使用Chrome DevTools MCP工具打开小红书视频解析页面：

```bash
工具: mcp__mcp-router__new_page
参数:
  - url: https://dy.kukutool.com/xiaohongshu
  - timeout: 30000
```

### 步骤2：输入小红书视频链接

从页面快照中找到输入框并输入小红书视频URL：

```bash
工具: mcp__mcp-router__take_snapshot
参数: {}
```

找到textbox元素的uid（如uid=5_30），然后填写链接：

```bash
工具: mcp__mcp-router__fill
参数:
  - uid: {输入框的uid}
  - value: {小红书视频笔记链接}
```

**示例**：
```
value: https://www.xiaohongshu.com/explore/xxxxxxxxx
或
value: https://xhslink.com/xxxxxx
```

### 步骤3：点击解析并提取URL

点击"开始解析"按钮：

```bash
工具: mcp__mcp-router__click
参数:
  - uid: {按钮的uid，如uid=6_31}
```

**等待5-10秒**，然后再次获取页面快照以查看解析结果：

```bash
工具: mcp__mcp-router__take_snapshot
参数: {}
```

从快照中找到"下载 正常 (XX MB)"按钮旁边的"复制"按钮并点击：

```bash
工具: mcp__mcp-router__click
参数:
  - uid: {"复制"按钮的uid}
```

使用JavaScript读取剪贴板内容获取视频URL：

```bash
工具: mcp__mcp-router__evaluate_script
参数:
  function: async () => {
    const clipboardText = await navigator.clipboard.readText();
    return clipboardText;
  }
```

同时，从页面快照中提取封面图片URL（查找包含 `sns-img` 和 `xhscdn.com` 的图片元素）。

---

## URL格式说明

### 完整MP4文件URL示例

```
https://sns-video-bd.xhscdn.com/{video_id}.mp4
或
https://sns-video-al.xhscdn.com/{video_id}.mp4
```

**关键参数说明**：
- 通常包含签名参数和过期时间
- 文件格式：`.mp4`（完整的MP4文件，音视频已合并）
- 清晰度：通常为正常清晰度（非高清但可用）
- 如果链接的域名是sns-video-hw，需要更换成sns-video-hs域名。

### 封面图片URL

kukutool可能还会提供封面图片下载链接：

```
https://sns-img-bd.xhscdn.com/{image_id}.jpg
```

---

## 输出格式

提取完成后，按以下格式输出结果：

```markdown
## 📹 小红书视频URL提取结果

### 视频信息
- **笔记ID**: {笔记ID}
- **笔记标题**: {标题}
- **原链接**: {原链接}
- **提取方法**: kukutool.com

### 🎥 视频文件URL（正常清晰度）

```
{完整MP4 URL}
```

### 📸 封面图片URL

```
{封面图片URL}
```

### 📝 文件信息
- **视频格式**: MP4（已合并音视频）
- **文件大小**: {文件大小}
- **封面格式**: JPG
```

---

## 常见问题

### 1. 找不到"开始解析"按钮？
- 确保页面已完全加载
- 检查页面快照，查找包含"解析"、"开始"等文字的按钮

### 2. 点击后没有结果？
- 等待更长时间（10-15秒）
- 刷新页面重试
- 检查链接是否正确

### 3. 点击复制按钮后如何获取URL？
- 点击"复制"按钮后，使用 `evaluate_script` 工具执行 JavaScript 读取剪贴板
- 使用 `navigator.clipboard.readText()` API 获取复制的URL

### 4. 找不到封面图URL？
- 从页面快照中查找 `sns-img` 和 `xhscdn.com` 的图片元素
- 封面图通常在解析结果的图片区域显示
- 可以直接从快照中提取图片的 `src` 属性

---

## 小红书链接格式

小红书笔记链接可能有以下格式：
1. **完整链接**: `https://www.xiaohongshu.com/explore/{id}`
2. **短链接**: `https://xhslink.com/{code}`
3. **分享链接**: `https://www.xiaohongshu.com/discovery/item/{id}`

所有这些格式都应该能够被kukutool.com正确解析。