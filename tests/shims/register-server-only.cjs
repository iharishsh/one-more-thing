const Module = require("module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") {
    return require.resolve("./server-only.ts");
  }
  return original.call(this, request, parent, isMain, options);
};
