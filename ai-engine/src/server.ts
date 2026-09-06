import { createServer } from "./api/server.js";

const PORT = Number(process.env.AI_ENGINE_PORT ?? 3001);

const app = createServer();

app.listen(PORT, () => {
  console.log(
    `[AI Engine] HTTP server started on port ${PORT}`,
  );

  console.log(
    `[AI Engine] Health: http://localhost:${PORT}/health`,
  );

  console.log(
    `[AI Engine] Action endpoint: http://localhost:${PORT}/api/ai/action`,
  );
});