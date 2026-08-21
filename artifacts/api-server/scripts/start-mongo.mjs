/**
 * start-mongo.mjs — dev-only in-memory MongoDB launcher.
 *
 * Starts a mongodb-memory-server instance (downloads a mongod binary on first
 * run), prints the connection URI on stdout prefixed with MONGODB_URI= so the
 * shell dev entrypoint can capture it, and keeps the process alive.
 */
import { MongoMemoryServer } from "mongodb-memory-server-core";

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, ip: "127.0.0.1" },
});

console.log(`MONGODB_URI=${mongod.getUri("smartbearing")}`);
console.error(`[start-mongo] in-memory MongoDB ready at ${mongod.getUri()}`);

// Keep alive until the parent kills us
setInterval(() => {}, 60_000);
