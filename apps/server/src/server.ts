import { app } from "./app";

const API_PORT = 4000;

app.listen(API_PORT, () => {
  console.log(`Server running on port ${API_PORT}`);
});
