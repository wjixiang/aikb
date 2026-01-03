import { Resolver } from '@nestjs/graphql';
import {
    MessageContent,
    StringContent,
    BlocksContent,
} from '../graphql';

@Resolver('MessageContent')
export class MessageContentResolver {
    resolveType(value: MessageContent, context: any, info: any) {
        if ('text' in value) {
            return 'StringContent';
        }
        if ('blocks' in value) {
            return 'BlocksContent';
        }
        return null;
    }
}
