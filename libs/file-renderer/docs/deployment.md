# File Renderer Service 部署文档

本文档详细介绍 File Renderer Service 的各种部署方式，包括 Docker 部署、Kubernetes 部署以及生产环境配置。

## 目录

- [环境要求](#环境要求)
- [Docker 部署](#docker-部署)
- [Kubernetes 部署](#kubernetes-部署)
- [生产环境配置](#生产环境配置)
- [监控和日志](#监控和日志)
- [故障排查](#故障排查)

## 环境要求

### 最低配置

- **CPU**: 2 核
- **内存**: 4 GB
- **磁盘**: 20 GB (根据文件存储需求调整)
- **网络**: 可访问 S3 兼容存储和 PostgreSQL

### 推荐配置

- **CPU**: 4 核+
- **内存**: 8 GB+
- **磁盘**: 100 GB+ SSD
- **网络**: 内网访问数据库和存储服务

### 依赖服务

1. **PostgreSQL 14+**
   - 用于存储文件元数据、转换缓存等
   - 建议启用连接池

2. **S3 兼容对象存储**
   - 阿里云 OSS
   - MinIO
   - AWS S3
   - 其他 S3 兼容服务

3. **(可选) Redis**
   - 用于分布式缓存
   - 用于速率限制

## Docker 部署

### 单容器部署

#### 1. 构建镜像

```bash
# 在项目根目录
docker build -t file-renderer:latest .

# 使用多阶段构建（推荐）
docker build -t file-renderer:latest -f Dockerfile .
```

#### 2. 运行容器

```bash
# 基础运行
docker run -d \
  --name file-renderer \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/filerenderer \
  -e S3_ENDPOINT=oss-cn-hangzhou.aliyuncs.com \
  -e S3_ACCESS_KEY_ID=your-access-key \
  -e S3_ACCESS_KEY_SECRET=your-secret-key \
  -e S3_BUCKET=your-bucket \
  file-renderer:latest

# 使用环境变量文件
docker run -d \
  --name file-renderer \
  -p 8000:8000 \
  --env-file .env \
  file-renderer:latest
```

#### 3. 健康检查

```bash
# 检查容器状态
docker ps

# 查看日志
docker logs -f file-renderer

# 健康检查
curl http://localhost:8000/health
```

### Docker Compose 部署

#### 完整部署（含 PostgreSQL 和 MinIO）

```yaml
# docker-compose.yml
version: '3.8'

services:
  # File Renderer 服务
  file-renderer:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: file-renderer
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/filerenderer
      - S3_ENDPOINT=minio:9000
      - S3_ACCESS_KEY_ID=minioadmin
      - S3_ACCESS_KEY_SECRET=minioadmin
      - S3_BUCKET=agentfs
      - S3_REGION=us-east-1
      - S3_FORCE_PATH_STYLE=true
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=8000
      - SERVER_LOG_LEVEL=INFO
      - DEBUG=false
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
    networks:
      - file-renderer-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL 数据库
  postgres:
    image: postgres:16-alpine
    container_name: file-renderer-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=filerenderer
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - file-renderer-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MinIO 对象存储
  minio:
    image: minio/minio:latest
    container_name: file-renderer-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - file-renderer-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # MinIO 初始化（创建 bucket）
  minio-init:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 10;
      /usr/bin/mc config host add myminio http://minio:9000 minioadmin minioadmin;
      /usr/bin/mc mb myminio/agentfs || true;
      /usr/bin/mc policy set public myminio/agentfs || true;
      exit 0;
      "
    networks:
      - file-renderer-network

volumes:
  postgres_data:
  minio_data:

networks:
  file-renderer-network:
    driver: bridge
```

#### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f file-renderer

# 停止服务
docker-compose down

# 完全清理（包括数据卷）
docker-compose down -v
```

### 生产环境 Docker 配置

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  file-renderer:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: file-renderer
    restart: always
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_ACCESS_KEY_SECRET=${S3_ACCESS_KEY_SECRET}
      - S3_BUCKET=${S3_BUCKET}
      - S3_REGION=${S3_REGION}
      - S3_FORCE_PATH_STYLE=${S3_FORCE_PATH_STYLE:-false}
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=8000
      - SERVER_LOG_LEVEL=${SERVER_LOG_LEVEL:-INFO}
      - DEFAULT_PAGE_SIZE=${DEFAULT_PAGE_SIZE:-4000}
      - CONVERSION_MAX_FILE_SIZE=${CONVERSION_MAX_FILE_SIZE:-104857600}
      - CONVERSION_MAX_WORKERS=${CONVERSION_MAX_WORKERS:-4}
      - DEBUG=false
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    volumes:
      - ./logs:/app/logs
      - /etc/localtime:/etc/localtime:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
```

## Kubernetes 部署

### 命名空间

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: file-renderer
  labels:
    name: file-renderer
```

### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: file-renderer-config
  namespace: file-renderer
data:
  SERVER_HOST: "0.0.0.0"
  SERVER_PORT: "8000"
  SERVER_LOG_LEVEL: "INFO"
  DEFAULT_PAGE_SIZE: "4000"
  SEMANTIC_CHUNK_SIZE: "2000"
  CONVERSION_TIMEOUT: "300"
  CONVERSION_ENABLE_OCR: "true"
  CONVERSION_MAX_WORKERS: "4"
  CONVERSION_ENABLE_CACHE: "true"
  DEBUG: "false"
```

### Secret

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: file-renderer-secret
  namespace: file-renderer
type: Opaque
stringData:
  DATABASE_URL: "postgresql://postgres:password@postgres:5432/filerenderer"
  S3_ENDPOINT: "oss-cn-hangzhou.aliyuncs.com"
  S3_ACCESS_KEY_ID: "your-access-key"
  S3_ACCESS_KEY_SECRET: "your-secret-key"
  S3_BUCKET: "your-bucket"
  S3_REGION: "cn-hangzhou"
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: file-renderer
  namespace: file-renderer
  labels:
    app: file-renderer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: file-renderer
  template:
    metadata:
      labels:
        app: file-renderer
    spec:
      containers:
        - name: file-renderer
          image: file-renderer:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 8000
              name: http
          envFrom:
            - configMapRef:
                name: file-renderer-config
            - secretRef:
                name: file-renderer-secret
          resources:
            requests:
              memory: "2Gi"
              cpu: "1000m"
            limits:
              memory: "4Gi"
              cpu: "2000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          volumeMounts:
            - name: logs
              mountPath: /app/logs
      volumes:
        - name: logs
          emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - file-renderer
                topologyKey: kubernetes.io/hostname
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: file-renderer
  namespace: file-renderer
  labels:
    app: file-renderer
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8000
      protocol: TCP
      name: http
  selector:
    app: file-renderer
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: file-renderer
  namespace: file-renderer
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - file-renderer.yourdomain.com
      secretName: file-renderer-tls
  rules:
    - host: file-renderer.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: file-renderer
                port:
                  number: 80
```

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: file-renderer
  namespace: file-renderer
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: file-renderer
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
```

### 部署到 Kubernetes

```bash
# 应用所有配置
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# 查看部署状态
kubectl get pods -n file-renderer
kubectl get svc -n file-renderer
kubectl get ingress -n file-renderer

# 查看日志
kubectl logs -f deployment/file-renderer -n file-renderer

# 扩容
kubectl scale deployment file-renderer --replicas=5 -n file-renderer
```

## 生产环境配置

### 环境变量配置

创建生产环境配置文件 `.env.production`：

```bash
# 数据库配置
DATABASE_URL=postgresql://filerenderer:${DB_PASSWORD}@postgres.internal:5432/filerenderer

# S3/OSS配置
S3_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_ACCESS_KEY_SECRET=${S3_ACCESS_KEY_SECRET}
S3_BUCKET=agent-files-prod
S3_REGION=cn-hangzhou
S3_FORCE_PATH_STYLE=false

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
SERVER_LOG_LEVEL=WARNING

# 分页配置
DEFAULT_PAGE_SIZE=4000
SEMANTIC_CHUNK_SIZE=2000
SEMANTIC_OVERLAP=200

# 转换配置
CONVERSION_MAX_FILE_SIZE=524288000  # 500MB
CONVERSION_TIMEOUT=600
CONVERSION_ENABLE_OCR=true
CONVERSION_ENABLE_TABLE_EXTRACTION=true
CONVERSION_MAX_WORKERS=8
CONVERSION_ENABLE_CACHE=true
CONVERSION_CACHE_TTL_HOURS=720  # 30天

# 安全设置
DEBUG=false
```

### Nginx 反向代理配置

```nginx
# /etc/nginx/sites-available/file-renderer
upstream file_renderer {
    server 127.0.0.1:8000;
    # 负载均衡配置
    # server 127.0.0.1:8001;
    # server 127.0.0.1:8002;
}

server {
    listen 80;
    server_name file-renderer.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name file-renderer.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 500M;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    location / {
        proxy_pass http://file_renderer;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://file_renderer/health;
        access_log off;
    }
}
```

### Systemd 服务配置

```ini
# /etc/systemd/system/file-renderer.service
[Unit]
Description=File Renderer Service
After=network.target

[Service]
Type=simple
User=filerenderer
Group=filerenderer
WorkingDirectory=/opt/file-renderer
EnvironmentFile=/opt/file-renderer/.env
ExecStart=/opt/file-renderer/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10

# 资源限制
LimitNOFILE=65535
LimitNPROC=4096

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/file-renderer/logs

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable file-renderer
sudo systemctl start file-renderer
sudo systemctl status file-renderer
```

## 监控和日志

### 日志收集

#### Docker 日志

```bash
# 查看实时日志
docker-compose logs -f file-renderer

# 查看最近100行
docker-compose logs --tail=100 file-renderer

# 查看特定时间段的日志
docker-compose logs --since=2024-01-01 file-renderer
```

#### 日志轮转配置

```yaml
# docker-compose.logging.yml
version: '3.8'
services:
  file-renderer:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
        labels: "service,environment"
        env: "OS_VERSION"
```

### 监控指标

#### Prometheus 指标端点

服务内置以下监控指标（通过中间件）：

- `http_requests_total`: HTTP请求总数
- `http_request_duration_seconds`: HTTP请求处理时间
- `http_request_size_bytes`: HTTP请求大小
- `http_response_size_bytes`: HTTP响应大小

#### 健康检查端点

```bash
# 基础健康检查
curl http://localhost:8000/health

# 数据库连接检查
curl http://localhost:8000/health/db

# S3连接检查
curl http://localhost:8000/health/s3
```

### 告警规则

```yaml
# prometheus-alerts.yml
groups:
  - name: file-renderer
    rules:
      - alert: FileRendererDown
        expr: up{job="file-renderer"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "File Renderer service is down"
          description: "File Renderer has been down for more than 1 minute"

      - alert: FileRendererHighErrorRate
        expr: rate(http_requests_total{job="file-renderer",status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "File Renderer high error rate"
          description: "Error rate is above 10% for the last 5 minutes"

      - alert: FileRendererSlowRequests
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="file-renderer"}[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "File Renderer slow requests"
          description: "95th percentile latency is above 5 seconds"
```

## 故障排查

### 常见问题

#### 1. 数据库连接失败

```bash
# 检查数据库连接
psql $DATABASE_URL -c "SELECT 1"

# 检查网络连通性
telnet postgres_host 5432

# 检查数据库权限
psql $DATABASE_URL -c "\dt"
```

#### 2. S3 连接失败

```bash
# 测试 S3 连接
aws s3 ls s3://$S3_BUCKET --endpoint-url=https://$S3_ENDPOINT

# 检查访问密钥
aws configure list

# 检查 bucket 权限
aws s3api head-bucket --bucket $S3_BUCKET --endpoint-url=https://$S3_ENDPOINT
```

#### 3. 内存不足

```bash
# 查看内存使用
free -h

# 查看容器内存限制
docker stats file-renderer

# 调整 JVM/进程内存限制
export MAX_WORKERS=2
export CONVERSION_MAX_FILE_SIZE=52428800  # 50MB
```

#### 4. 文件转换超时

```bash
# 增加超时时间
export CONVERSION_TIMEOUT=600

# 减少并发数
export CONVERSION_MAX_WORKERS=2

# 检查转换日志
docker-compose logs file-renderer | grep -i "timeout\|error"
```

### 调试模式

```bash
# 启用调试模式
export DEBUG=true
export SERVER_LOG_LEVEL=DEBUG

# 查看详细日志
uv run python -m uvicorn main:app --reload --log-level debug
```

### 性能分析

```bash
# 使用 py-spy 进行性能分析
py-spy top --pid $(pgrep -f "uvicorn")

# 生成火焰图
py-spy record -o profile.svg --pid $(pgrep -f "uvicorn")
```

### 备份与恢复

#### 数据库备份

```bash
# 备份 PostgreSQL
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 自动备份脚本
#!/bin/bash
BACKUP_DIR=/backups
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/filerenderer_$DATE.sql.gz
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

#### 数据恢复

```bash
# 恢复 PostgreSQL
psql $DATABASE_URL < backup_20240101.sql

# 从压缩备份恢复
gunzip -c backup_20240101.sql.gz | psql $DATABASE_URL
```

## 更新与维护

### 滚动更新

```bash
# Docker Compose 滚动更新
docker-compose pull
docker-compose up -d --no-deps --build file-renderer

# Kubernetes 滚动更新
kubectl set image deployment/file-renderer file-renderer=file-renderer:v1.1.0 -n file-renderer
kubectl rollout status deployment/file-renderer -n file-renderer

# 回滚
kubectl rollout undo deployment/file-renderer -n file-renderer
```

### 数据库迁移

```bash
# 创建迁移
uv run alembic revision --autogenerate -m "description"

# 应用迁移
uv run alembic upgrade head

# 在容器中运行迁移
docker-compose exec file-renderer uv run alembic upgrade head

# Kubernetes 中运行迁移
kubectl exec -it deployment/file-renderer -n file-renderer -- uv run alembic upgrade head
```
