import type {
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IHttpRequestHelper,
  IHttpRequestOptions,
  INodeProperties,
} from "n8n-workflow";

export class QiReaderApi implements ICredentialType {
  name = "qiReaderApi";
  displayName = "QiReader Account API";
  icon = {
    light: "file:../nodes/QiReader/qireader.svg",
    dark: "file:../nodes/QiReader/qireader.svg",
  } as const;
  documentationUrl = "https://www.qireader.com/";
  properties: INodeProperties[] = [
    {
      displayName: "Email",
      name: "email",
      type: "string",
      default: "",
      required: true,
    },
    {
      displayName: "Password",
      name: "password",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
    },
    {
      displayName: "Session",
      name: "session",
      type: "hidden",
      typeOptions: { expirable: true },
      default: "",
    },
  ];
  async preAuthentication(
    this: IHttpRequestHelper,
    credentials: ICredentialDataDecryptedObject,
  ) {
    const response = await this.helpers.httpRequest({
      method: "POST",
      url: "https://www.qireader.com/api/session",
      headers: { "x-api-version": "21.0.0" },
      body: { email: credentials.email, password: credentials.password },
      json: true,
      returnFullResponse: true,
    });
    const raw = response.headers["set-cookie"];
    const cookies = (Array.isArray(raw) ? raw : raw ? [raw] : [])
      .map((value: string) => value.split(";", 1)[0])
      .filter(Boolean);
    if (!cookies.length)
      throw new Error("QiReader login did not return a session cookie");
    return { session: cookies.join("; ") };
  }
  async authenticate(
    credentials: ICredentialDataDecryptedObject,
    options: IHttpRequestOptions,
  ): Promise<IHttpRequestOptions> {
    options.headers = {
      ...options.headers,
      Cookie: String(credentials.session),
    };
    return options;
  }
  test: ICredentialTestRequest = {
    request: {
      baseURL: "https://www.qireader.com/api",
      url: "/session/user",
      method: "GET",
      headers: { "x-api-version": "21.0.0" },
    },
  };
}
