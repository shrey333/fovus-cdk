import * as cdk from "aws-cdk-lib";
import {
  LambdaIntegration,
  MethodLoggingLevel,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { AttributeType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  CfnInstanceProfile,
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
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
import { CfnPipe } from "aws-cdk-lib/aws-pipes";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  BucketEncryption,
  CorsRule,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { DefinitionBody, StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import { join } from "path";

export class FovusCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const dynamoTable = this.createDynamoDBTable();

    const bucket = this.createS3Bucket();
    this.uploadScriptToS3(bucket);

    this.createApiGateway(dynamoTable);

    const stateMachine = this.createStepFunction(dynamoTable, bucket);

    this.createPipe(dynamoTable, stateMachine);
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

  private createStepFunction(dynamoTable: Table, bucket: Bucket): StateMachine {
    const ec2Role = new Role(this, this.stackName + "EC2Role", {
      roleName: this.stackName + "EC2Role",
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });

    dynamoTable.grantReadWriteData(ec2Role);
    bucket.grantReadWrite(ec2Role);

    const instanceProfile = new CfnInstanceProfile(
      this,
      this.stackName + "InstanceProfile",
      {
        instanceProfileName: this.stackName + "InstanceProfile",
        roles: [ec2Role.roleName],
      }
    );

    const stepFunctions = {
      StartAt: "StartEC2Instance",
      States: {
        StartEC2Instance: {
          Type: "Task",
          Resource: "arn:aws:states:::aws-sdk:ec2:runInstances",
          Parameters: {
            ImageId: "ami-080e1f13689e07408",
            InstanceType: "t2.micro",
            MinCount: 1,
            MaxCount: 1,
            IamInstanceProfile: { Arn: instanceProfile.attrArn },
            Monitoring: { Enabled: true },
            InstanceInitiatedShutdownBehavior: "terminate",
            "UserData.$": `States.Base64Encode(States.Format('#!/bin/bash\nsudo apt-get update -y\nsudo apt install python3-pip unzip -y\npip install boto3\ncurl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"\nunzip awscliv2.zip\nsudo ./aws/install\naws s3 cp s3://fovus-stack-s3-bucket/python_script.py python_script.py\npython3 python_script.py {} ${dynamoTable.tableName}\nshutdown -h now', $.id))`,
          },
          End: true,
          InputPath: "$[0]",
        },
      },
    };

    const stateMachineRole = new Role(
      this,
      this.stackName + "StateMachineRole",
      {
        roleName: this.stackName + "StateMachineRole",
        assumedBy: new ServicePrincipal("states.amazonaws.com"),
        inlinePolicies: {
          EC2Policy: new PolicyDocument({
            statements: [
              new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                  "ec2:RunInstances",
                  "ec2:CreateTags",
                  "iam:PassRole",
                  "ssm:GetParameters",
                ],
                resources: ["*"],
              }),
            ],
          }),
        },
      }
    );

    return new StateMachine(this, this.stackName + "StateMachine", {
      stateMachineName: this.stackName + "StateMachine",
      definitionBody: DefinitionBody.fromString(JSON.stringify(stepFunctions)),
      role: stateMachineRole,
    });
  }

  private createPipe(dynamoTable: Table, stateMachine: StateMachine): CfnPipe {
    const pipeRole = new Role(this, this.stackName + "PipeRole", {
      roleName: this.stackName + "PipeRole",
      assumedBy: new ServicePrincipal("pipes.amazonaws.com"),
    });

    dynamoTable.grantStreamRead(pipeRole);
    dynamoTable.grantStream(pipeRole);
    stateMachine.grantStartExecution(pipeRole);

    const eventBridgeLogGroup = new LogGroup(
      this,
      this.stackName + "PipeLogGroup",
      {
        logGroupName: "/aws/events/" + this.stackName + "LogGroup",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    return new CfnPipe(this, this.stackName + "Pipe", {
      name: this.stackName + "Pipe",
      logConfiguration: {
        cloudwatchLogsLogDestination: {
          logGroupArn: eventBridgeLogGroup.logGroupArn,
        },
        level: "INFO",
      },
      roleArn: pipeRole.roleArn,
      source: dynamoTable.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          batchSize: 1,
          startingPosition: "LATEST",
        },
        filterCriteria: {
          filters: [
            {
              pattern: JSON.stringify({ eventName: ["INSERT"] }),
            },
          ],
        },
      },
      target: stateMachine.stateMachineArn,
      targetParameters: {
        stepFunctionStateMachineParameters: {
          invocationType: "FIRE_AND_FORGET",
        },
        inputTemplate: JSON.stringify({ id: "<$.dynamodb.Keys.id.S>" }),
      },
    });
  }
}
