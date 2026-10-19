import json
import os
import random
import re
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import boto3
import botocore.exceptions

TABLE_NAME = os.environ.get('TABLE_NAME', 'RemindYouBro')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-southeast-2')
BEDROCK_REGION = os.environ.get('BEDROCK_REGION', 'us-east-1')
MODEL_ID = os.environ.get('MODEL_ID', 'us.anthropic.claude-haiku-4-5-20251001-v1:0')
DAILY_TOKEN_LIMIT = int(os.environ.get('DAILY_TOKEN_LIMIT', 10000))
TZ = ZoneInfo(os.environ.get('TIMEZONE', 'Australia/Melbourne'))

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)
bedrock = boto3.client(service_name='bedrock-runtime', region_name=BEDROCK_REGION)

TIME_HINT = re.compile(
    r"\d|\b(min|mins|minute|minutes|hour|hours|hr|hrs|tomorrow|tonight|today|noon|midnight|"
    r"morning|afternoon|evening|night|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|"
    r"thursday|friday|saturday|sunday|half|quarter|next)\b", re.I)

OFFTOPIC_REPLIES = []

WHO_ARE_YOU = re.compile(
    r"\b(who\s*(are|r)\s*(you|u|ya)|who\s*is\s*this|who\s*dis|what\s*(are|r)\s*(you|u|ya)|"
    r"what'?s\s*(your|ur)\s*name|what\s*is\s*(your|ur)\s*name|your\s*name|ur\s*name|"
    r"introduce\s*yourself|tell\s*me\s*about\s*yourself)\b", re.I)

WHO_REPLIES = []

SYSTEM_PROMPT_TEMPLATE = ""

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Content-Type': 'application/json'
}


def respond(code, message):
    return {
        'statusCode': code,
        'headers': HEADERS,
        'body': json.dumps({'message': message})
    }


def build_system_prompt(now):
    return (SYSTEM_PROMPT_TEMPLATE
            .replace('__NOW__', now.strftime('%Y-%m-%d %H:%M'))
            .replace('__WEEKDAY__', now.strftime('%A')))


def resolve_datetime(data, now):
    time_str = str(data.get('time', '')).strip()
    date_str = str(data.get('date', '')).strip() or now.strftime('%Y-%m-%d')

    try:
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    except ValueError:
        try:
            dt = datetime.strptime(f"{now.strftime('%Y-%m-%d')} {time_str}", "%Y-%m-%d %H:%M")
        except ValueError:
            return None

    dt = dt.replace(tzinfo=TZ)

    if dt < now - timedelta(minutes=1) and dt.date() == now.date():
        dt = dt + timedelta(days=1)

    return dt


def lambda_handler(event, context):
    event = event or {}

    if event.get('httpMethod') == 'OPTIONS':
        return respond(200, 'OK')

    try:
        raw_body = event.get('body') or '{}'
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        chat_id = str(body.get('user_id', 'web_user'))
        user_text = str(body.get('task_input', ''))[:150]

        if not user_text.strip():
            return respond(200, 'No input')

        if WHO_ARE_YOU.search(user_text):
            return respond(200, random.choice(WHO_REPLIES) if WHO_REPLIES else "Hello!")

        if not TIME_HINT.search(user_text):
            return respond(200, random.choice(OFFTOPIC_REPLIES) if OFFTOPIC_REPLIES else "Please provide a task and a time.")

        melbourne_now = datetime.now(TZ)
        today_str = melbourne_now.strftime('%Y%m%d')
        token_key = f"TOKEN_USAGE_{today_str}"

        try:
            usage_res = table.get_item(Key={'UserID': token_key, 'Time': 0})
            current_tokens = int(usage_res.get('Item', {}).get('TotalTokens', 0))
            if current_tokens >= DAILY_TOKEN_LIMIT:
                return respond(429, '⚠️ Limit reached for today. Try again tomorrow!')
        except Exception as e:
            print("TOKEN_CHECK_ERROR:", repr(e))

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 400,
                "temperature": 0.8,
                "system": build_system_prompt(melbourne_now),
                "messages": [{"role": "user", "content": user_text}]
            })
        )

        response_body = json.loads(response['body'].read().decode('utf-8'))

        usage = response_body.get('usage', {})
        used_tokens = usage.get('input_tokens', 0) + usage.get('output_tokens', 0)

        if used_tokens > 0:
            try:
                table.update_item(
                    Key={'UserID': token_key, 'Time': 0},
                    UpdateExpression='ADD TotalTokens :val',
                    ConditionExpression='attribute_not_exists(TotalTokens) or TotalTokens < :limit',
                    ExpressionAttributeValues={
                        ':val': used_tokens,
                        ':limit': DAILY_TOKEN_LIMIT
                    }
                )
            except botocore.exceptions.ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    return respond(429, '⚠️ Limit reached strictly for today!')
                raise

        data_text = response_body['content'][0]['text'].strip()

        if data_text.startswith("```"):
            data_text = data_text.split("\n", 1)[1].rsplit("\n", 1)[0].strip()
            if data_text.startswith("json"):
                data_text = data_text[4:].strip()

        parsed = json.loads(data_text)

        reply_text = None
        if isinstance(parsed, dict) and 'reminders' in parsed:
            data_list = parsed.get('reminders') or []
            reply_text = parsed.get('reply')
        elif isinstance(parsed, dict):
            data_list = [parsed]
        else:
            data_list = parsed

        confirmed_times = []

        for data in data_list:
            reminder_msg = data.get('msg', 'Task missing')

            dt = resolve_datetime(data, melbourne_now)
            if dt is None:
                continue 

            formatted_time = int(dt.strftime('%Y%m%d%H%M'))

            table.put_item(Item={
                'UserID': chat_id,
                'Time': formatted_time,
                'Task': reminder_msg,
                'Status': 'PENDING',
                'CreatedAt': int(time.time())
            })

            label = dt.strftime('%H:%M')
            if dt.date() != melbourne_now.date():
                label = f"{dt.strftime('%a %d/%m')} {label}"
            confirmed_times.append(label)

        if not confirmed_times:
            fallback = "Reckon I missed that one, mate. Give us a task and a time!"
        else:
            fallback = f"✅ Alright, at {', '.join(confirmed_times)}!"

        message = str(reply_text).strip()[:200] if reply_text else fallback
        return respond(200, message or fallback)

    except Exception as e:
        print("ERROR:", repr(e))
        return respond(200, "Bloody hell, my brain just short-circuited. Try that again, mate!")