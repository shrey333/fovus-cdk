import * as cdk from "aws-cdk-lib";
import { AttributeType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class FovusCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.createDynamoDBTable();
  }

  private createDynamoDBTable(): Table {
    return new Table(this, this.stackName + "DynamoDB", {
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
      tableName: this.stackName + "DynamoDB",
      stream: StreamViewType.NEW_IMAGE,
    });
  }
}
