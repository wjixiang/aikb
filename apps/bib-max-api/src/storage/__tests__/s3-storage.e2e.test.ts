import { describe, it } from "node:test";
import { createStorageService } from "../index.js";

describe("s3 e2e test: use RustFS", () => {
    const s3Service = createStorageService({
        region: "",
        bucket: "knowledge-base",
        accessKeyId: "aVzc02Qxp3MBUko97wJ4",
        secretAccessKey: "MVHtKLSIRvNnfPduEopJT5DaBrAbxmz3W9QXw6i7",
        endpoint: "http://192.168.123.98:9000",
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