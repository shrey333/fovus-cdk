# Fovus


https://github.com/shrey333/fovus-cdk/assets/53311728/f2025439-3e9b-4830-9b85-6df353e0378f



## This project is divided into 2 parts:

1. CDK
2. React app

## To set up 1st part, you can follow the below steps:

1. Follow this guide to set up your local AWS CLI environment using AWS IAM Identity Center authentication.
2. Run this command to install typescript and aws-cdk globally:
   `npm -g install typescript aws-cdk `
3. Change your directory to “fovus-cdk” folder.  
   `cd focus-cdk`
4. Install the required dependencies to run the project.  
   `npm i`
5. Bootstrap your cdk environment. (<https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_bootstrap>)  
   `cdk bootstrap aws://ACCOUNT-NUMBER/REGION`
6. Build a project.  
   `npm run build`
7. Deploy project  
   `cdk deploy`

Note: You might need the docker engine running to compile the lambda function.

## To set up 2nd part, you can follow the below steps:

1. Change your directory to “fovus-react” folder.
   `cd focus-react`
2. Fill up the environment file (for example env file as specified as .env.example)
3. Install the required dependencies to run the project.
   `npm i`
4. Run project
   `npm run dev`

The compiled project is live at <https://main.d3v1kbyvlhae0e.amplifyapp.com/> using AWS Amplify hosting.

## References

https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway-readme.html

https://caesar-jd-bell.medium.com/unleash-the-power-of-aws-cdk-http-api-gateway-aws-lambda-and-sam-cli-1cf589c7e9e1

https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-dynamodb.html

https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-event-filtering.html

https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html

https://medium.com/@arbnair97/automating-aws-ec2-instance-start-stop-state-using-aws-lambda-python-and-aws-eventbridge-ad235d4a139b

https://github.com/aws/aws-cdk-rfcs/issues/473
