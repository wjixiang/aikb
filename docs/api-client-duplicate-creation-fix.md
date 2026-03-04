# Fix for Duplicate ApiClient Creation Logs

## Problem Description

When running the `article-retrieval-skill.ts` script, the following log output appeared three times:

```
[ApiClientFactory.create] Creating API client for provider: zai
[ApiClientFactory.create] Creating OpenaiCompatibleApiClient with model: glm-4.5-flash baseURL: https://open.bigmodel.cn/api/paas/v4
```

This indicated that the `ApiClientFactory.create()` method was being called multiple times during agent initialization.

## Root Cause Analysis

The issue was in the DI container configuration in `libs/agent-lib/src/di/container.ts`. The `ApiClient` was bound using `toDynamicValue()` without specifying a scope:

```typescript
// Before (line 439-442)
agentContainer.bind<ApiClient>(TYPES.ApiClient).toDynamicValue(() => {
  const config = agentContainer.get<ProviderSettings>(TYPES.ProviderSettings);
  return ApiClientFactory.create(config);
});
```

When no scope is specified, InversifyJS treats the binding as **transient**, meaning a new instance is created each time the dependency is requested.

During agent initialization, the `ApiClient` is injected into three different modules that are all in `requestScope()`:

1. [`Agent`](libs/agent-lib/src/agent/agent.ts:126)
2. [`ThinkingModule`](libs/agent-lib/src/thinking/ThinkingModule.ts:60)
3. [`ActionModule`](libs/agent-lib/src/action/ActionModule.ts:54)

Since these modules are created within the same request scope, they should share the same `ApiClient` instance. However, because the `ApiClient` binding was transient, each module received a new instance, resulting in three calls to `ApiClientFactory.create()`.

## Solution

The fix was to add `.inRequestScope()` to the `ApiClient` binding in both the parent container and the agent container:

```typescript
// After (line 439-442)
agentContainer
  .bind<ApiClient>(TYPES.ApiClient)
  .toDynamicValue(() => {
    const config = agentContainer.get<ProviderSettings>(TYPES.ProviderSettings);
    return ApiClientFactory.create(config);
  })
  .inRequestScope();
```

This ensures that:

1. A single `ApiClient` instance is created per request scope
2. All modules within the same request scope share the same `ApiClient` instance
3. The `ApiClientFactory.create()` method is called only once per request

## Files Modified

1. `libs/agent-lib/src/di/container.ts`:
   - Line 186-189: Added `.inRequestScope()` to parent container's `ApiClient` binding
   - Line 439-442: Added `.inRequestScope()` to agent container's `ApiClient` binding

## Verification

After applying the fix, the log output should only appear once:

```
[ApiClientFactory.create] Creating API client for provider: zai
[ApiClientFactory.create] Creating OpenaiCompatibleApiClient with model: glm-4.5-flash baseURL: https://open.bigmodel.cn/api/paas/v4
```

## Additional Notes

This fix also improves performance by:

- Reducing the number of API client instances created
- Reducing memory usage
- Ensuring consistent configuration across all modules that use the API client

The fix aligns with the DI container's design where modules in request scope should share their dependencies.
