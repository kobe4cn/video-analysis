---
name: extract-video-url
description: 提取小红书或抖音视频笔记的真实文件URL和封面图URL。当用户需要获取视频和封面的直接链接时使用此技能（仅提取URL，不下载文件）。支持小红书和抖音两个平台。
---

# 多平台视频URL提取技能

此技能帮助用户使用kukutool.com快速提取小红书或抖音视频的真实文件URL和封面图片URL。

## 功能说明

使用kukutool.com提取视频URL和封面图URL：
- **支持平台**: 小红书、抖音
- **简单快速**: 只需3步完成
- **完整文件**: 获取完整MP4文件URL
- **包含封面**: 同时提取封面图片URL
- **仅提取URL**: 不下载文件，只返回链接

---

## 平台识别

### 自动识别平台

根据输入URL自动判断平台：

**小红书链接特征**：
- `xiaohongshu.com`
- `xhslink.com`
- 用户明确指定为小红书

**抖音链接特征**：
- `douyin.com`
- `v.douyin.com`
- `iesdouyin.com`
- 用户明确指定为抖音

---

## 提取流程

### 步骤1：打开kukutool网站

**根据识别的平台选择对应页面**：

**如果是小红书**：
```bash
工具: mcp__mcp-router__new_page
参数:
  - url: https://dy.kukutool.com/xiaohongshu
  - timeout: 30000
```

**如果是抖音**（使用主页，支持抖音及其他130+平台）：
```bash
工具: mcp__mcp-router__new_page
参数:
  - url: https://dy.kukutool.com
  - timeout: 30000
```

### 步骤2：输入视频链接

从页面快照中找到输入框并输入视频URL：

```bash
工具: mcp__mcp-router__take_snapshot
参数: {}
```

找到textbox元素的uid（如uid=5_30），然后填写链接：

```bash
工具: mcp__mcp-router__fill
参数:
  - uid: {输入框的uid}
  - value: {视频链接}
```

**小红书链接示例**：
```
value: https://www.xiaohongshu.com/explore/xxxxxxxxx
value: https://xhslink.com/xxxxxx
```

**抖音链接示例**：
```
value: https://www.douyin.com/video/xxxxxxxxx
value: https://v.douyin.com/xxxxxx
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

同时，从页面快照中提取封面图片URL（查找图片元素）。

---

## URL格式说明

### 小红书视频URL

**完整MP4文件URL示例**：
```
https://sns-video-bd.xhscdn.com/{video_id}.mp4
https://sns-video-al.xhscdn.com/{video_id}.mp4
```

**关键参数说明**：
- 通常包含签名参数和过期时间
- 文件格式：`.mp4`（完整的MP4文件，音视频已合并）
- 清晰度：通常为正常清晰度（非高清但可用）
- 如果链接的域名是sns-video-hw，需要更换成sns-video-hs域名

**封面图片URL**：
```
https://sns-img-bd.xhscdn.com/{image_id}.jpg
```

### 抖音视频URL

**完整MP4文件URL示例**：
```
https://v26-web.douyinvod.com/{path}/{video_id}.mp4
https://v3-web.douyinvod.com/{path}/{video_id}.mp4
```

**关键参数说明**：
- URL通常包含多个签名和鉴权参数
- 文件格式：`.mp4`
- 可能有多种清晰度可选
- 部分URL可能有时效性限制

**封面图片URL**：
```
https://p3-sign.douyinpic.com/{image_path}
https://p6-sign.douyinpic.com/{image_path}
```

---

## 输出格式

提取完成后，按以下格式输出结果：

```markdown
## 视频URL提取结果

### 视频信息
- **平台**: {小红书/抖音}
- **笔记/视频ID**: {ID}
- **标题**: {标题}
- **原链接**: {原链接}
- **提取方法**: kukutool.com

### 视频文件URL（正常清晰度）

```
{完整MP4 URL}
```

### 封面图片URL

```
{封面图片URL}
```

### 文件信息
- **视频格式**: MP4（已合并音视频）
- **文件大小**: {文件大小}
- **封面格式**: JPG/WEBP
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
- 从页面快照中查找图片元素
- 小红书封面通常包含 `sns-img` 和 `xhscdn.com`
- 抖音封面通常包含 `douyinpic.com`
- 封面图通常在解析结果的图片区域显示
- 可以直接从快照中提取图片的 `src` 属性

### 5. 抖音短链接无法解析？
- 确认短链接格式：`https://v.douyin.com/xxxxx`
- 部分短链接可能需要先在浏览器中展开为完整URL
- 如果短链接失败，尝试获取完整的 `douyin.com/video/xxx` 格式链接

---

## 各平台链接格式汇总

### 小红书
1. **完整链接**: `https://www.xiaohongshu.com/explore/{id}`
2. **短链接**: `https://xhslink.com/{code}`
3. **分享链接**: `https://www.xiaohongshu.com/discovery/item/{id}`

### 抖音
1. **完整链接**: `https://www.douyin.com/video/{id}`
2. **短链接**: `https://v.douyin.com/{code}`
3. **分享链接**: 从抖音App分享的链接（通常包含 `v.douyin.com`）
4. **旧版链接**: `https://www.iesdouyin.com/share/video/{id}`

所有这些格式都应该能够被kukutool.com正确解析。
