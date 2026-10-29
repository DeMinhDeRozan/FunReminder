import json
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from config import (
    TABLE_NAME, INDEX_NAME, REGION, PK, SK, TASK, STATUS, NOTIFIED_BY,
)

TZ = ZoneInfo("Australia/Melbourne")
GRACE_MINUTES = 2
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)
sns = boto3.client("sns", region_name=REGION)


def fmt_time(t):
    s = str(int(t))
    return f"{s[8:10]}:{s[10:12]}"


def lambda_handler(event, context):
    cutoff_dt = datetime.now(TZ) - timedelta(minutes=GRACE_MINUTES)
    cutoff = int(cutoff_dt.strftime("%Y%m%d%H%M"))

    query_args = {
        "IndexName": INDEX_NAME,
        "KeyConditionExpression": Key(STATUS).eq("PENDING") & Key(SK).lte(cutoff),
    }

    items = []
    while True:
        res = table.query(**query_args)
        items.extend(res.get("Items", []))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_args["ExclusiveStartKey"] = last_key

    sent = 0
    for item in items:
        key = {PK: item[PK], SK: item[SK]}

        try:
            table.update_item(
                Key=key,
                UpdateExpression="SET #s = :done, #nb = :who",
                ConditionExpression="#s = :pending",
                ExpressionAttributeNames={"#s": STATUS, "#nb": NOTIFIED_BY},
                ExpressionAttributeValues={
                    ":done": "DONE",
                    ":pending": "PENDING",
                    ":who": "sweeper",
                },
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                continue
            print("UPDATE_ERROR:", e.response["Error"])
            continue

        message = f"{item.get(TASK, 'Reminder')} (due {fmt_time(item[SK])})"

        try:
            if SNS_TOPIC_ARN:
                sns.publish(
                    TopicArn=SNS_TOPIC_ARN,
                    Subject="Missed reminder",
                    Message=message,
                )
            sent += 1
        except ClientError as e:

            print("SNS_ERROR:", e.response["Error"])
            table.update_item(
                Key=key,
                UpdateExpression="SET #s = :pending",
                ExpressionAttributeNames={"#s": STATUS},
                ExpressionAttributeValues={":pending": "PENDING"},
            )

    print(json.dumps({"cutoff": cutoff, "found": len(items), "sent": sent}))
    return {"found": len(items), "sent": sent}
