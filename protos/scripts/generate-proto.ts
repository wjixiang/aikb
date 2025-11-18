import { execSync } from 'child_process';
import { readdirSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PROTO_DIR = '/workspace/protos/';
const CLIENTS_DIR = '/workspace/protos/proto-ts/src/clients';
const protos = readdirSync(PROTO_DIR).filter((e) => e.match(/.proto$/));
console.log('Found proto files:', protos);

// Ensure clients directory exists
mkdirSync(CLIENTS_DIR, { recursive: true });

// Generate TypeScript types from proto files
execSync(
  `protoc --plugin=/workspace/node_modules/.bin/protoc-gen-ts_proto --ts_proto_out=/workspace/protos/proto-ts/src/lib --ts_proto_opt=nestJs=true --proto_path=/workspace/protos ${protos.join(' ')}`,
);

// Generate main index file for proto exports (will be updated later with client exports)
const protoExports = protos.map(
  (e) =>
    `export * as ${e.replace('.proto', '')}Proto from './lib/${e.replace('.proto', '')}.js'`,
);

// Function to parse proto file and extract service information
function parseProtoService(
  protoFileName: string,
): {
  serviceName: string;
  packageName: string;
  methods: { name: string; inputType: string; outputType: string }[];
} | null {
  const protoContent = readFileSync(join(PROTO_DIR, protoFileName), 'utf-8');

  // Extract package name
  const packageMatch = protoContent.match(/package\s+([^;]+);/);
  const packageName = packageMatch ? packageMatch[1].trim() : '';

  // Extract service definition
  const serviceMatch = protoContent.match(/service\s+(\w+)\s*{([^}]+)}/s);
  if (!serviceMatch) {
    console.warn(`No service found in ${protoFileName}`);
    return null;
  }

  const serviceName = serviceMatch[1];
  const serviceBody = serviceMatch[2];

  // Extract RPC methods
  const rpcMatches = serviceBody.matchAll(
    /rpc\s+(\w+)\s*\(([^)]+)\)\s*returns\s*\(([^)]+)\)/g,
  );
  const methods: { name: string; inputType: string; outputType: string }[] = [];

  for (const match of rpcMatches) {
    methods.push({
      name: match[1],
      inputType: match[2].trim(),
      outputType: match[3].trim(),
    });
  }

  return {
    serviceName,
    packageName,
    methods,
  };
}

// Function to generate gRPC client class
function generateGrpcClient(
  protoFileName: string,
  serviceInfo: {
    serviceName: string;
    packageName: string;
    methods: { name: string; inputType: string; outputType: string }[];
  },
): string {
  const protoName = protoFileName.replace('.proto', '');
  const className = `${protoName.charAt(0).toUpperCase() + protoName.slice(1)}GrpcClient`;
  const serviceName = serviceInfo.serviceName;
  const packageName = serviceInfo.packageName;
  const protoNameCamelCase = protoName;

  // Generate method implementations
  const methodImplementations = serviceInfo.methods
    .map((method) => {
      const methodName =
        method.name.charAt(0).toLowerCase() + method.name.slice(1);
      const inputType = `${protoNameCamelCase}Proto.${method.inputType}`;
      const outputType = `${protoNameCamelCase}Proto.${method.outputType}`;

      return `  ${methodName}(
    request: ${inputType},
  ): Observable<${outputType}> {
    return this.${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}Service
      .${methodName}(request);
  }`;
    })
    .join('\n\n');

  return `import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ${protoNameCamelCase}Proto } from 'proto-ts';

@Injectable()
export class ${className} {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: '${packageName}',
      protoPath: '/workspace/protos/${protoFileName}',
      url: process.env['${protoName.toUpperCase()}_SERVICE_GRPC_URL'] || 'localhost:50051',
    },
  })
  private client!: ClientGrpc;

  private ${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}Service!: ${protoNameCamelCase}Proto.${serviceName}Client;

  onModuleInit() {
    this.${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}Service =
      this.client.getService<${protoNameCamelCase}Proto.${serviceName}Client>(
        '${serviceName}',
      );
  }

${methodImplementations}
}`;
}

// Generate gRPC clients for each proto file
const clientExports: string[] = [];

for (const proto of protos) {
  const serviceInfo = parseProtoService(proto);
  if (serviceInfo) {
    const clientCode = generateGrpcClient(proto, serviceInfo);
    const clientFileName = proto.replace('.proto', '.grpc.client.ts');
    const clientPath = join(CLIENTS_DIR, clientFileName);

    writeFileSync(clientPath, clientCode);
    console.log(`Generated gRPC client: ${clientPath}`);

    const exportName = proto.replace('.proto', '');
    clientExports.push(`export * from './clients/${exportName}.grpc.client';`);
  }
}

// Generate main index file with both proto and client exports
writeFileSync(
  '/workspace/protos/proto-ts/src/index.ts',
  [...protoExports, ...clientExports].join('\n'),
);

console.log('Generated gRPC clients index file');
console.log('Proto generation completed successfully!');
