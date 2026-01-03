import { Resolver } from '@nestjs/graphql';
import {
    ContentBlock,
    TextBlock,
    ImageBlock,
    ToolUseBlock,
    ToolResultBlock,
} from '../graphql';

@Resolver('ContentBlock')
export class ContentBlockResolver {
    resolveType(value: ContentBlock, context: any, info: any) {
        if ('text' in value) {
            return 'TextBlock';
        }
        if ('source' in value) {
            return 'ImageBlock';
        }
        if ('name' in value && 'id' in value) {
            return 'ToolUseBlock';
        }
        if ('tool_use_id' in value) {
            return 'ToolResultBlock';
        }
        return null;
    }
}
