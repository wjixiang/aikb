# Elasticsearch API Key Creation Script

This script helps you create API keys for Elasticsearch when security features are enabled.

## Prerequisites

1. **Elasticsearch Security Enabled**: API keys require Elasticsearch security features to be enabled. In your `docker-compose.yml`, set:
   ```yaml
   elasticsearch:
     environment:
       - xpack.security.enabled=true
       - ELASTIC_PASSWORD=yourpassword
   ```

2. **Authentication**: You need either:
   - Username and password (e.g., elastic user)
   - An existing API key with `manage_api_key` privilege

## Usage

### Basic Usage

```bash
# Create API key with default name and no expiration
npx tsx scripts/create-es-api-key.ts

# Create API key with custom name
npx tsx scripts/create-es-api-key.ts my-api-key

# Create API key with name and expiration
npx tsx scripts/create-es-api-key.ts my-api-key 7d
```

### With Authentication

```bash
# Using username and password
ELASTICSEARCH_USERNAME=elastic ELASTICSEARCH_PASSWORD=yourpassword npx tsx scripts/create-es-api-key.ts

# Using existing API key
ELASTICSEARCH_API_KEY=existing_encoded_key npx tsx scripts/create-es-api-key.ts
```

### Output Formats

```bash
# Default table format
npx tsx scripts/create-es-api-key.ts

# JSON output
npx tsx scripts/create-es-api-key.ts my-key 7d json

# Environment file format (saves to .env)
npx tsx scripts/create-es-api-key.ts my-key 7d env
```

## Parameters

1. **API Key Name** (optional): Custom name for the API key. If not provided, a random name will be generated.
2. **Expiration** (optional): Expiration time for the API key. Supported formats:
   - Time units: `1s`, `1m`, `1h`, `1d`, `1w`, `1M`, `1y`
   - ISO date string: `2024-12-31T23:59:59Z`
3. **Output Format** (optional): `table` (default), `json`, or `env`

## Environment Variables

- `ELASTICSEARCH_URL`: Elasticsearch URL (default: `http://localhost:9200`)
- `ELASTICSEARCH_USERNAME`: Username for authentication
- `ELASTICSEARCH_PASSWORD`: Password for authentication
- `ELASTICSEARCH_API_KEY`: Existing API key for authentication

## Examples

### Create a 30-day API key and save to .env

```bash
ELASTICSEARCH_USERNAME=elastic ELASTICSEARCH_PASSWORD=changeme npx tsx scripts/create-es-api-key.ts production-key 30d env
```

This will:
1. Create an API key named "production-key"
2. Set it to expire in 30 days
3. Save the encoded key to your `.env` file as `ELASTICSEARCH_API_KEY`

### Create API key with JSON output

```bash
npx tsx scripts/create-es-api-key.ts temp-key 1h json
```

Output:
```json
{
  "id": "abc123",
  "name": "temp-key",
  "api_key": "def456",
  "encoded": "encoded_key_here",
  "expiration": 1640995200000,
  "invalidated": false,
  "created_by": "script",
  "created": 1640908800000
}
```

## Troubleshooting

### "Elasticsearch security is not enabled"

This error means your Elasticsearch instance doesn't have security features enabled. To fix this:

1. Update your `docker-compose.yml`:
   ```yaml
   elasticsearch:
     environment:
       - xpack.security.enabled=true
       - ELASTIC_PASSWORD=yourpassword
   ```

2. Restart containers:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. Set up passwords (if not using ELASTIC_PASSWORD):
   ```bash
   docker exec -it container-es bin/elasticsearch-setup-passwords interactive
   ```

### "Authentication failed"

This means you provided invalid credentials. Ensure:
- Username and password are correct
- User has `manage_api_key` privilege
- Elasticsearch security is enabled

### "Insufficient permissions"

The user needs the `manage_api_key` privilege. Use the `elastic` superuser or grant the appropriate role.

## Security Notes

- API keys are more secure than using username/password in applications
- Store API keys securely (environment variables, secret management)
- Set appropriate expiration times
- Regularly rotate API keys
- Monitor API key usage in Elasticsearch

## Integration with Project

This script integrates with the existing Elasticsearch configuration in this project:

- The generated API key can be used with `ELASTICSEARCH_API_KEY` environment variable
- The `ElasticsearchItemVectorStorage` class in `libs/item-vector-storage` will automatically use the API key
- The script can automatically update the `.env` file when using the `env` output format

# Elasticsearch Connection Verification Script

This script helps you verify that your Elasticsearch instance is accessible and properly configured.

## Usage

```bash
# Basic connection verification
npx tsx scripts/verify-elasticsearch-connection.ts
```

## What it does

1. **Loads environment variables** from `.env` file
2. **Creates Elasticsearch client** using `ELASTICSEARCH_URL`
3. **Pings the cluster** to verify connectivity
4. **Displays cluster information** including:
   - Cluster name
   - Elasticsearch version
   - Cluster tagline

## Environment Variables

- `ELASTICSEARCH_URL`: Elasticsearch URL (default: `http://localhost:9200`)

## Example Output

```
Verifying Elasticsearch connection...
Elasticsearch URL: http://elasticsearch:9200
✅ Successfully connected to Elasticsearch!
📊 Cluster info:
   - Name: docker-cluster
   - Version: 9.1.3
   - Tagline: You Know, for Search
```

## Exit Codes

- `0`: Connection successful
- `1`: Connection failed or error occurred

## Troubleshooting

### "Elasticsearch URL not set"
Ensure the `ELASTICSEARCH_URL` environment variable is set in your `.env` file.

### Connection timeout or refused
- Verify Elasticsearch is running: `docker ps`
- Check the URL and port in your `.env` file
- Ensure network connectivity between your application and Elasticsearch

### Authentication errors
If security is enabled, you may need to add authentication to the script or use the API key creation script first.