import { describe, it, expect } from "vitest";
import { createStorageService } from "../index.js";

describe("s3 e2e test: Garage storage", () => {
    const s3Service = createStorageService({
        region: "us-east-1",
        bucket: "bib-max",
        accessKeyId: "admin",
        secretAccessKey: "password",
        endpoint: "http://192.168.123.98:9900",
        forcePathStyle: true
    })

    it('should connect to bucket', async () => {
        const result = await s3Service.exists("__connection_test_nonexistent__");
        // 连接正常时 exists 返回 false（对象不存在），连接异常则抛错
        if (result !== false) {
            throw new Error("Expected false for nonexistent key, got connection issue");
        }
    })
})