import app from "./app";
import { env } from "./config/env";


app.listen(env.PORT, () => {
    console.log(`Smart Prepaid Parking API is running on port ${env.PORT}`);
});