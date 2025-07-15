import { app, socketIOServer } from "./app";
import config from "./config";

app.listen(config.apiPort, () => {
  console.log(`Server running on port ${config.apiPort}`);
});

socketIOServer.listen(config.socketPort, () => {
  console.log(`Socket.IO server running on port ${config.socketPort}`);
});
