import { describe, it, expect } from "vitest";

// Simple test for normalizeChocName logic
const normalizeChocName = (name: string, dynamicInventory: string[] = []) => {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
  const inventoryToSearch = dynamicInventory.length > 0 ? dynamicInventory : [
    "1 rs chocolate", "10 rs 5 star", "10 rs dairy milk", "10 rs kitkat",
    "2 rs dairy milk shots", "5 rs 5 star", "5 rs dairy milk", "5 rs milky bar",
    "5 rs peanut candy", "5 rs dark fantasy"
  ];
  const matched = inventoryToSearch.find(
    (item) => item.toLowerCase().trim().replace(/\s+/g, ' ') === normalized
  );
  return matched || name;
};

describe("Inventory Name Normalization", () => {
  it("should normalize chocolate names properly", () => {
    expect(normalizeChocName("10 rs kitkat")).toBe("10 rs kitkat");
    expect(normalizeChocName("10rs kitkat")).toBe("10rs kitkat"); // Default fallback to original
    expect(normalizeChocName(" 10 rs   kitkat ")).toBe("10 rs kitkat");
  });

  it("should use dynamic inventory if provided", () => {
    const dynamic = ["Special Choc", "Dark Delight"];
    expect(normalizeChocName("special choc", dynamic)).toBe("Special Choc");
    expect(normalizeChocName("dark delight", dynamic)).toBe("Dark Delight");
  });
});
