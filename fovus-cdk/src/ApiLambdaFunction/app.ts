import express from "express";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { nanoid } from "nanoid";
import cors from "cors";

const TABLE_NAME = process.env.TABLE || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";
const REGION = process.env.REGION || "";

const app = express();

const dbClient = new DynamoDBClient({ region: REGION });

app.use(express.json());
app.use(cors());

app.post("/", async (req: any, res: any) => {
  try {
    const { input_text, input_file_path } = req.body;

    if (!input_text || !input_file_path) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    await dbClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          [PRIMARY_KEY]: { S: nanoid() },
          input_text: { S: input_text },
          input_file_path: {
            S: input_file_path,
          },
        },
      })
    );

    res.status(200).json({ message: "Success" });
  } catch (error) {
    res.status(500).json({ error: "Error" });
  }
});

export default app;
