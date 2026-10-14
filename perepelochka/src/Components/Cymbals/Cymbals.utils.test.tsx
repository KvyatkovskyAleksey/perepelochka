import { getStringWidth } from "./utils";

describe("getStringWidth", () => {
  it("should return the string width with vh when the index is provided", () => {
    const index = 1;
    const result = getStringWidth(index);
    expect(result).toMatch(/\d*\.?\d*vh/);
  });

  it("should return a greater string width for greater indexes", () => {
    const index1 = 1;
    const index2 = 2;
    const result1 = Number(getStringWidth(index1).replace("vh", ""));
    const result2 = Number(getStringWidth(index2).replace("vh", ""));
    expect(result1).toBeLessThan(result2);
  });

  it("should return a smaller string width for smaller indexes", () => {
    const index1 = 1;
    const index2 = 2;
    const result1 = Number(getStringWidth(index1).replace("vh", ""));
    const result2 = Number(getStringWidth(index2).replace("vh", ""));
    expect(result1).toBeLessThan(result2);
  });
});
