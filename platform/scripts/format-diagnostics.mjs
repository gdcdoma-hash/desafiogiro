import fs from "node:fs";
import prettier from "prettier";

const files = [
  "apps/admin-web/src/MeuGiroParticipant.tsx",
  "apps/admin-web/src/participant-main.tsx",
  "apps/admin-web/src/ParticipantPortal.tsx",
];

for (const file of files) {
  const input = fs.readFileSync(file, "utf8");
  const output = await prettier.format(input, { filepath: file });
  fs.writeFileSync(file, output);
  console.log(`FORMAT_BASE64 ${file} ${Buffer.from(output).toString("base64")}`);
}
