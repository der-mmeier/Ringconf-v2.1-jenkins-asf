import {
  clampToCodePoints,
  countCodePoints,
  insertTextAtSelection
} from "./engraving-input-utils";

describe("engraving input helpers", () => {
  it("counts symbols by code point instead of UTF-16 units", () => {
    expect(countCodePoints("A♥B")).toBe(3);
    expect(countCodePoints("A💎B")).toBe(3);
  });

  it("clamps text by code points", () => {
    expect(clampToCodePoints("A💎BC", 3)).toBe("A💎B");
  });

  it("inserts a symbol into an empty field", () => {
    expect(insertTextAtSelection("", "♥", {start: 0, end: 0}, 30)).toEqual({
      value: "♥",
      cursor: 1,
    });
  });

  it("inserts a symbol at the beginning", () => {
    expect(insertTextAtSelection("Anna", "♥", {start: 0, end: 0}, 30).value).toBe("♥Anna");
  });

  it("inserts a symbol in the middle", () => {
    expect(insertTextAtSelection("AnnaMax", "♥", {start: 4, end: 4}, 30)).toEqual({
      value: "Anna♥Max",
      cursor: 5,
    });
  });

  it("replaces the selected range", () => {
    expect(insertTextAtSelection("Anna und Max", "♥", {start: 5, end: 8}, 30)).toEqual({
      value: "Anna ♥ Max",
      cursor: 6,
    });
  });

  it("keeps the maximum length after insertion", () => {
    expect(insertTextAtSelection("Anna", "♥", {start: 4, end: 4}, 4)).toEqual({
      value: "Anna",
      cursor: 4,
    });
  });
});
