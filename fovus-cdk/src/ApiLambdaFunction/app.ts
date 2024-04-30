import express from "express";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { nanoid } from "nanoid";

const TABLE_NAME = process.env.TABLE || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";

const app = express();

const dbClient = new DynamoDBClient({ region: "us-east-1" });

app.post("/", async (req: any, res: any) => {
  try {
    const { input_text, input_file_path } = req.body;

    await dbClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          [PRIMARY_KEY]: { S: nanoid() },
          input_text: { S: input_text },
          input_file_path: { S: input_file_path },
        },
      })
    );

    res.status(200).json({ message: "Success" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default app;
