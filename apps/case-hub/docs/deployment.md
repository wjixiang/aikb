# Case Hub 部署指南

本文档描述了 Case Hub 病历管理服务的部署方法，包括 Docker 部署和传统部署方式。

## 目录

- [环境要求](#环境要求)
- [Docker 部署](#docker-部署)
- [传统部署](#传统部署)
- [环境配置](#环境配置)
- [数据库设置](#数据库设置)
- [健康检查](#健康检查)
- [监控与日志](#监控与日志)
- [故障排查](#故障排查)

---

## 环境要求

### 最低配置

| 资源 | 要求 |
|------|------|
| CPU | 2 核 |
| 内存 | 4 GB |
| 磁盘 | 20 GB |
| 网络 | 可访问 PostgreSQL 和外部 API |

### 推荐配置

| 资源 | 要求 |
|------|------|
| CPU | 4 核 |
| 内存 | 8 GB |
| 磁盘 | 50 GB SSD |
| 网络 | 100 Mbps |

### 依赖服务

- **PostgreSQL**: 14+
- **Node.js**: 20+ (传统部署)
- **Docker**: 20.10+ (Docker 部署)
- **Docker Compose**: 2.0+ (Docker 部署)

---

## Docker 部署

### 1. 准备环境

创建部署目录：

```bash
mkdir -p /opt/case-hub
cd /opt/case-hub
```

### 2. 创建 Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine

# 安装 pnpm
RUN npm install -g pnpm@10.7.0

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 生成 Prisma 客户端
RUN pnpm prisma:generate

# 构建应用
RUN pnpm build

# 暴露端口
EXPOSE 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/api/health || exit 1

# 启动命令
CMD ["pnpm", "start:prod"]
```

### 3. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    container_name: case-hub-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: casehub
      POSTGRES_PASSWORD: your_secure_password
      POSTGRES_DB: case_hub
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U casehub -d case_hub"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Case Hub 应用
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: case-hub-app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3002
      DATABASE_URL: postgresql://casehub:your_secure_password@postgres:5432/case_hub?schema=public
      MINIMAX_API_KEY: ${MINIMAX_API_KEY}
      MINIMAX_MODEL_ID: ${MINIMAX_MODEL_ID:-MiniMax-M2.5}
      STORAGE_TYPE: local
      STORAGE_PATH: /app/storage
      LOG_LEVEL: info
    ports:
      - "3002:3002"
    volumes:
      - app_storage:/app/storage
      - app_logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx 反向代理（可选）
  nginx:
    image: nginx:alpine
    container_name: case-hub-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app

volumes:
  postgres_data:
  app_storage:
  app_logs:
```

### 4. 创建 .env 文件

```bash
# .env
NODE_ENV=production
PORT=3002

# 数据库
DATABASE_URL=postgresql://casehub:your_secure_password@localhost:5432/case_hub?schema=public

# AI 生成配置
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_MODEL_ID=MiniMax-M2.5

# 存储配置
STORAGE_TYPE=local
STORAGE_PATH=./storage

# 日志
LOG_LEVEL=info
```

### 5. 创建 nginx.conf（可选）

```nginx
events {
    worker_connections 1024;
}

http {
    upstream case_hub {
        server app:3002;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # 重定向到 HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL 证书
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # SSL 配置
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # 代理配置
        location / {
            proxy_pass http://case_hub;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # 静态文件缓存
        location /api/docs {
            proxy_pass http://case_hub;
            expires 1h;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### 6. 启动服务

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f app

# 数据库迁移
docker-compose exec app pnpm prisma:migrate

# 填充种子数据
docker-compose exec app pnpm db:seed
```

### 7. 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose up -d --build

# 执行数据库迁移
docker-compose exec app pnpm prisma:migrate
```

---

## 传统部署

### 1. 准备服务器

```bash
# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
npm install -g pnpm@10.7.0

# 安装 PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
```

### 2. 配置 PostgreSQL

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 创建数据库和用户
CREATE DATABASE case_hub;
CREATE USER casehub WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE case_hub TO casehub;

# 退出
\q
```

### 3. 部署应用

```bash
# 创建应用目录
mkdir -p /opt/case-hub
cd /opt/case-hub

# 克隆代码（或使用 SCP/FTP 上传）
git clone your-repo-url .

# 安装依赖
pnpm install --frozen-lockfile

# 生成 Prisma 客户端
pnpm prisma:generate

# 推送数据库架构
pnpm prisma:push

# 构建应用
pnpm build

# 填充种子数据（可选）
pnpm db:seed
```

### 4. 配置环境变量

```bash
# 创建 .env 文件
cat > /opt/case-hub/.env << 'EOF'
NODE_ENV=production
PORT=3002
HOST=0.0.0.0

# 数据库
DATABASE_URL=postgresql://casehub:your_secure_password@localhost:5432/case_hub?schema=public
DATABASE_POOL_SIZE=10

# AI 生成配置
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_MODEL_ID=MiniMax-M2.5

# 存储配置
STORAGE_TYPE=local
STORAGE_PATH=/opt/case-hub/storage

# 日志
LOG_LEVEL=info
LOG_FORMAT=json

# 限流
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=https://your-domain.com
EOF
```

### 5. 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置文件
cat > /opt/case-hub/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'case-hub',
    script: './dist/main.js',
    cwd: '/opt/case-hub',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: '/var/log/case-hub/err.log',
    out_file: '/var/log/case-hub/out.log',
    log_file: '/var/log/case-hub/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 3000,
    max_restarts: 5,
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'storage'],
    merge_logs: true,
    log_type: 'json',
    kill_timeout: 5000,
    listen_timeout: 10000,
    health_check_grace_period: 30000
  }]
};
EOF

# 创建日志目录
sudo mkdir -p /var/log/case-hub
sudo chown -R $USER:$USER /var/log/case-hub

# 启动应用
pm2 start ecosystem.config.cjs

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup systemd
```

### 6. 配置 Nginx 反向代理

```bash
# 安装 Nginx
sudo apt-get install -y nginx

# 创建配置文件
sudo tee /etc/nginx/sites-available/case-hub << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # 日志
    access_log /var/log/nginx/case-hub-access.log;
    error_log /var/log/nginx/case-hub-error.log;

    # 代理配置
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Swagger 文档缓存
    location /api/docs {
        proxy_pass http://127.0.0.1:3002;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # 健康检查
    location /api/health {
        proxy_pass http://127.0.0.1:3002;
        access_log off;
    }
}
EOF

# 启用配置
sudo ln -s /etc/nginx/sites-available/case-hub /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 7. 配置 SSL 证书（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo systemctl enable certbot.timer
```

---

## 环境配置

### 必需环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 服务端口 | `3002` |
| `DATABASE_URL` | 数据库连接字符串 | `postgresql://...` |
| `MINIMAX_API_KEY` | Minimax API 密钥 | `your-api-key` |

### 可选环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `HOST` | 服务主机 | `0.0.0.0` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `LOG_FORMAT` | 日志格式 | `json` |
| `STORAGE_TYPE` | 存储类型 | `local` |
| `STORAGE_PATH` | 存储路径 | `./storage` |
| `RATE_LIMIT_ENABLED` | 启用限流 | `true` |
| `RATE_LIMIT_MAX` | 最大请求数 | `100` |
| `CACHE_ENABLED` | 启用缓存 | `true` |
| `CACHE_TTL` | 缓存时间 | `300` |

---

## 数据库设置

### 初始化数据库

```bash
# Docker 部署
docker-compose exec app pnpm prisma:migrate

# 传统部署
pnpm prisma:migrate
```

### 备份策略

```bash
# 创建备份脚本
cat > /opt/backup/backup-case-hub.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backup/case-hub"
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec case-hub-db pg_dump -U casehub case_hub > $BACKUP_DIR/db_$DATE.sql

# 备份存储文件
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz /opt/case-hub/storage

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup/backup-case-hub.sh

# 添加定时任务（每天凌晨 2 点备份）
echo "0 2 * * * /opt/backup/backup-case-hub.sh" | sudo crontab -
```

---

## 健康检查

### 健康检查端点

```bash
# 应用健康检查
curl http://localhost:3002/api/health

# 预期响应
{
  "status": "ok",
  "info": {},
  "error": {},
  "details": {}
}
```

### Docker 健康检查

```bash
# 查看容器健康状态
docker-compose ps

# 查看健康检查日志
docker inspect --format='{{.State.Health}}' case-hub-app
```

---

## 监控与日志

### 查看日志

```bash
# Docker 部署
docker-compose logs -f app

# 传统部署（PM2）
pm2 logs case-hub

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/case-hub-access.log
sudo tail -f /var/log/nginx/case-hub-error.log
```

### 监控指标

```bash
# PM2 监控
pm2 monit

# 查看 PM2 状态
pm2 status

# PM2 详细信息
pm2 show case-hub
```

---

## 故障排查

### 常见问题

#### 1. 应用无法启动

```bash
# 检查日志
pm2 logs case-hub

# 检查端口占用
sudo lsof -i :3002

# 检查环境变量
cat /opt/case-hub/.env
```

#### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 检查数据库连接
psql postgresql://casehub:password@localhost:5432/case_hub

# 检查防火墙
sudo ufw status
```

#### 3. 内存不足

```bash
# 查看内存使用
free -h

# 查看 PM2 内存使用
pm2 status

# 重启应用释放内存
pm2 restart case-hub
```

#### 4. 磁盘空间不足

```bash
# 查看磁盘使用
df -h

# 清理日志
pm2 flush

# 清理旧备份
find /opt/backup -name "*.tar.gz" -mtime +30 -delete
```

### 紧急恢复

```bash
# 重启所有服务
pm2 restart all
sudo systemctl restart nginx

# 重启 Docker 容器
docker-compose restart

# 回滚到上一个版本
git log --oneline -5
git reset --hard HEAD~1
pnpm install && pnpm build
pm2 restart case-hub
```

---

## 安全建议

1. **使用 HTTPS**: 生产环境必须启用 SSL
2. **强密码**: 数据库和 API 密钥使用强密码
3. **防火墙**: 只开放必要的端口（80, 443, 22）
4. **定期更新**: 及时更新系统和依赖包
5. **备份**: 定期备份数据库和配置文件
6. **日志审计**: 定期检查访问日志和错误日志

---

## 相关文档

- [API 文档](./api.md)
- [数据库设计](./database.md)
- [README.md](../README.md)
