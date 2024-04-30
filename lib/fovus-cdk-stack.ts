import * as cdk from "aws-cdk-lib";
import {
  LambdaIntegration,
  MethodLoggingLevel,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { AttributeType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  ApplicationLogLevel,
  LoggingFormat,
  Runtime,
  SystemLogLevel,
} from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
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
    this.createApiGateway(dynamoTable);
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

  private createApiGateway(dynamoTable: Table): RestApi {
    const restApi = new RestApi(this, this.stackName + "RestApi", {
      restApiName: this.stackName + "RestApi",
      cloudWatchRole: true,
      deployOptions: {
        metricsEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      binaryMediaTypes: ["*/*"],
    });

    const apiLambdaRole = new Role(this, this.stackName + "ApiLambdaRole", {
      roleName: this.stackName + "ApiLambdaRole",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    dynamoTable.grantWriteData(apiLambdaRole);

    const apiLambdaLogGroup = new LogGroup(this, this.stackName + "LogGroup", {
      logGroupName: "/aws/lambda/" + this.stackName + "LambdaFunction",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const apiLambdaFunctionProps: NodejsFunctionProps = {
      functionName: this.stackName + "LambdaFunction",
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      depsLockFilePath: join(
        __dirname,
        "..",
        "src",
        "ApiLambdaFunction",
        "package-lock.json"
      ),
      bundling: {
        externalModules: ["aws-sdk", "nano-id"],
      },
      role: apiLambdaRole,
      entry: join(__dirname, "..", "src", "ApiLambdaFunction", "handler.ts"),
      timeout: cdk.Duration.seconds(10),
      loggingFormat: LoggingFormat.JSON,
      systemLogLevel: SystemLogLevel.INFO,
      applicationLogLevel: ApplicationLogLevel.INFO,
      logGroup: apiLambdaLogGroup,
      environment: {
        PRIMARY_KEY: "id",
        TABLE: dynamoTable.tableName,
      },
    };

    const apiLambdaFunction = new NodejsFunction(
      this,
      this.stackName + "ApiLambdaFunction",
      apiLambdaFunctionProps
    );

    restApi.root.addMethod(
      "POST",
      new LambdaIntegration(apiLambdaFunction, {})
    );

    return restApi;
  }
}
