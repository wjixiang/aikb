# agent-lib

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test agent-lib` to execute the unit tests via [Jest](https://jestjs.io).

## Tool calling workflow

```mermaid
flowchart TD
A("Context assemble") -->B("LLM response") --> C("parse tool calling request")
--> D("process tool calling request")
```
