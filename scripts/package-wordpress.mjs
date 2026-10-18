import { build } from 'vite';
import { cp, mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'ncaa-fencing-wordpress-'));
const plugin = join(temp, 'ncaa-fencing');
const output = join(process.cwd(), 'artifacts', 'ncaa-fencing.zip');
try {
    await cp('wordpress/ncaa-fencing', plugin, { recursive: true });
    await build({ base: './', build: { outDir: join(plugin, 'app'), emptyOutDir: true } });
    // Only the guarded WordPress endpoint serves the HTML entry point.
    const html = await readFile(join(plugin, 'app/index.html'), 'utf8');
    await writeFile(join(plugin, 'entry.php'), '<?php exit; ?>\n' + html);
    await rm(join(plugin, 'app/index.html'));
    await mkdir(join(process.cwd(), 'artifacts'), { recursive: true });
    await rm(output, { force: true });
    execFileSync('zip', ['-qr', output, 'ncaa-fencing'], { cwd: temp });
    console.log(`WordPress plugin: ${output}`);
} finally {
    await rm(temp, { recursive: true, force: true });
}
