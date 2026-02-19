import fs from "node:fs";
import path from "node:path";

const artifactsDir = path.join(__dirname, "..", "contracts", "artifacts");

describe("ContractSupply build", () => {
    it("produces at least one ARC spec", () => {
        const exists = fs.existsSync(artifactsDir);
        expect(exists).toBe(true);

        const files = fs.readdirSync(artifactsDir);
        const hasArcSpec = files.some((file) => file.endsWith(".arc32.json") || file.endsWith(".arc56.json"));
        expect(hasArcSpec).toBe(true);
    });
});
