import { createServer } from './api/server.js';
import { config } from './config/index.js';

async function start() {
  try {
    const server = await createServer();

    await server.listen({
      port: config.PORT,
      host: '0.0.0.0'
    });

    console.log(`OneSift server running on port ${config.PORT}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
