# Meta App Review Submission

## Requested permissions

- `public_profile`: identify the Meta user who connects the business account.
- `email`: show the connected user's email for account confirmation and support.
- `business_management`: list and select the user's Business Manager / business portfolio assets.
- `whatsapp_business_management`: list WhatsApp Business Accounts, phone numbers, and message templates owned by the selected business.
- `whatsapp_business_messaging`: send WhatsApp messages through the Cloud API using approved templates and receive customer replies through webhooks.

## Permissions removed for this submission

- `manage_app_solution`: not requested now. This permission will only be requested after Access Verification is completed.
- `whatsapp_business_manage_events`: not requested now. This permission will only be requested after advanced access for `whatsapp_business_messaging` is approved and the app meets Meta's dependency requirements.

## Environment variables required

- `NEXT_PUBLIC_FACEBOOK_APP_ID`: Meta app ID used for the visible Meta OAuth flow.
- `META_OAUTH_REDIRECT_ORIGIN`: optional public app origin used to build the Meta OAuth callback URL, for example `https://app.example.com`. Use this when testing behind Vercel, ngrok, a tunnel, or any public domain that differs from the incoming local request origin.
- `NEXT_PUBLIC_APP_URL`: optional public app URL fallback used for the Meta OAuth callback URL when `META_OAUTH_REDIRECT_ORIGIN` is not set.
- `FACEBOOK_APP_SECRET`: server-only app secret used to exchange OAuth codes and validate webhook signatures.
- `FACEBOOK_SYSTEM_USER_TOKEN`: optional server-side System User token used for server-to-server Graph API calls. Never expose this as a `NEXT_PUBLIC_` variable.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: optional shared webhook verification token. Connection-specific verify tokens are also supported.
- `META_GRAPH_VERSION`: optional Graph API version override. Defaults to `v19.0`.
- `WA_DATA_DIR`: optional local persistence directory for review state, logs, and webhook inbox events.

## Screencast checklist

1. Open the app and click Continue with Meta.
2. Grant requested permissions.
3. Select Business Manager.
4. Select WhatsApp Business Account.
5. Select WhatsApp Phone Number.
6. Open Message Templates and select an approved template.
7. Send a WhatsApp test message to a real WhatsApp number.
8. Open WhatsApp and show the received message.
9. Reply from WhatsApp.
10. Return to the app and show the received reply in Inbox/Webhook Logs.

## App Review text

Our app allows a business user to connect their Meta Business account and WhatsApp Business Account, select a WhatsApp phone number, manage message templates, send WhatsApp messages using approved templates, and receive customer replies in the app inbox.

The screencast demonstrates the complete flow:
1. Meta Login and permission consent.
2. Selecting the Business Manager, WhatsApp Business Account, and WhatsApp phone number.
3. Listing and managing WhatsApp message templates.
4. Sending a WhatsApp message from the app to a real WhatsApp user.
5. Receiving the customer reply from WhatsApp through webhooks and displaying it inside the app inbox.

The requested permissions are used only to let the authenticated business user manage their own WhatsApp Business assets and messaging workflow.

We are not requesting manage_app_solution or whatsapp_business_manage_events in this submission. Those will be requested later only after the required Access Verification and advanced access requirements are completed.

## Where reviewers can see each requirement

- Meta Login and consent: Mensageria -> Meta Review Demo -> Continue with Meta.
- Business Manager selection: Step 2 in the Meta Review Demo tab.
- WhatsApp Business Account selection: Step 3 in the Meta Review Demo tab.
- WhatsApp phone number selection: Step 4 in the Meta Review Demo tab.
- Message template management: Message Templates panel in the Meta Review Demo tab.
- Real template message sending: Send Test WhatsApp Message panel.
- Webhook customer reply receiving: Inbox / Webhook Logs panel.
- Safe integration logs: Integration Logs panel.
- Public privacy policy: `/privacy`.
