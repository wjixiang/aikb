# Case Hub API 文档

## 概述

本文档详细描述了 Case Hub 病历管理服务的所有 API 接口。

- **基础 URL**: `http://localhost:3002/api`
- **Swagger UI**: `http://localhost:3002/api/docs`
- **内容类型**: `application/json`

## 通用响应格式

所有 API 响应遵循统一的格式：

```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "error": null
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 操作是否成功 |
| `data` | any | 响应数据 |
| `message` | string | 提示信息 |
| `error` | string | 错误信息（失败时） |

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 500 | 服务器内部错误 |

---

## 病历管理 API

### 1. 创建病历

创建一个新的病历记录。

**请求**

```http
POST /api/cases
Content-Type: application/json
```

**请求体**

```json
{
  "caseNumber": "CASE202403170001",
  "patientName": "张三",
  "gender": "男",
  "age": 45,
  "department": "普外科",
  "disease": "急性阑尾炎",
  "status": "ACTIVE",
  "content": {
    "chiefComplaint": "腹痛3天",
    "presentIllness": "患者3天前无明显诱因出现腹痛...",
    "pastHistory": "否认高血压、糖尿病病史",
    "personalHistory": "吸烟史10年",
    "familyHistory": "否认家族遗传病史",
    "physicalExamination": {
      "general": "神志清楚，精神可",
      "vitalSigns": {
        "temperature": "37.2",
        "pulse": "80",
        "respiration": "18",
        "bloodPressure": "120/80"
      },
      "systemic": "心肺听诊无异常"
    },
    "auxiliaryExamination": "血常规：白细胞升高",
    "diagnosis": "急性阑尾炎",
    "treatmentPlan": "急诊手术治疗"
  },
  "tags": ["急症", "手术"],
  "remarks": "需要随访"
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "caseNumber": "CASE202403170001",
    "patientName": "张三",
    "gender": "男",
    "age": 45,
    "department": "普外科",
    "disease": "急性阑尾炎",
    "status": "ACTIVE",
    "content": { ... },
    "createdAt": "2024-03-17T10:00:00.000Z",
    "updatedAt": "2024-03-17T10:00:00.000Z"
  },
  "message": "病历创建成功"
}
```

**错误响应**

```json
{
  "success": false,
  "data": null,
  "message": "病历编号已存在",
  "error": "Conflict"
}
```

---

### 2. 查询病历列表

支持分页、筛选、排序的病历列表查询。

**请求**

```http
GET /api/cases?keyword=张三&department=普外科&page=1&pageSize=10
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 否 | 关键词搜索（姓名、病历号、疾病） |
| `department` | string | 否 | 科室筛选 |
| `disease` | string | 否 | 疾病筛选 |
| `gender` | string | 否 | 性别筛选（男/女/其他） |
| `minAge` | number | 否 | 最小年龄 |
| `maxAge` | number | 否 | 最大年龄 |
| `status` | string | 否 | 状态筛选（ACTIVE/ARCHIVED/DELETED） |
| `createdFrom` | string | 否 | 创建时间开始（ISO 8601） |
| `createdTo` | string | 否 | 创建时间结束（ISO 8601） |
| `page` | number | 否 | 页码，默认 1 |
| `pageSize` | number | 否 | 每页数量，默认 10，最大 100 |
| `sortBy` | string | 否 | 排序字段，默认 createdAt |
| `sortOrder` | string | 否 | 排序方向（asc/desc），默认 desc |

**响应**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "caseNumber": "CASE202403170001",
        "patientName": "张三",
        "gender": "男",
        "age": 45,
        "department": "普外科",
        "disease": "急性阑尾炎",
        "status": "ACTIVE",
        "content": { ... },
        "createdAt": "2024-03-17T10:00:00.000Z",
        "updatedAt": "2024-03-17T10:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  },
  "message": "查询成功"
}
```

---

### 3. 获取病历详情

根据 ID 获取单个病历的详细信息。

**请求**

```http
GET /api/cases/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 病历唯一标识（UUID） |

**响应**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "caseNumber": "CASE202403170001",
    "patientName": "张三",
    "gender": "男",
    "age": 45,
    "department": "普外科",
    "disease": "急性阑尾炎",
    "status": "ACTIVE",
    "content": { ... },
    "createdAt": "2024-03-17T10:00:00.000Z",
    "updatedAt": "2024-03-17T10:00:00.000Z"
  },
  "message": "查询成功"
}
```

---

### 4. 更新病历

根据 ID 更新病历信息。

**请求**

```http
PATCH /api/cases/{id}
Content-Type: application/json
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 病历唯一标识（UUID） |

**请求体**

```json
{
  "patientName": "李四",
  "age": 50,
  "remarks": "更新备注"
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "caseNumber": "CASE202403170001",
    "patientName": "李四",
    "age": 50,
    "remarks": "更新备注",
    "updatedAt": "2024-03-17T11:00:00.000Z"
  },
  "message": "更新成功"
}
```

---

### 5. 删除病历

根据 ID 删除病历（软删除）。

**请求**

```http
DELETE /api/cases/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 病历唯一标识（UUID） |

**响应**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "message": "病历删除成功"
}
```

---

### 6. 获取科室列表

获取所有可用的科室列表及每个科室的病例数量。

**请求**

```http
GET /api/cases/departments/list
```

**响应**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "code": "general-surgery",
        "name": "普外科",
        "description": "普通外科，主要负责腹部外科手术",
        "caseCount": 25
      },
      {
        "code": "orthopedics",
        "name": "骨科",
        "description": "骨骼肌肉系统疾病诊治",
        "caseCount": 18
      }
    ],
    "total": 12
  },
  "message": "查询成功"
}
```

---

### 7. 获取疾病列表

获取所有可用的疾病列表及每个疾病的病例数量，可按科室筛选。

**请求**

```http
GET /api/cases/diseases/list?department=普外科
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `department` | string | 否 | 科室代码，用于筛选特定科室的疾病 |

**响应**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "code": "appendicitis",
        "name": "急性阑尾炎",
        "department": "普外科",
        "description": "阑尾的急性炎症",
        "caseCount": 10
      },
      {
        "code": "cholecystitis",
        "name": "急性胆囊炎",
        "department": "普外科",
        "description": "胆囊的急性炎症",
        "caseCount": 8
      }
    ],
    "total": 5
  },
  "message": "查询成功"
}
```

---

## 病历生成 API

### 1. 生成单个病历

根据指定参数生成一份病历。

**请求**

```http
POST /api/generator/case
Content-Type: application/json
```

**请求体**

```json
{
  "department": "普外科",
  "disease": "急性阑尾炎",
  "patientName": "张三",
  "ageRange": {
    "min": 30,
    "max": 50
  },
  "gender": "男",
  "caseType": "A型",
  "anonymize": false
}
```

**请求字段说明**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `department` | string | 否 | 科室类型，如：呼吸内科、普外科等 |
| `disease` | string | 否 | 疾病类型，如：肺炎、急性阑尾炎等 |
| `patientName` | string | 否 | 患者姓名，不传则随机生成 |
| `ageRange` | object | 否 | 年龄范围 `{ min: number, max: number }` |
| `gender` | string | 否 | 性别（男/女） |
| `caseType` | string | 否 | 病例分型：A型/B型/C型/D型 |
| `anonymize` | boolean | 否 | 是否生成脱敏版本，默认 false |

**响应**

```json
{
  "success": true,
  "data": {
    "content": "主诉：腹痛3天...",
    "metadata": {
      "department": "普外科",
      "disease": "急性阑尾炎",
      "caseType": "A型",
      "generatedAt": "2024-03-17T10:00:00.000Z"
    }
  },
  "message": "生成成功"
}
```

---

### 2. 批量生成病历

异步批量生成多份病历，返回任务 ID 用于查询进度。

**请求**

```http
POST /api/generator/batch
Content-Type: application/json
```

**请求体**

```json
{
  "count": 10,
  "options": {
    "department": "普外科",
    "caseType": "A型"
  }
}
```

**请求字段说明**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `count` | number | 是 | 生成数量，范围 1-100 |
| `options` | object | 否 | 生成选项，同单个生成参数 |

**响应**

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job-uuid-123",
      "type": "batch",
      "status": "running",
      "total": 10,
      "completed": 0,
      "failed": 0,
      "results": [],
      "errors": [],
      "createdAt": "2024-03-17T10:00:00.000Z"
    }
  },
  "message": "批量生成任务已启动"
}
```

---

### 3. 生成长病历

生成约 3000 字的详细长病历，分段生成后合并。

**请求**

```http
POST /api/generator/long-case
Content-Type: application/json
```

**请求体**

```json
{
  "department": "心内科",
  "disease": "冠心病",
  "patientName": "李四",
  "ageRange": {
    "min": 60,
    "max": 70
  },
  "gender": "男",
  "caseType": "B型"
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "content": "主诉：胸闷、胸痛反复发作1个月...（约3000字详细病历）",
    "metadata": {
      "department": "心内科",
      "disease": "冠心病",
      "caseType": "B型",
      "generatedAt": "2024-03-17T10:00:00.000Z"
    }
  },
  "message": "长病历生成成功"
}
```

---

### 4. 查询生成任务状态

根据任务 ID 查询批量生成任务的进度和结果。

**请求**

```http
GET /api/generator/jobs/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID |

**响应**

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job-uuid-123",
      "type": "batch",
      "status": "completed",
      "total": 10,
      "completed": 8,
      "failed": 2,
      "results": [
        {
          "content": "...",
          "metadata": { ... }
        }
      ],
      "errors": [
        "Case 3: API timeout"
      ],
      "createdAt": "2024-03-17T10:00:00.000Z",
      "completedAt": "2024-03-17T10:05:00.000Z"
    }
  },
  "message": "查询成功"
}
```

**任务状态说明**

| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `running` | 执行中 |
| `completed` | 已完成 |
| `failed` | 失败 |
| `cancelled` | 已取消 |

---

### 5. 获取所有生成任务

获取所有生成任务的列表。

**请求**

```http
GET /api/generator/jobs
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "job-uuid-123",
      "type": "batch",
      "status": "completed",
      "total": 10,
      "completed": 10,
      "failed": 0,
      "createdAt": "2024-03-17T10:00:00.000Z",
      "completedAt": "2024-03-17T10:05:00.000Z"
    },
    {
      "id": "job-uuid-456",
      "type": "single",
      "status": "running",
      "total": 1,
      "completed": 0,
      "failed": 0,
      "createdAt": "2024-03-17T10:06:00.000Z"
    }
  ],
  "message": "查询成功"
}
```

---

### 6. 获取可用模板列表

获取所有支持的科室和疾病模板列表。

**请求**

```http
GET /api/generator/templates
```

**响应**

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "department": "普外科",
        "diseases": ["急性阑尾炎", "胆囊结石伴急性胆囊炎", "腹股沟疝", "甲状腺腺瘤", "乳腺纤维腺瘤"]
      },
      {
        "department": "骨科",
        "diseases": ["骨折", "腰椎间盘突出"]
      },
      {
        "department": "泌尿外科",
        "diseases": ["肾结石", "前列腺增生", "膀胱肿瘤", "精索静脉曲张", "包皮过长/包茎"]
      }
    ],
    "totalDepartments": 11,
    "totalDiseases": 32
  },
  "message": "查询成功"
}
```

---

## 健康检查 API

### 健康检查

检查服务运行状态。

**请求**

```http
GET /api/health
```

**响应**

```json
{
  "status": "ok",
  "info": {},
  "error": {},
  "details": {}
}
```

---

## 数据模型

### 病历 (Case)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识（UUID） |
| `caseNumber` | string | 病历编号 |
| `patientName` | string | 患者姓名 |
| `gender` | string | 性别（男/女/其他） |
| `age` | number | 年龄 |
| `department` | string | 科室 |
| `disease` | string | 疾病名称 |
| `content` | object | 病历内容（结构化） |
| `status` | string | 状态（ACTIVE/ARCHIVED/DELETED） |
| `tags` | string[] | 标签 |
| `remarks` | string | 备注 |
| `createdAt` | string | 创建时间（ISO 8601） |
| `updatedAt` | string | 更新时间（ISO 8601） |
| `createdBy` | string | 创建者 ID |
| `updatedBy` | string | 更新者 ID |

### 病历内容 (ClinicalCaseComplete)

| 字段 | 类型 | 说明 |
|------|------|------|
| `chiefComplaint` | string | 主诉 |
| `presentIllness` | string | 现病史 |
| `pastHistory` | string | 既往史 |
| `personalHistory` | string | 个人史 |
| `familyHistory` | string | 家族史 |
| `physicalExamination` | object | 体格检查 |
| `auxiliaryExamination` | string | 辅助检查 |
| `diagnosis` | string | 诊断 |
| `treatmentPlan` | string | 治疗方案 |

---

## 错误处理

### 错误响应格式

```json
{
  "success": false,
  "data": null,
  "message": "错误描述",
  "error": "错误代码"
}
```

### 常见错误

| 错误代码 | HTTP 状态码 | 说明 |
|----------|-------------|------|
| `Bad Request` | 400 | 请求参数错误 |
| `Not Found` | 404 | 资源不存在 |
| `Conflict` | 409 | 资源冲突（如病历编号已存在） |
| `Internal Server Error` | 500 | 服务器内部错误 |

---

## 使用示例

### 使用 curl

```bash
# 创建病历
curl -X POST http://localhost:3002/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "caseNumber": "CASE202403170001",
    "patientName": "张三",
    "gender": "男",
    "age": 45,
    "department": "普外科",
    "disease": "急性阑尾炎",
    "content": { "chiefComplaint": "腹痛3天" }
  }'

# 查询病历列表
curl "http://localhost:3002/api/cases?department=普外科&page=1&pageSize=10"

# 生成病历
curl -X POST http://localhost:3002/api/generator/case \
  -H "Content-Type: application/json" \
  -d '{
    "department": "普外科",
    "disease": "急性阑尾炎"
  }'
```

### 使用 JavaScript/TypeScript

```typescript
// 创建病历
const response = await fetch('http://localhost:3002/api/cases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caseNumber: 'CASE202403170001',
    patientName: '张三',
    gender: '男',
    age: 45,
    department: '普外科',
    disease: '急性阑尾炎',
    content: { chiefComplaint: '腹痛3天' }
  })
});
const result = await response.json();

// 查询病历列表
const queryParams = new URLSearchParams({
  department: '普外科',
  page: '1',
  pageSize: '10'
});
const listResponse = await fetch(`http://localhost:3002/api/cases?${queryParams}`);
const listResult = await listResponse.json();
```
