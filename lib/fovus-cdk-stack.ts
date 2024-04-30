import * as cdk from "aws-cdk-lib";
import { AttributeType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  BucketEncryption,
  CorsRule,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { join } from "path";

export class FovusCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const dynamoTable = this.createDynamoDBTable();
    const bucket = this.createS3Bucket();
    this.uploadScriptToS3(bucket);
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

  private uploadScriptToS3(bucket: Bucket): void {
    new BucketDeployment(this, this.stackName + "BucketDeployment", {
      sources: [Source.asset(join(__dirname, "..", "scripts"))],
      destinationBucket: bucket,
    });
  }
}
