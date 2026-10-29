import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { roleHome } from "../src/lib/roles.ts";
const require = createRequire(import.meta.url);
function render(role, loading = false) {
  const exports = {};
  const source = fs.readFileSync(
    new URL(
      "../src/modules/virtual-tours/components/TourDashboardLink.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) =>
      name === "@/lib/session"
        ? { useSession: () => ({ role, loading }), roleHome }
        : name === "lucide-react"
          ? { ArrowLeft: () => React.createElement("svg") }
          : require(name),
  });
  return renderToStaticMarkup(React.createElement(exports.TourDashboardLink));
}
test("360 viewer returns each signed-in role to its own dashboard", () => {
  for (const role of ["tenant", "landlord", "admin"]) {
    const html = render(role);
    assert.ok(html.includes('href="' + roleHome(role) + '"'));
    assert.ok(html.includes("Back to " + role + " dashboard"));
  }
});
test("anonymous visitors get sign in and loading does not guess a role", () => {
  assert.ok(render(null).includes("/auth?mode=signin"));
  assert.equal(render(null, true), "");
});
