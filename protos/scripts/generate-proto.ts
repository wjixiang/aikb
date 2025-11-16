import { execSync } from "child_process"
import { readdirSync, writeFileSync } from "fs"


const PROTO_DIR="/workspace/protos/"
const protos = readdirSync(PROTO_DIR).filter(e=>e.match(/.proto/))
console.log(protos)

execSync(`protoc --plugin=/workspace/node_modules/.bin/protoc-gen-ts_proto --ts_proto_out=/workspace/protos/proto-ts/src/lib --ts_proto_opt=nestJs=true --proto_path=/workspace/protos ${protos.join(" ")}`)
writeFileSync('/workspace/protos/proto-ts/src/index.ts', `${protos.map(e=>`export * from './lib/${e.replace('.proto',"")}.js'`).join("\n")}`)


// "command": "protoc --plugin=/workspace/node_modules/.bin/protoc-gen-ts_proto --ts_proto_out=/workspace/protos/proto-ts/src/lib --ts_proto_opt=nestJs=true --proto_path=/workspace/protos bibliography.proto && "