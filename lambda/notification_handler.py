"""
lambda/notification_handler.py
──────────────────────────────
AWS Lambda function that:
  1. Accepts a student profile (major, year, status) in the POST body
  2. Builds a natural-language query from the profile
  3. Calls Amazon Bedrock Knowledge Base (retrieve_and_generate) to fetch
     matching campus resources from the connected S3 knowledge base
  4. Returns a single, student-friendly notification string

Deploy as a Lambda Function URL (auth type: AWS_IAM or NONE for dev).
Runtime: Python 3.12   Memory: 256 MB   Timeout: 30 s
"""

import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Configuration (set these as Lambda environment variables) ──────────────
KNOWLEDGE_BASE_ID = os.environ["BEDROCK_KNOWLEDGE_BASE_ID"]   # e.g. "ABCDE12345"
MODEL_ARN = os.environ.get(
    "BEDROCK_MODEL_ARN",
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
)
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

bedrock_agent_runtime = boto3.client(
    "bedrock-agent-runtime", region_name=AWS_REGION
)


# ── CORS headers for browser → Lambda Function URL calls ──────────────────
CORS_HEADERS = {
    "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def lambda_handler(event: dict, context) -> dict:
    """Entry point for API Gateway / Lambda Function URL."""

    # Handle preflight OPTIONS
    http_method = (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", event.get("httpMethod", "POST"))
    )
    if http_method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    # ── 1. Parse student profile from request body ─────────────────────
    try:
        body = event.get("body", "{}")
        if isinstance(body, str):
            body = json.loads(body)

        major  = body.get("major",  "").strip()
        year   = body.get("year",   "").strip()
        status = body.get("status", "").strip()

        if not (major and year and status):
            return _error(400, "Missing required fields: major, year, status")

    except (json.JSONDecodeError, AttributeError) as exc:
        logger.error("Bad request body: %s", exc)
        return _error(400, "Invalid JSON body")

    # ── 2. Build a targeted query for the knowledge base ──────────────
    query = (
        f"What campus resources, upcoming deadlines, financial aid notices, "
        f"tutoring services, and announcements are most relevant for a "
        f"{year} {status} student majoring in {major}? "
        f"Provide a concise, actionable one-sentence notification."
    )
    logger.info("KB query: %s", query)

    # ── 3. Call Bedrock Knowledge Base (retrieve + generate) ──────────
    try:
        response = bedrock_agent_runtime.retrieve_and_generate(
            input={"text": query},
            retrieveAndGenerateConfiguration={
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": {
                    "knowledgeBaseId": KNOWLEDGE_BASE_ID,
                    "modelArn": MODEL_ARN,
                    "generationConfiguration": {
                        "promptTemplate": {
                            "textPromptTemplate": (
                                "You are a helpful college advisor. "
                                "Using only the retrieved campus documents, "
                                "write ONE friendly, specific sentence that "
                                "lets the student know about the most time-sensitive "
                                "or relevant resource available to them right now.\n\n"
                                "$search_results$"
                            )
                        },
                        "inferenceConfig": {
                            "textInferenceConfig": {
                                "maxTokens": 150,
                                "temperature": 0.3,
                            }
                        },
                    },
                    "retrievalConfiguration": {
                        "vectorSearchConfiguration": {
                            "numberOfResults": 5,
                            "overrideSearchType": "HYBRID",
                        }
                    },
                },
            },
        )

        notification = (
            response
            .get("output", {})
            .get("text", "")
            .strip()
        )

        if not notification:
            notification = _default_notification(major, year)

    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        logger.error("Bedrock ClientError [%s]: %s", error_code, exc)

        # Graceful degradation — return a generic message rather than a 500
        notification = _default_notification(major, year)

    except Exception as exc:
        logger.error("Unexpected error calling Bedrock: %s", exc)
        notification = _default_notification(major, year)

    # ── 4. Return notification to Next.js ─────────────────────────────
    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps({"notification": notification}),
    }


# ── Helpers ──────────────────────────────────────────────────────────────

def _default_notification(major: str, year: str) -> str:
    """Fallback used when Bedrock is unreachable or returns an empty response."""
    return (
        f"Welcome back, {year} {major} student! "
        "Visit the Student Services portal for the latest campus resources and deadlines."
    )


def _error(status: int, message: str) -> dict:
    return {
        "statusCode": status,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps({"error": message}),
    }
