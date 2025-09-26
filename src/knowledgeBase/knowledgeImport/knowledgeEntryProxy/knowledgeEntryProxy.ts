export abstract class KnowledgeEntryProxy {
    abstract search(search_str:string): Promise<string>;
}