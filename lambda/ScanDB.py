
import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

TABLE_NAME = "..."
REGION = "ap-southeast-2"
TZ = ZoneInfo("Australia/Melbourne")

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
            Key("UserID").eq(user_id)
            & Key("Time").lte(now)
        ),
        "FilterExpression": Attr("Status").eq("PENDING")
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
        task = item.get("Task", "")
        key = {
            "UserID": item["UserID"],
            "Time": item["Time"]
        }

        try:
            table.update_item(
                Key=key,
                UpdateExpression="SET #status = :done",
                ConditionExpression="#status = :pending",
                ExpressionAttributeNames={
                    "#status": "Status"
                },
                ExpressionAttributeValues={
                    ":done": "DONE",
                    ":pending": "PENDING"
                }
            )

            reminders.append(task)

            print(json.dumps({
                "event": "REMINDER_MARKED_DONE",
                "time": item["Time"],
                "task": task
            }, default=str))

        except ClientError as error:
            error_code = error.response.get("Error", {}).get("Code")

            if error_code == "ConditionalCheckFailedException":
                print(json.dumps({
                    "event": "REMINDER_ALREADY_CLAIMED",
                    "time": item["Time"]
                }, default=str))
                continue

            print(json.dumps({
                "event": "UPDATE_ERROR",
                "time": item["Time"],
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
