#视频解析平台需求

## 需求描述
希望通过对于上传到平台的视频基于 LLM 进行理解，并基于相关的 Skills 的返回结果进行分析，最终生成视频的分析报告。

## 平台需求
1. 多模型管理，模型供应商，并且管理之下的具体哪些模型，以及相关的 key 管理。
2. 支持对象存储管理，第一阶段先支持阿里云 OSS，OSS的 bucket 管理，以及相关的 OSS 操作需要的 key 管理等。
3. 支持视频的上传，支持断点上传到阿里云 OSS 的指定 bucket 中，并且支持视频的删除、下载、查看等操作，并且能够获取上传到阿里云的文件的 url 地址。
4. 视频解析任务管理， 支持批量选择视频，选择完视频之后基于 LLM 进行视频的解析，并基于相关的 skills 模块中选择的具体 skill 的要求进行分析，最终生成视频的分析报告。每个视频生成的报告需要存储到数据库中，每次任务结束之后需要将任务的状态更新为完成，并且将生成的报告文件存储到数据库中，并且将生成的报告文件的 url 地址存储到数据库中。每次任务完成生成的报告都需要有版本管理，每次新生成一个版本的报告，需要将旧的版本报告进行归档，并且将归档的报告文件存储到数据库中，并且将归档的报告文件的 url 地址存储到数据库中。
5. skills 管理，支持添加、删除、编辑 skills，并且支持 skills 的版本管理，每次新生成一个版本的 skills，需要将旧的版本 skills 进行归档，并且将归档的 skills 文件存储到数据库中，并且将归档的 skills 文件的 url 地址存储到数据库中。
6. 视频解析任务的技术要求和规范、短期先实现基于 GLM 4.6V 模型的视频解析以及相关的 Skills 的返回结果进行分析，最终生成视频的分析报告。
   GLM 模型的调用方式和代码如下，请理解这个 curl 的方式，并使用 Nodejs 进行代码调用。其中 url 是视频的 URL 细致，需要从阿里云 OSS 中获取，并且 url 需要是完整的 url 地址。text 中的内容是 skills 模块中选择的具体 skill 要求。 基于选择的视频列表中的视频的 url 地址进行循环调用和生成报告。
   ```
   curl -X POST \
  https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4.6v",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "video_url",
            "video_url": {
              "url": "https://cdn.bigmodel.cn/agent-demos/lark/113123.mov"
            }
          },
          {
            "type": "text",
            "text": "What are the video show about?"
          }
        ]
      }
    ],
    "thinking": {
      "type": "enabled"
    }
  }'
   ```
7. 视频列表中除了支持上传、删除、下载、查看等操作，还需要支持已经生成报告的视频的查看，并且支持最新报告和历史报告的查看。
8. 对于已经生成的某一份报告的修复，需要选择某一份报告，并且支持用户输入额外的分析和要求，一旦用户提交，后端的操作逻辑是：
   依然调用如下方法，其中 url 是视频的 URL 细致，需要从阿里云 OSS 中获取，并且 url 需要是完整的 url 地址。text 中的内容需要变成：请基于当前的报告内容 {报告内容} ，{并基于用户输入的额外分析和要求}, 并基于最新的 skills 模块中选择的具体 skill 要求进行分析，最终生成视频的分析报告。
   ```
   curl -X POST \
  https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4.6v",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "video_url",
            "video_url": {
              "url": "https://cdn.bigmodel.cn/agent-demos/lark/113123.mov"
            }
          },
          {
            "type": "text",
            "text": "What are the video show about?"
          }
        ]
      }
    ],
    "thinking": {
      "type": "enabled"
    }
  }'
   ```
9. 前端采用 Nextjs 进行构建，后端采用 Nodejs 进行构建，数据库采用 postgresql，界面风格美观度请使用 ui-ux-pro-max skills 进行构建。
10. 权限需要考虑几个角色，分别是 admin，operator，user，分别对应不同的权限，admin 拥有最高的权限，可以进行所有的操作，operator 拥有一般的权限，可以进行视频的解析、报告的生成、报告的修复等操作，user 拥有最低的权限，只能进行视频的查看、报告的查看等操作。