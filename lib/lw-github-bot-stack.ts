import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {EndpointType, LambdaIntegration, RestApi} from "aws-cdk-lib/aws-apigateway";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import {CfnOutput, Duration} from "aws-cdk-lib";
import {Runtime} from "aws-cdk-lib/aws-lambda";

export class LwGithubBotStack extends cdk.Stack {
    private restApi: RestApi;
    private lwGithubWebhookLambda: NodejsFunction;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        this.buildLambdaFunction();
        this.buildRestApi();

        new CfnOutput(this, "REST API URL", { value: `${this.restApi.url}github-webhooks` });
    }

    private buildLambdaFunction() {
        this.lwGithubWebhookLambda = new NodejsFunction(this, "LwGithubWebhookLambda", {
            runtime: Runtime.NODEJS_16_X,
            entry: path.join(__dirname, "..", "lambda", "GithubWebhookFunc.ts"),
            handler: "handler",
            timeout: Duration.seconds(20)
        });
    }

    private buildRestApi() {
        this.restApi = new RestApi(this, "LwGithubWebhookRestApi", {
            endpointTypes: [EndpointType.REGIONAL],
        });

        const addSub = this.restApi.root.addResource("github-webhooks");
        addSub.addMethod(
            "POST",
            new LambdaIntegration(this.lwGithubWebhookLambda, {
                proxy: true,
                timeout: this.lwGithubWebhookLambda.timeout,
            })
        );
    }
}
