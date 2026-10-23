/** Startup checks shared by local development and isolated verification. */
import net from 'node:net';

const [action, ...args] = process.argv.slice(2);
try {
  if (action === 'check') {
    const ports = args.map(Number);
    if (!ports.length || new Set(ports).size !== ports.length ||
        ports.some(port => !Number.isInteger(port) || port < 1024 || port > 65535)) {
      throw new Error('Choose distinct port numbers between 1024 and 65535.');
    }
    for (const port of ports) {
      await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', () => reject(new Error(`Port ${port} is unavailable. Stop the existing service or choose different ports; see docs/DEPLOYMENT.md.`)));
        server.listen(port, '127.0.0.1', () => server.close(resolve));
      });
    }
  } else if (action === 'wait') {
    const [pid, url] = args;
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      try { process.kill(Number(pid), 0); }
      catch { throw new Error('The server exited during startup. Check its log above or in the verification logs directory.'); }
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (response.ok) { ready = true; break; }
      } catch { /* The process is alive but may still be initializing. */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`Server did not become ready at ${url}. Check its startup log.`);
  } else {
    throw new Error('Usage: local-server.mjs check PORT... | wait PID URL');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
