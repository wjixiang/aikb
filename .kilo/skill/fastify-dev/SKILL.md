---
name: fastify-dev
description: This skill should be used when building Fastify web applications, REST APIs, or working with Fastify plugins. It provides comprehensive reference documentation for Fastify v5.8.x including Server, Routes, Requests, Replies, Hooks, Plugins, Validation/Serialization, and Lifecycle concepts.
---

# Fastify Dev Reference

## Overview

Fastify is a fast, low-overhead web framework for Node.js. This skill provides reference documentation for Fastify v5.8.x (latest), covering all core APIs and concepts needed to build web applications and REST APIs.

## Quick Start

```javascript
const fastify = require('fastify')({ logger: true })

fastify.get('/', async (request, reply) => {
  return { hello: 'world' }
})

fastify.listen({ port: 3000 }, (err, address) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
```

## Server Factory

Create a Fastify instance with options:

```javascript
const fastify = require('fastify')({
  logger: true,                    // Enable logging (default: false)
  bodyLimit: 1048576,               // Max payload size (default: 1MiB)
  connectionTimeout: 0,              // Socket timeout (ms)
  keepAliveTimeout: 72000,          // Keep-alive timeout (ms)
  maxRequestsPerSocket: 0,          // Max requests per socket (0 = unlimited)
  requestTimeout: 0,               // Max time for entire request (ms)
  handlerTimeout: 0,               // Max time for route handler (ms)
  pluginTimeout: 10000,            // Plugin load timeout (ms)
  trustProxy: false,               // Trust proxy headers
  disableRequestLogging: false,   // Disable request start/end logging
  exposeHeadRoutes: true,          // Auto-create HEAD routes for GET
  return503OnClosing: true,       // Return 503 after close()
  caseSensitive: true,             // Routes case-sensitive
  ignoreTrailingSlash: false,      // Ignore trailing slash
  ignoreDuplicateSlashes: false,  // Remove duplicate slashes
  trustProxy: false               // Trust X-Forwarded-* headers
})
```

Key Server Methods:
- `fastify.listen([options], [callback])` - Start server
- `fastify.close([callback])` - Stop server gracefully
- `fastify.ready([callback])` - Wait for plugins to load
- `fastify.register(plugin, [options])` - Register plugin
- `fastify.addHook(name, handler)` - Add lifecycle hook
- `fastify.route(options)` - Define route
- `fastify.get|post|put|delete|patch|head|options(path, [opts], handler)` - Shorthand routes

## Routes

Define routes with full options or shorthand:

```javascript
// Full declaration
fastify.route({
  method: 'GET',
  url: '/',
  schema: {
    querystring: { type: 'object', properties: { name: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { hello: { type: 'string' } } } }
  },
  handler: function (request, reply) {
    reply.send({ hello: 'world' })
  }
})

// Shorthand
fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params
  return { userId: id }
})

// Route with validation
fastify.post('/users', {
  schema: {
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' }
      }
    }
  }
}, async (request, reply) => {
  return { created: request.body }
})
```

Route Options:
- `method` - HTTP method(s)
- `url` or `path` - Route path
- `schema` - Validation schemas (body, querystring/query, params, headers, response)
- `handler` - Request handler function
- `onRequest`, `preParsing`, `preValidation`, `preHandler`, `preSerialization`, `onSend`, `onResponse`, `onTimeout`, `onError` - Hooks
- `errorHandler` - Custom error handler
- `handlerTimeout` - Per-route timeout override
- `logLevel` - Route-specific log level
- `config` - Custom configuration object
- `constraints` - Version/host constraints

URL Parameters:
```javascript
// Parametric
fastify.get('/users/:userId', handler)
fastify.get('/users/:userId/posts/:postId', handler)

// Wildcard
fastify.get('/files/*', handler)

// Optional param
fastify.get('/users/:id?', handler)

// Regex
fastify.get('/files/:name(^\\d+)\\.png', handler)
```

## Request Object

The first parameter in handlers is the Request object:

```javascript
fastify.get('/example', async (request, reply) => {
  request.query      // Parsed querystring
  request.body       // Request payload (parsed)
  request.params     // URL parameters
  request.headers    // Request headers
  request.raw       // Node.js core IncomingMessage
  request.id        // Request ID
  request.log       // Request logger
  request.ip        // Client IP
  request.ips       // Proxy IPs (when trustProxy enabled)
  request.host      // Host header
  request.hostname  // Hostname
  request.protocol  // 'http' or 'https'
  request.method    // HTTP method
  request.url       // Request URL
  request.originalUrl // Original URL before routing
  request.is404     // True if 404 handler
  request.signal    // AbortSignal for cancellation
  request.server    // Fastify instance
  request.routeOptions // Route configuration
})
```

## Reply Object

The second parameter is the Reply object:

```javascript
fastify.get('/', async (request, reply) => {
  reply.code(200)                    // Set status code
  reply.status(200)                  // Alias for code
  reply.statusCode                   // Read/write status
  
  reply.header('x-custom', 'value') // Set header
  reply.headers({ a: '1', b: '2' }) // Set multiple headers
  reply.getHeader('x-custom')        // Get header value
  reply.getHeaders()                 // Get all headers
  reply.removeHeader('x-custom')     // Remove header
  reply.hasHeader('x-custom')        // Check header exists
  
  reply.type('application/json')     // Set Content-Type
  
  reply.redirect('/other')           // Redirect (default 302)
  reply.redirect('/other', 303)      // Redirect with status
  
  reply.callNotFound()              // Invoke 404 handler
  
  reply.hijack()                    // Take control of response
  reply.raw                          // Node.js core ServerResponse
  reply.sent                         // Boolean - response sent?
  
  reply.send({ hello: 'world' })    // Send response
  // OR return the value directly in async handlers
  
  return reply // If using reply.send in async functions
})
```

Send Types:
```javascript
reply.send({ object: 'json' })    // JSON serialized
reply.send('plain text')           // Text response
reply.send(buffer)                 // Binary (Content-Type: application/octet-stream)
reply.send(stream)                  // Stream
reply.send(new Error('msg'))       // Error response
reply.send(new Response(...))       // Web Response API
```

## Hooks

Lifecycle hooks for intercepting requests:

```javascript
// Request/Reply Hooks (in order)
fastify.addHook('onRequest', async (request, reply) => {
  // Fires when request received
  // request.body is undefined here
})

fastify.addHook('preParsing', async (request, reply, payload) => {
  // Before body parsing
  // Return new payload stream to transform
})

fastify.addHook('preValidation', async (request, reply) => {
  // After parsing, before validation
  // Good for authentication
})

fastify.addHook('preHandler', async (request, reply) => {
  // Before route handler
})

fastify.addHook('preSerialization', async (request, reply, payload) => {
  // After handler, before serialization
  // Not called for strings, buffers, streams, null
})

fastify.addHook('onSend', async (request, reply, payload) => {
  // Modify payload before sending
  return newPayload // Replace payload
})

fastify.addHook('onResponse', async (request, reply) => {
  // After response sent
  // Good for analytics
})

fastify.addHook('onTimeout', async (request, reply) => {
  // When request times out
})

fastify.addHook('onError', async (request, reply, error) => {
  // When error occurs
  // Cannot call reply.send
})

fastify.addHook('onRequestAbort', async (request) => {
  // Client aborted request
})

// Respond early from hook
fastify.addHook('onRequest', async (request, reply) => {
  reply.send('early response')
  return reply // Required in async hooks
})
```

Application Hooks:
```javascript
fastify.addHook('onReady', async () => {
  // All plugins loaded, before listening
})

fastify.addHook('onListen', async () => {
  // Server started listening
})

fastify.addHook('preClose', async () => {
  // Before server closes (after close() called)
})

fastify.addHook('onClose', async () => {
  // Server fully closed
})

fastify.addHook('onRoute', (routeOptions) => {
  // New route registered
})

fastify.addHook('onRegister', (instance, opts) => {
  // New plugin registered
})
```

Error handling in hooks:
```javascript
fastify.addHook('onRequest', (request, reply, done) => {
  done(new Error('Some error')) // Or throw in async
})
```

## Plugins

Extend Fastify with plugins:

```javascript
// Basic plugin
module.exports = function plugin(fastify, opts, done) {
  fastify.decorate('utility', function() { return 'hello' })
  fastify.get('/route', handler)
  done()
}

// Async plugin
module.exports = async function asyncPlugin(fastify, opts) {
  fastify.decorate('db', await connectDB())
}

// Register with options
fastify.register(require('./plugin'), {
  prefix: '/api',
  logLevel: 'warn'
})

// Create scoped plugin (don't share state with parent)
const fp = require('fastify-plugin')
module.exports = fp(function(fastify, opts, done) {
  fastify.decorate('scoped', 'value')
  done()
}, '0.x') // Fastify version range

// Skip encapsulation
module.exports = function plugin(fastify, opts, done) {
  fastify.decorate('shared', 'value')
  done()
}
module.exports[Symbol.for('skip-override')] = true
```

Plugin options passed to `fastify.register()`:
- `prefix` - Route prefix
- `logLevel` - Log level for routes
- `logSerializers` - Custom serializers

## Validation and Serialization

Fastify uses JSON Schema for validation and serialization:

```javascript
const schema = {
  body: {                           // Validate request body
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      email: { type: 'string', format: 'email' }
    }
  },
  querystring: {                    // Validate query string
    type: 'object',
    properties: {
      limit: { type: 'integer', default: 10 }
    }
  },
  params: {                         // Validate URL params
    type: 'object',
    properties: {
      userId: { type: 'string' }
    }
  },
  headers: {                        // Validate headers
    type: 'object',
    properties: {
      'x-custom': { type: 'string' }
    },
    required: ['x-custom']
  },
  response: {                       // Serialize response
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    }
  }
}

fastify.post('/users', { schema }, async (request, reply) => {
  return { id: '123', name: request.body.name }
})
```

Shared schemas:
```javascript
fastify.addSchema({
  $id: 'http://example.com/user.json',
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' }
  }
})

// Reference in routes
fastify.post('/users', {
  schema: {
    body: { $ref: 'http://example.com/user.json#' }
  }
})

// Get schemas
const schemas = fastify.getSchemas()
const userSchema = fastify.getSchema('http://example.com/user.json')
```

Custom validator/serializer:
```javascript
const Ajv = require('ajv')
const ajv = new Ajv({ coerceTypes: true })

fastify.setValidatorCompiler(({ schema, method, url, httpPart }) => {
  return ajv.compile(schema)
})

fastify.setSerializerCompiler(({ schema, method, url, httpStatus }) => {
  return (data) => JSON.stringify(data)
})
```

## Logging

Built-in Pino logger:

```javascript
const fastify = require('fastify')({
  logger: {
    level: 'info',
    serializers: {
      req: (req) => ({ url: req.url, method: req.method }),
      res: (res) => ({ statusCode: res.statusCode })
    }
  }
})

// Or disable logger
const fastify = require('fastify')({ logger: false })

// Use request logger
request.log.info('Processing request')
request.log.error({ err }, 'Error occurred')
```

## Lifecycle

Request lifecycle order:
```
Incoming Request
  └─▶ Routing
      └─▶ onRequest Hook
          └─▶ preParsing Hook
              └─▶ Parsing
                  └─▶ preValidation Hook
                      └─▶ Validation
                          └─▶ preHandler Hook
                              └─▶ User Handler
                                  └─▶ preSerialization Hook
                                      └─▶ onSend Hook
                                          └─▶ Outgoing Response
                                              └─▶ onResponse Hook
```

Reply lifecycle (when handler returns/sends):
```
User Handler
  └─▶ If error: schemaErrorFormatter → onError Hook
  └─▶ If sync: reply.send()
  └─▶ If async: promise resolves → reply.send()
  └─▶ preSerialization Hook
      └─▶ onSend Hook
          └─▶ Response sent
              └─▶ onResponse Hook
```

Shutdown lifecycle (when close() called):
```
1. Server flagged as closing
2. preClose hooks execute
3. Connection draining (forceCloseConnections)
4. HTTP server stops accepting connections
5. onClose hooks execute
6. Server fully closed
```

## Error Handling

```javascript
// Set global error handler
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error)
  reply.status(error.statusCode || 500).send({
    error: error.message
  })
})

// Set 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({ error: 'Not Found' })
})

// Attach validation errors to request
fastify.post('/users', {
  schema: schema,
  attachValidation: true
}, async (request, reply) => {
  if (request.validationError) {
    return reply.status(400).send(request.validationError)
  }
})

// Error codes
error.code        // Fastify error code
error.statusCode  // HTTP status code
error.message     // Error message
```

## Encapsulation

Plugins create scopes - decorators don't leak to parents:

```javascript
fastify.decorate('shared', 'parent')  // Available everywhere

fastify.register(async (fastify, opts) => {
  fastify.decorate('scoped', 'child')  // Only in this scope
  
  fastify.get('/child', async (request, reply) => {
    return { parent: fastify.shared, child: fastify.scoped }
  })
})

fastify.get('/parent', async (request, reply) => {
  return { parent: fastify.shared, child: fastify.scoped } // Error!
})
```

## Decorators

Add methods/properties to Fastify instances:

```javascript
// Decorate server
fastify.decorate('utils', {
  formatDate: (date) => date.toISOString()
})
await fastify.after()
console.log(fastify.utils.formatDate(new Date()))

// Decorate request (in plugin)
fastify.decorateRequest('user', null)
fastify.addHook('preHandler', async (request) => {
  request.user = await getUser(request)
})

// Decorate reply
fastify.decorateReply('render', function(template, data) {
  // Render template with data
})
```

## Content Type Parsing

Custom content type parsers:

```javascript
// Parse custom content type
fastify.addContentTypeParser('application/custom', (req, body, done) => {
  parseCustom(body, (err, parsed) => {
    done(err, parsed)
  })
})

// With options
fastify.addContentTypeParser('application/custom', {
  parseAs: 'string'  // Parse as string
}, (req, body, done) => {
  done(null, body)
})

// Remove parser
fastify.removeContentTypeParser('application/json')
```

## Testing

```javascript
// Build in test method
fastify.listen().then(async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: { 'x-custom': 'value' }
  })
  
  console.log(response.statusCode)
  console.log(response.body)
  
  await fastify.close()
})

// With promises
const res = await fastify.inject({
  method: 'POST',
  url: '/users',
  payload: { name: 'John' }
})
```

## Common Patterns

### Async Route Handler
```javascript
fastify.get('/async', async (request, reply) => {
  const data = await fetchData()
  return data  // Return value, not reply.send()
})
```

### Middleware-like Auth
```javascript
fastify.decorate('authenticate', async (request, reply) => {
  if (!request.headers.authorization) {
    reply.code(401).send({ error: 'Unauthorized' })
    return false
  }
  return true
})

fastify.addHook('preHandler', async (request, reply) => {
  if (!request.server.authenticate(request)) {
    return // Response already sent
  }
})
```

### Plugin with Database
```javascript
const fp = require('fastify-plugin')

module.exports = fp(async function dbPlugin(fastify, opts) {
  const db = await createDB(opts.connectionString)
  
  fastify.decorate('db', db)
  
  fastify.addHook('onClose', async () => {
    await db.close()
  })
})
```

## Documentation Links

For more details, refer to the official documentation:
- https://fastify.dev/docs/latest/Reference/
- Server: https://fastify.dev/docs/latest/Reference/Server/
- Routes: https://fastify.dev/docs/latest/Reference/Routes/
- Request: https://fastify.dev/docs/latest/Reference/Request/
- Reply: https://fastify.dev/docs/latest/Reference/Reply/
- Hooks: https://fastify.dev/docs/latest/Reference/Hooks/
- Plugins: https://fastify.dev/docs/latest/Reference/Plugins/
- Validation: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
- Lifecycle: https://fastify.dev/docs/latest/Reference/Lifecycle/
