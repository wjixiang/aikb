import { ApiHandler, buildApiHandler } from "../api";
import TooCallingParser from "../tools/toolCallingParser/toolCallingParser";
import { ProviderSettings } from "../types/provider-settings";

export interface AgentConfig {

}



class Agent {
    private api: ApiHandler;
    toolCallingParser = new TooCallingParser()

    constructor(
        private apiConfiguration: ProviderSettings,
    ) {
        this.api = buildApiHandler(this.apiConfiguration)
    }
}