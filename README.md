# 视频分析平台

基于 AI 大模型的视频内容分析平台，支持批量上传视频至阿里云 OSS，通过 GLM 多模态模型自动分析视频内容，生成结构化的分析报告。

## 技术栈

| 层级 | 技术 |
|------|------|
| **Monorepo** | pnpm Workspace + Turborepo |
| **后端** | NestJS 11 · TypeScript · Prisma 6 |
| **前端** | Next.js 16 · React 19 · Tailwind CSS 4 · shadcn/ui |
| **数据库** | PostgreSQL 16 |
| **队列** | Bull + Redis 7 |
| **存储** | 阿里云 OSS (ali-oss SDK) |
| **AI** | 智谱 GLM 系列多模态模型 |
| **实时通信** | Socket.io (WebSocket) |
| **认证** | JWT 双令牌 (Access + Refresh) |

## 项目结构

```
xiaohongshuvideo/
├── apps/
│   ├── server/              # NestJS 后端
│   │   └── src/modules/
│   │       ├── auth/        # 认证 & 授权（JWT、角色守卫）
│   │       ├── user/        # 用户管理
│   │       ├── video/       # 视频上传 & 管理
│   │       ├── storage/     # 阿里云 OSS 配置 & Bucket 管理
│   │       ├── model/       # AI 模型 & Provider 管理
│   │       ├── skill/       # 分析 Prompt 模板（版本管理）
│   │       ├── task/        # 解析任务调度（Bull 队列）
│   │       ├── llm/         # GLM API 调用
│   │       ├── report/      # 分析报告（版本管理）
│   │       ├── notification/# WebSocket 实时通知
│   │       └── dashboard/   # 仪表盘统计
│   └── web/                 # Next.js 前端
│       └── src/
│           ├── app/         # App Router 页面
│           ├── components/  # UI 组件（shadcn/ui）
│           ├── lib/         # API 客户端、工具函数
│           └── stores/      # Zustand 状态管理
├── packages/
│   └── shared/              # 共享类型 & 常量
├── prisma/                  # Schema、迁移、Seed
├── docker-compose.yml       # PostgreSQL + Redis
└── turbo.json               # Turborepo 配置
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9
- Docker / Podman（用于 PostgreSQL 和 Redis）

### 1. 克隆并安装依赖

```bash
git clone <repo-url>
cd video-analysis
pnpm install
```

### 2. 启动基础设施

```bash
docker compose up -d
```

这将启动 PostgreSQL（端口 5432）和 Redis（端口 6379）。

### 3. 配置环境变量

```bash
cp .env.example .env
```

根据实际情况修改 `.env`：

```env
# 数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/video_analysis?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT（生产环境务必更换为随机字符串）
JWT_SECRET=your-jwt-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

### 4. 初始化数据库

```bash
pnpm db:generate    # 生成 Prisma Client
pnpm db:push        # 同步 Schema 到数据库
pnpm db:seed        # 创建默认管理员账户
```

Seed 会创建默认管理员：
- 邮箱：`admin@example.com`
- 密码：`admin123`

### 5. 启动开发服务

```bash
pnpm dev
```

- 后端：http://localhost:3001（API 前缀 `/api`）
- 前端：http://localhost:3000

## 核心功能

### 视频管理

- 支持多视频同时上传，通过后端中转写入阿里云 OSS
- 选择目标 Bucket，支持中文文件名
- 视频列表搜索、分页

### 解析任务

- 选择视频 + Skill + AI 模型，创建批量分析任务
- Bull 队列异步处理，逐视频分析，单个失败不阻塞其他
- WebSocket 实时推送任务进度
- 任务状态：PENDING → PROCESSING → COMPLETED / PARTIAL / FAILED

### AI 分析

- 通过 GLM 多模态模型理解视频内容
- Skill 模块管理分析 Prompt 模板，支持版本管理
- 分析结果生成 Markdown 格式的结构化报告

### 报告

- 报告支持版本管理，可查看历史版本对比
- Markdown 渲染展示，支持表格、引用、分区标题
- 支持提交修复要求重新分析

### 存储管理（Admin）

- 管理阿里云 OSS 配置（AK/SK、Region）
- 创建 / 关联 / 删除 Bucket，真实操作阿里云
- 支持查看阿里云远程 Bucket 并一键关联

### 模型管理（Admin）

- 管理 AI 模型 Provider（API 地址、密钥）
- 管理具体模型（名称、启用状态）

### 用户管理（Admin）

- 创建用户并分配角色
- 角色变更、账户启用/禁用、删除

## 角色权限

| 功能 | ADMIN | OPERATOR | USER |
|------|:-----:|:--------:|:----:|
| 仪表盘（全部指标） | ✅ | ✅ | - |
| 仪表盘（基础指标） | ✅ | ✅ | ✅ |
| 视频上传 & 管理 | ✅ | ✅ | ✅ |
| 创建解析任务 | ✅ | ✅ | - |
| Skills 管理 | ✅ | ✅ | - |
| 查看报告 | ✅ | ✅ | ✅ |
| 修复报告 | ✅ | ✅ | - |
| 模型管理 | ✅ | - | - |
| 存储管理 | ✅ | - | - |
| 用户管理 | ✅ | - | - |

## 常用脚本

```bash
# 开发
pnpm dev                      # 启动前后端开发服务
pnpm build                    # 构建所有应用

# 仅操作单个应用
pnpm --filter server dev      # 仅启动后端
pnpm --filter web dev         # 仅启动前端
pnpm --filter server build    # 仅构建后端
pnpm --filter web build       # 仅构建前端

# 数据库
pnpm db:generate              # 生成 Prisma Client
pnpm db:migrate               # 运行数据库迁移
pnpm db:push                  # 同步 Schema（开发用）
pnpm db:seed                  # 填充初始数据
```

## 任务处理流程

```
用户创建任务
    │
    ▼
┌─────────────────────────────┐
│  Prisma 事务                │
│  ① 创建 Task 记录           │
│  ② 创建 TaskVideo 关联记录  │
└─────────────────────────────┘
    │
    ▼
Bull Queue 入队 ──────────────── 控制器立即返回
    │
    ▼
TaskProcessor 消费
    │
    ├──▶ 视频 1 ──▶ LLM 分析 ──▶ 生成 Report ──▶ WebSocket 通知
    ├──▶ 视频 2 ──▶ LLM 分析 ──▶ 生成 Report ──▶ WebSocket 通知
    └──▶ 视频 N ──▶ ...
    │
    ▼
更新 Task 最终状态（COMPLETED / PARTIAL / FAILED）
```

## 数据模型

```
User ──────────┬──▶ Video ◀── OssBucket ◀── OssConfig
               │      │
               │      ├──▶ Report ──▶ ReportVersion
               │      │
               ├──▶ Task ──▶ TaskVideo ──┘
               │      │
               │      ├──▶ Model ◀── ModelProvider
               │      │
               └──▶ Skill ──▶ SkillVersion
```

## 部署指南

### 方式一：Docker Compose（本地 / 单机）

适用于本地开发验证或单台服务器快速部署。

```bash
# 1. 构建所有镜像
docker compose build

# 2. 初始化数据库（仅首次部署需要）
docker compose --profile init run db-migrate

# 3. 启动全部服务
docker compose up -d
```

启动后访问 http://localhost:3000，使用默认管理员 `admin@example.com / admin123` 登录。

服务列表：

| 服务 | 端口 | 说明 |
|------|------|------|
| web | 3000 | Next.js 前端 |
| server | 3001 | NestJS 后端 API |
| postgres | 5432 | PostgreSQL 数据库 |
| redis | 6379 | Redis 队列 |

常用命令：

```bash
docker compose logs -f server    # 查看后端日志
docker compose logs -f web       # 查看前端日志
docker compose down              # 停止所有服务
docker compose up -d --build     # 重新构建并启动
```

---

### 方式二：阿里云 ACK (Kubernetes)

#### 1. 前置条件

在阿里云控制台准备以下资源：

| 资源 | 说明 |
|------|------|
| **ACK 集群** | Kubernetes 托管版集群，建议 1.26+，需安装 Nginx Ingress Controller |
| **ACR 镜像仓库** | 容器镜像服务，创建命名空间（如 `video-analysis`） |
| **RDS PostgreSQL** | 托管数据库实例，创建数据库 `video_analysis` |
| **Redis 实例** | 云数据库 Redis 版（或集群内自建） |
| **域名** | 已解析到 ACK Ingress SLB 的域名 |

#### 2. 构建并推送镜像

```bash
# 登录阿里云 ACR
docker login registry.cn-shanghai.aliyuncs.com

# 构建后端镜像
docker build -f apps/server/Dockerfile \
  -t registry.cn-shanghai.aliyuncs.com/<your-namespace>/video-analysis-server:v1.0.0 \
  .

# 构建前端镜像（注意：NEXT_PUBLIC_API_URL 必须在构建时注入）
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://your-domain.com/api \
  -t registry.cn-shanghai.aliyuncs.com/<your-namespace>/video-analysis-web:v1.0.0 \
  .

# 推送镜像
docker push registry.cn-shanghai.aliyuncs.com/<your-namespace>/video-analysis-server:v1.0.0
docker push registry.cn-shanghai.aliyuncs.com/<your-namespace>/video-analysis-web:v1.0.0
```

#### 3. 配置 K8s 资源

所有 K8s 清单位于 `deploy/k8s/` 目录。部署前需修改以下配置：

**`secret.yaml`** — 填入 base64 编码的敏感信息：

```bash
# 生成 base64 值
echo -n 'postgresql://user:pass@rm-xxx.pg.rds.aliyuncs.com:5432/video_analysis?schema=public' | base64
echo -n 'your-jwt-secret-random-string' | base64
echo -n 'your-jwt-refresh-secret-random-string' | base64
```

将输出替换到 `secret.yaml` 中对应的 `REPLACE_WITH_BASE64_ENCODED_VALUE`。

**`configmap.yaml`** — 修改以下字段：

```yaml
REDIS_HOST: "r-xxx.redis.rds.aliyuncs.com"   # 阿里云 Redis 实例地址
REDIS_PORT: "6379"
CORS_ORIGIN: "https://your-domain.com"        # 你的域名
```

**`server-deployment.yaml` / `web-deployment.yaml`** — 将 `IMAGE_PLACEHOLDER` 替换为实际镜像地址：

```yaml
image: registry.cn-shanghai.aliyuncs.com/<your-namespace>/video-analysis-server:v1.0.0
```

**`ingress.yaml`** — 替换域名：

```yaml
- host: your-domain.com    # 替换为你的实际域名
```

如需启用 HTTPS，取消 `tls` 段的注释并配置证书 Secret。

#### 4. 按序部署

```bash
# 创建命名空间
kubectl apply -f deploy/k8s/namespace.yaml

# 创建配置（Secret 必须在 Deployment 之前）
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/configmap.yaml

# 初始化数据库（首次部署需要，会自动创建表结构和管理员账户）
kubectl apply -f deploy/k8s/db-migrate-job.yaml

# 等待数据库初始化完成
kubectl wait --for=condition=complete job/db-migrate -n video-analysis --timeout=120s

# 部署应用
kubectl apply -f deploy/k8s/server-deployment.yaml
kubectl apply -f deploy/k8s/web-deployment.yaml

# 配置 Ingress 路由
kubectl apply -f deploy/k8s/ingress.yaml
```

#### 5. 验证部署

```bash
# 查看 Pod 状态
kubectl get pods -n video-analysis

# 查看服务状态
kubectl get svc -n video-analysis

# 查看 Ingress
kubectl get ingress -n video-analysis

# 检查后端健康状态
kubectl exec -it deployment/server -n video-analysis -- wget -qO- http://localhost:3001/healthz

# 查看后端日志
kubectl logs -f deployment/server -n video-analysis

# 查看前端日志
kubectl logs -f deployment/web -n video-analysis
```

#### 6. 后续更新

Schema 变更时重新执行数据库迁移：

```bash
# 删除旧 Job（K8s Job 不可重复创建同名）
kubectl delete job db-migrate -n video-analysis --ignore-not-found
kubectl apply -f deploy/k8s/db-migrate-job.yaml
```

更新应用镜像：

```bash
# 方式 1：直接更新镜像 tag
kubectl set image deployment/server server=<new-image>:<tag> -n video-analysis
kubectl set image deployment/web web=<new-image>:<tag> -n video-analysis

# 方式 2：修改 yaml 后重新 apply
kubectl apply -f deploy/k8s/server-deployment.yaml
kubectl apply -f deploy/k8s/web-deployment.yaml

# 查看滚动更新状态
kubectl rollout status deployment/server -n video-analysis
kubectl rollout status deployment/web -n video-analysis

# 回滚到上一版本（如果出问题）
kubectl rollout undo deployment/server -n video-analysis
```

---

### CI/CD (GitHub Actions)

推送到 `main` 分支时自动触发流水线：构建镜像 → 推送 ACR → 滚动更新 ACK Deployment。

配置文件：`.github/workflows/deploy.yaml`

#### 配置 GitHub Secrets

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret | 说明 | 示例 |
|--------|------|------|
| `ACR_REGISTRY` | ACR 仓库地址 | `registry.cn-shanghai.aliyuncs.com/your-ns` |
| `ACR_USERNAME` | ACR 登录用户名 | `your-acr-username` |
| `ACR_PASSWORD` | ACR 登录密码 | `your-acr-password` |
| `KUBE_CONFIG` | ACK kubeconfig（base64 编码） | `cat ~/.kube/config \| base64` |
| `NEXT_PUBLIC_API_URL` | 生产环境 API 地址 | `https://your-domain.com/api` |

#### 获取 kubeconfig

```bash
# 从阿里云 ACK 控制台下载 kubeconfig，或使用 CLI
aliyun cs GET /k8s/<cluster-id>/user_config | jq -r '.config' > kubeconfig.yaml

# 编码为 base64 后粘贴到 GitHub Secret
cat kubeconfig.yaml | base64
```

#### 流水线说明

```
push to main
    │
    ▼
┌─────────────────────────────────┐
│  build-and-push                 │
│  ① docker build server image    │
│  ② docker build web image       │
│  ③ docker push to ACR           │
│     (tag: git commit SHA)       │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  deploy                         │
│  ① kubectl set image server     │
│  ② kubectl set image web        │
│  ③ kubectl rollout status       │
└─────────────────────────────────┘
```

---

### 环境变量参考

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `DATABASE_URL` | 是 | - | PostgreSQL 连接字符串 |
| `REDIS_HOST` | 否 | `localhost` | Redis 地址 |
| `REDIS_PORT` | 否 | `6379` | Redis 端口 |
| `JWT_SECRET` | 是 | - | JWT 签名密钥（生产必须替换） |
| `JWT_REFRESH_SECRET` | 是 | - | Refresh Token 签名密钥 |
| `JWT_EXPIRATION` | 否 | `15m` | Access Token 有效期 |
| `JWT_REFRESH_EXPIRATION` | 否 | `7d` | Refresh Token 有效期 |
| `CORS_ORIGIN` | 否 | `http://localhost:3000` | 允许的 CORS 来源 |
| `PORT` | 否 | `3001` | 后端监听端口 |
| `NEXT_PUBLIC_API_URL` | 否 | `http://localhost:3001/api` | 前端 API 地址（构建时注入） |
