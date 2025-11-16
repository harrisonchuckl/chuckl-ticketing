import { readFileSync } from "fs";
import path from "path";

function findPrismaSchema() {
  const schemaPaths = [
    "./prisma/schema.prisma",
    "../prisma/schema.prisma",
    "../../prisma/schema.prisma",
  ];

  for (const p of schemaPaths) {
    try {
      const abs = path.resolve(p);
      readFileSync(abs);
      return abs;
    } catch (_) {}
  }

  throw new Error("❌ Could not find schema.prisma");
}

function parseModels(schemaContent) {
  const modelRegex = /model\s+(\w+)\s+{([\s\S]*?)}\s*(?=model|enum|$)/g;

  const models = [];
  let match;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const [, name, body] = match;

    const fields = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));

    models.push({ name, fields });
  }

  return models;
}

function main() {
  try {
    const schemaPath = findPrismaSchema();
    const content = readFileSync(schemaPath, "utf8");

    console.log("\n🟦 Prisma schema found at:", schemaPath);
    console.log("--------------------------------------------------\n");

    const models = parseModels(content);

    for (const model of models) {
      console.log(`📌 MODEL: ${model.name}`);
      console.log("--------------------------------");
      model.fields.forEach((f) => console.log("  " + f));
      console.log("\n");
    }

    console.log("Done.\n");
  } catch (err) {
    console.error(err.message);
  }
}

main();
