import * as utils from "./utils";

test("parseSemver", () => {
  const [major, minor, patch] = utils.parseSemver("1.0.0");
  expect(major).toBe(1);
  expect(minor).toBe(0);
  expect(patch).toBe(0);
});

// test("validateEmail returns true for emails", () => {
//   expect(validateEmail("kody@example.com")).toBe(true);
// });
