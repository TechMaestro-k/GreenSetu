import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runDemoScript() {
    const scriptPath = path.resolve(__dirname, '../../frontend/scripts/demo.mjs');
    const { stdout, stderr } = await execAsync(`node ${scriptPath}`);
    return { stdout, stderr };
}
