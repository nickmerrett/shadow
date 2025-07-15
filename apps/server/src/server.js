"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = __importDefault(require("./config"));
app_1.app.listen(config_1.default.apiPort, () => {
    console.log(`Server running on port ${config_1.default.apiPort}`);
});
app_1.socketIOServer.listen(config_1.default.socketPort, () => {
    console.log(`Socket.IO server running on port ${config_1.default.socketPort}`);
});
