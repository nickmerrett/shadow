import express from "express";
import { errorHandler } from "./middleware/error-handler";

const app = express();

app.use(express.json());

/* ROUTES */
// app.use("/api/items", itemRoutes);

app.use(errorHandler);

export default app;
