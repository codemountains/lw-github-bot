#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LwGithubBotStack } from '../lib/lw-github-bot-stack';

const app = new cdk.App();
new LwGithubBotStack(app, 'LwGithubBotStack', {
    env: { region: "ap-northeast-1" }
});
