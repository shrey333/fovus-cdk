import * as cdk from "aws-cdk-lib";
import { AttributeType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  BucketEncryption,
  CfnBucket,
  CorsRule,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class FovusCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const dynamoTable = this.createDynamoDBTable();
    const bucket = this.createS3Bucket();
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

  private createS3Bucket(): Bucket {
    const bucket = new Bucket(this, this.stackName + "s3Bucket", {
      bucketName: this.stackName + "s3BucketNew",
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const s3CorsRule: CorsRule = {
      allowedHeaders: ["*"],
      allowedMethods: [HttpMethods.POST, HttpMethods.PUT],
      allowedOrigins: ["*"],
      exposedHeaders: [""],
    };
    bucket.addCorsRule(s3CorsRule);

    return bucket;
  }
}
