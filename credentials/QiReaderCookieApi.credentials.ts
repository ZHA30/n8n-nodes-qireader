import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class QiReaderCookieApi implements ICredentialType {
  name = "qiReaderCookieApi";
  displayName = "QiReader Cookie API";
  icon = {
    light: "file:../nodes/QiReader/qireader.svg",
    dark: "file:../nodes/QiReader/qireader.svg",
  } as const;
  documentationUrl = "https://www.qireader.com/";
  properties: INodeProperties[] = [
    // The Cookie header grants account access and must be treated as a secret.
    // eslint-disable-next-line @n8n/community-nodes/credential-unnecessary-password
    {
      displayName: "Cookie",
      name: "cookie",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description:
        "Cookie request header from a signed-in QiReader browser session",
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: { headers: { Cookie: "={{$credentials.cookie}}" } },
  };
  test: ICredentialTestRequest = {
    request: {
      baseURL: "https://www.qireader.com/api",
      url: "/session/user",
      method: "GET",
      headers: { "x-api-version": "21.0.0" },
    },
  };
}
