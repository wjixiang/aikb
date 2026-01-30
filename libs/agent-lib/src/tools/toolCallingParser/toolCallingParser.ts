import { ApiStreamChunk } from "../../api";
import { NativeToolCallParser } from "../../assistant-message/NativeToolCallParser";
import { ToolProtocol } from "../../types";
import XMLToolCallingParser from "./XMLToolCallingParser";

export default class TooCallingParser {
    xmlToolCallingParser = new XMLToolCallingParser()
    nativeToolCallingParser = new NativeToolCallParser()

    parseToolCalling(protocol: ToolProtocol, chunks: ApiStreamChunk[]) {
        if (protocol === 'xml') {

        } else {

        }
    }
}