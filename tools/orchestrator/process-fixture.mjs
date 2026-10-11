// Harmless integration fixture: no network, no financial application writes.
import { Manager } from './core.mjs';
const [root, serialized] = process.argv.slice(2);
const manager = new Manager(root, JSON.parse(serialized), { worker: async () => new Promise(() => {}) });
manager.approve('SIM'); manager.start('SIM');
manager.tick();
process.stdout.write('RUNNING\n');
setInterval(() => {}, 1000);
