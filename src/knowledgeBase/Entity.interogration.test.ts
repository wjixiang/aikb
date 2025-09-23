import { describe, expect, it, vi, beforeEach } from "vitest";
import Entity from "./Entity";
import { config } from "dotenv";
config()

// Mock the BAML client to avoid native binding issues
vi.mock('baml_client', () => ({
  b: {
    Generate_plain_definition: vi.fn().mockResolvedValue({
      definition: "Mocked definition for interrogation"
    })
  }
}));

describe("Entity.create_entity_with_ai", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should create entity definition with AI", async () => {
    // Test the create_entity_with_ai function with mocked BAML client
    const definition = await Entity.create_entity_with_ai("Interrogation", []);
    console.log(definition)
    
    // Verify the function returns a string
    expect(definition.get_entity_data().definition).toBe("Mocked definition for interrogation");
    
    // Verify the mocked definition is returned
    // expect(definition).toBe("Mocked definition for interrogation");
  },{timeout:30000});
});