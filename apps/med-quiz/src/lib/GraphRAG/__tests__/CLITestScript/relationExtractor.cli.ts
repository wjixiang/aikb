import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import relationExtractor from "../../relationExtractor";

interface Entity {
  name: string;
  category: string;
}

interface Arguments {
  passage: string;
  entities: Entity[];
  chatModalName: string;
}

const argv = yargs(hideBin(process.argv))
  .option("passage", {
    alias: "p",
    describe: "The passage to extract relations from",
    type: "string",
    demandOption: true,
  })
  .option("entities", {
    alias: "e",
    describe: "The entities in the passage (JSON string)",
    type: "string",
    demandOption: true,
  })
  .option("chatModalName", {
    alias: "m",
    describe: "The chat model name",
    type: "string",
    default: "gpt-3.5-turbo",
  })
  .parseSync();

async function main() {
  const { passage, entities, chatModalName } = argv as any as Arguments;

  try {
    const parsedEntities = Array.isArray(entities)
      ? entities
      : JSON.parse(entities);
    if (!Array.isArray(parsedEntities)) {
      throw new Error(
        "Entities must be a JSON array of {name: string, category: string}",
      );
    }
    for (const entity of parsedEntities) {
      if (
        typeof entity.name !== "string" ||
        typeof entity.category !== "string"
      ) {
        throw new Error("Each entity must have name and category as strings");
      }
    }

    const extractor = new relationExtractor(chatModalName);
    const relations = await extractor.relations_extraction(
      passage,
      parsedEntities,
    );

    console.log("Extracted Relations:", JSON.stringify(relations, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
