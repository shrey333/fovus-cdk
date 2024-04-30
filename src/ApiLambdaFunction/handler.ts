const serverlessExpress = require("@codegenie/serverless-express");
import app from "./app";

export const handler = serverlessExpress({ app });
