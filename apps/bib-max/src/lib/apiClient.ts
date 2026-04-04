export class ApiError extends Error {
    statusCode: number;
    error: string;

    constructor(statusCode: number, error: string, message: string) {
        super(message);
        this.name = "ApiError";
        this.statusCode = statusCode;
        this.error = error;
    }
}

interface RequestOptions {
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

async function request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const { headers = {}, signal } = options;

    const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        signal,
        ...((method !== "GET" && method !== "HEAD") ? { body: "{}" } : {}),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(
            res.status,
            body?.error ?? "Request failed",
            body?.message ?? res.statusText,
        );
    }

    return res.json() as Promise<T>;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    if (!params) return path;
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
            searchParams.set(key, String(value));
        }
    }
    const qs = searchParams.toString();
    return qs ? `${path}?${qs}` : path;
}

async function requestWithBody<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
): Promise<T> {
    const { headers = {}, signal } = options;

    const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
    });

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new ApiError(
            res.status,
            errorBody?.error ?? "Request failed",
            errorBody?.message ?? res.statusText,
        );
    }

    return res.json() as Promise<T>;
}

export const apiClient = {
    get<T>(path: string, params?: Record<string, string | number | boolean | undefined>, options?: RequestOptions): Promise<T> {
        return request<T>("GET", buildUrl(path, params), options);
    },

    post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return requestWithBody<T>("POST", path, body, options);
    },

    put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return requestWithBody<T>("PUT", path, body, options);
    },

    patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return requestWithBody<T>("PATCH", path, body, options);
    },

    del<T>(path: string, options?: RequestOptions): Promise<T> {
        return request<T>("DELETE", path, options);
    },

    async upload<T>(path: string, file: File, fieldName = "file", options?: RequestOptions): Promise<T> {
        const { headers = {}, signal } = options ?? {};
        const formData = new FormData();
        formData.append(fieldName, file);
        const res = await fetch(path, {
            method: "POST",
            headers,
            body: formData,
            signal,
        });
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new ApiError(
                res.status,
                body?.error ?? "Upload failed",
                body?.message ?? res.statusText);
        }
        return await (res.json() as Promise<T>);
    },
};
