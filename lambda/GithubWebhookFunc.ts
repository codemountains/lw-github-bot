import {APIGatewayProxyEvent, APIGatewayProxyHandler} from "aws-lambda";
import SecretType from "./types/Secret.type";
import * as jwt from "jsonwebtoken";
import axios from "axios";
import UserAccountAuthType from "./types/AccessToken.type";

// @ts-ignore
const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
    console.info(event);

    const githubEvent = event.headers["X-GitHub-Event"];
    if (githubEvent !== "ping" && githubEvent !== "push") {
        return {
            statusCode: 400,
        };
    }

    // '204 No Content' returned on event when setting up Webhook.
    if (githubEvent === "ping") {
        return {
            statusCode: 204,
        };
    }

    const query = event.queryStringParameters;
    if (query === null) {
        return {
            statusCode: 400,
        };
    }
    const channelId = query.channelId;
    if (channelId === undefined) {
        return {
            statusCode: 400,
        };
    }

    const requestBody = event.body;
    console.info(requestBody);

    if (requestBody === null) {
        return {
            statusCode: 400,
        };
    }

    const webhookBody: {
        repository: {
            name: string;
        };
        pusher: {
            name: string;
        };
        compare: string;
    } = JSON.parse(requestBody);

    const secret = init();
    const accessToken = await genAccessToken(secret);

    const text = `${webhookBody.pusher.name} committed in ${webhookBody.repository.name} repository.`;
    await sendMessageWithActions(accessToken, secret.lineWorksBotId, channelId, text, webhookBody.compare);

    return {
        statusCode: 201,
    };
};

const init = (): SecretType => {
    return {
        lineWorksBotId: process.env.LINE_WORKS_BOT_ID ?? "",
        lineWorksClientId: process.env.LINE_WORKS_CLIENT_ID ?? "",
        lineWorksClientSecret: process.env.LINE_WORKS_CLIENT_SECRET ?? "",
        lineWorksDomainId: process.env.LINE_WORKS_DOMAIN_ID ?? "",
        lineWorksPrivateKey: process.env.LINE_WORKS_PRIVATE_KEY ?? "",
        lineWorksServiceAccount: process.env.LINE_WORKS_SERVICE_ACCOUNT ?? ""
    }
}

/**
 * Generate JWT
 * @param secret {SecretType} Secret in environment variables
 */
const genJwt = (secret: SecretType): string => {
    const payload = {
        iss: secret.lineWorksClientId,
        sub: secret.lineWorksServiceAccount,
        iat: Date.now(),
        exp: Date.now() + 3600,
    };
    const privateKey = secret.lineWorksPrivateKey.replace(/\\n/g, '\n');

    return jwt.sign(payload, privateKey, {algorithm: "RS256"});
}

/**
 * Generate Access token
 * @param secret {SecretType} Secret in environment variables
 */
const genAccessToken = async (secret: SecretType): Promise<string> => {
    const jwt = genJwt(secret);

    const params = new URLSearchParams({
        assertion: jwt,
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        client_id: secret.lineWorksClientId,
        client_secret: secret.lineWorksClientSecret,
        scope: "bot",
    });

    const response = await axios.post("https://auth.worksmobile.com/oauth2/v2.0/token", params);
    const auth = response.data as UserAccountAuthType;

    return auth.access_token;
}

/**
 * Send a message with action to the talk room
 * @param accessToken {string} access token
 * @param botId {string} bot id
 * @param channelId {string} channel id
 * @param text {string} text message
 * @param uri {string} GitHub comparing changes URL
 */
const sendMessageWithActions = async (
    accessToken: string,
    botId: string,
    channelId: string,
    text: string,
    uri :string,
): Promise<void> => {
    try {
        const headers = {
            Authorization: `Bearer ${accessToken}`
        }

        const url = `https://www.worksapis.com/v1.0/bots/${botId}/channels/${channelId}/messages`;
        const response = await axios.post(url, {
            content: {
                type: "button_template",
                contentText: text,
                actions: [{
                    type: "uri",
                    label: "Comparing changes",
                    uri: uri
                }]
            }
        }, { headers });
        console.info(response);
    } catch(error) {
        console.error(error);
    }
}

export { handler };
