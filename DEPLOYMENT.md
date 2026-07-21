# GoldenWestBanner — Deployment Guide
## AWS Lambda + Bedrock Knowledge Base Setup

---

## 1. Prerequisites

| Tool | Version |
|------|---------|
| AWS CLI | ≥ 2.13 |
| Python  | 3.12    |
| Node.js | ≥ 20    |

---

## 2. Bedrock Knowledge Base — one-time setup

### 2a. S3 bucket for campus resources
```bash
aws s3 mb s3://golden-west-campus-resources --region us-east-1
# Upload your resource documents (PDF, TXT, DOCX)
aws s3 cp ./campus-resources/ s3://golden-west-campus-resources/ --recursive
```

### 2b. Create the Knowledge Base
1. Open **Amazon Bedrock → Knowledge bases → Create knowledge base**
2. Name: `GoldenWestCampusKB`
3. Data source: S3 — `s3://golden-west-campus-resources`
4. Embeddings model: **Amazon Titan Embeddings V2**
5. Vector store: **Amazon OpenSearch Serverless** (managed, no setup needed)
6. Copy the **Knowledge Base ID** — you'll need it below.

---

## 3. IAM Role for the Lambda function

Create a role `golden-west-notification-lambda-role` with the policy below.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockRetrieveAndGenerate",
      "Effect": "Allow",
      "Action": [
        "bedrock:RetrieveAndGenerate",
        "bedrock:Retrieve",
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
        "arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:knowledge-base/<KNOWLEDGE_BASE_ID>"
      ]
    },
    {
      "Sid": "S3ReadCampusResources",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::golden-west-campus-resources",
        "arn:aws:s3:::golden-west-campus-resources/*"
      ]
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

Trust relationship (allows Lambda to assume the role):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

---

## 4. Deploy the Lambda function

```bash
cd lambda

# Package
zip notification_handler.zip notification_handler.py

# Create function  (replace placeholders)
aws lambda create-function \
  --function-name GoldenWestNotification \
  --runtime python3.12 \
  --role arn:aws:iam::<ACCOUNT_ID>:role/golden-west-notification-lambda-role \
  --handler notification_handler.lambda_handler \
  --zip-file fileb://notification_handler.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{
    BEDROCK_KNOWLEDGE_BASE_ID=<KNOWLEDGE_BASE_ID>,
    BEDROCK_MODEL_ARN=arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0,
    ALLOWED_ORIGIN=https://your-next-app.vercel.app
  }" \
  --region us-east-1

# Enable a Function URL (no API Gateway needed)
aws lambda create-function-url-config \
  --function-name GoldenWestNotification \
  --auth-type NONE \
  --region us-east-1
```

> **Security note:** `NONE` auth is fine while developing. For production,
> switch to `AWS_IAM` and sign requests from the Next.js server using
> `@aws-sdk/signature-v4`. That keeps the endpoint private — only your
> server can call it.

Copy the `FunctionUrl` from the output.

---

## 5. Configure the Next.js app

Create `.env.local` in the repo root:

```
# Server-side only — never commit this file
LAMBDA_NOTIFICATION_URL=https://<id>.lambda-url.us-east-1.on.aws/

# Public base URL used by the TopBanner server component
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For Vercel deployment, add both vars in
**Project Settings → Environment Variables**.

---

## 6. Run the Next.js dev server

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## 7. Update the Lambda after code changes

```bash
cd lambda
zip notification_handler.zip notification_handler.py
aws lambda update-function-code \
  --function-name GoldenWestNotification \
  --zip-file fileb://notification_handler.zip \
  --region us-east-1
```

---

## Architecture at a glance

```
Browser
  │  GET /
  ▼
Next.js Server (page.tsx)
  │  Suspense → <TopBanner>
  │    POST /api/notification
  ▼
Next.js API Route (route.ts)  ← server-side only, hides Lambda URL
  │    POST Lambda Function URL
  ▼
AWS Lambda (notification_handler.py)
  │    retrieve_and_generate()
  ▼
Amazon Bedrock Knowledge Base
  │    vector search → S3 campus docs
  ▼
Bedrock LLM (Claude 3 Haiku)
  │    generates one personalised sentence
  └──► JSON { "notification": "..." }  ──► banner renders on page
```
