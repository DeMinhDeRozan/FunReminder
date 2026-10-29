import json
import re
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from config import (
    TABLE_NAME, REGION, PK, SK, TASK, STATUS, AUDIO_STATUS, CREATED_AT,
    AUDIO_S3_KEY, AUDIO_VOICE,
)

TZ = ZoneInfo("Australia/Melbourne")


GRACE_SECONDS = 60

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
}

USER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def task_to_text(value):


    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for k in ("S", "task", "Task", "text", "message", "title", "content"):
            if k in value:
                return task_to_text(value[k])
        return json.dumps(value, ensure_ascii=False, default=str)
    if isinstance(value, (list, tuple)):
        return " ".join(task_to_text(v) for v in value)
    return str(value)


def respond(code, body):
    return {
        "statusCode": code,
        "headers": HEADERS,
        "body": json.dumps(body)
    }


def get_method(event):
    return (
        event.get("httpMethod")
        or (event.get("requestContext") or {})
        .get("http", {})
        .get("method")
        or ""
    ).upper()


def lambda_handler(event, context):
    event = event or {}
    method = get_method(event)

    if method == "OPTIONS":
        return respond(200, {})

    if method and method != "GET":
        return respond(405, {"error": "Method not allowed"})

    params = event.get("queryStringParameters") or {}
    user_id = params.get("userId", "")

    if not isinstance(user_id, str) or not USER_ID_RE.fullmatch(user_id):
        print("INVALID_USER_ID:", repr(user_id))
        return respond(400, {"error": "valid userId is required"})

    now = int(datetime.now(TZ).strftime("%Y%m%d%H%M"))

    print(json.dumps({
        "event": "CHECK_START",
        "request_id": getattr(context, "aws_request_id", None),
        "user_id": user_id,
        "now_melbourne": now,
        "method": method
    }))

    query_args = {
        "KeyConditionExpression": (
            Key(PK).eq(user_id)
            & Key(SK).lte(now)
        ),
        "FilterExpression": Attr(STATUS).eq("PENDING")
    }

    matched_items = []

    try:
        page = 0

        while True:
            response = table.query(**query_args)
            page += 1

            items = response.get("Items", [])
            matched_items.extend(items)

            print(json.dumps({
                "event": "QUERY_PAGE",
                "page": page,
                "count": response.get("Count", 0),
                "scanned_count": response.get("ScannedCount", 0),
                "items_found": len(items),
                "has_more": bool(response.get("LastEvaluatedKey"))
            }, default=str))

            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break

            query_args["ExclusiveStartKey"] = last_key

    except ClientError as error:
        print("QUERY_ERROR:", error.response.get("Error", {}))
        return respond(500, {"error": "query failed"})

    reminders = []

    for item in matched_items:
        task = task_to_text(item.get(TASK, ""))
        audio_status = item.get(AUDIO_STATUS, "LEGACY")

        if audio_status == "PENDING":
            try:
                created_at = int(item.get(CREATED_AT, 0) or 0)
            except (TypeError, ValueError):
                created_at = 0

            age = time.time() - created_at


            if age < GRACE_SECONDS:
                print(json.dumps({
                    "event": "AUDIO_NOT_READY",
                    "time": item.get(SK),
                    "age_seconds": int(age)
                }, default=str))
                continue


            print(json.dumps({
                "event": "AUDIO_TIMEOUT",
                "time": item.get(SK),
                "age_seconds": int(age)
            }, default=str))
            audio_status = "FAILED"

        key = {
            PK: item[PK],
            SK: item[SK]
        }

        try:

            table.update_item(
                Key=key,
                UpdateExpression="SET #status = :done",
                ConditionExpression="#status = :pending",
                ExpressionAttributeNames={
                    "#status": STATUS
                },
                ExpressionAttributeValues={
                    ":done": "DONE",
                    ":pending": "PENDING"
                }
            )

            reminder = {
                "task": task,
                "audioStatus": audio_status
            }

            if audio_status == "READY" and item.get(AUDIO_S3_KEY):
                reminder["audioS3Key"] = item.get(AUDIO_S3_KEY, "")
                reminder["audioVoice"] = item.get(AUDIO_VOICE, "")

            reminders.append(reminder)

            print(json.dumps({
                "event": "REMINDER_MARKED_DONE",
                "time": item[SK],
                "audio_status": audio_status,
                "task": task
            }, default=str))

        except ClientError as error:
            error_code = error.response.get("Error", {}).get("Code")

            if error_code == "ConditionalCheckFailedException":
                print(json.dumps({
                    "event": "REMINDER_ALREADY_CLAIMED",
                    "time": item[SK]
                }, default=str))
                continue

            print(json.dumps({
                "event": "UPDATE_ERROR",
                "time": item[SK],
                "error_code": error_code,
                "message": str(error)
            }, default=str))

            return respond(500, {"error": "reminder update failed"})

    print(json.dumps({
        "event": "CHECK_COMPLETE",
        "user_id": user_id,
        "matched": len(matched_items),
        "returned": len(reminders)
    }))

    return respond(200, {"reminders": reminders})
