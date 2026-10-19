import json
import time
import boto3
import botocore.exceptions
from datetime import datetime
from zoneinfo import ZoneInfo

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-2')
table = dynamodb.Table('RemindYouBro')
bedrock = boto3.client(service_name='bedrock-runtime', region_name='us-east-1')

MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
DAILY_TOKEN_LIMIT = ...

SYSTEM_PROMPT = """ 

Format:
{"reminders":[{"time":"HH:mm","msg":"..."}],"reply":"..."}

Rules:
- msg: 
- reply: 
- If there is no valid task or time, return {"reminders":[],"reply":"<a short friendly Aussie line asking for a task and a time>"}.
"""

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

        melbourne_now = datetime.now(ZoneInfo("Australia/Melbourne"))
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
                "max_tokens": ... ,
                "temperature": ... ,
                "system": SYSTEM_PROMPT,
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
            time_str = str(data.get('time', '00:00'))
            reminder_msg = data.get('msg', 'Task missing')

            try:
                hh, mm = time_str.split(':')
                formatted_time = int(f"{today_str}{int(hh):02d}{int(mm):02d}")
            except ValueError:
                hh, mm = "00", "00"
                time_str = "00:00"
                formatted_time = int(f"{today_str}0000")

            table.put_item(Item={
                'UserID': chat_id,
                'Time': formatted_time,
                'Task': reminder_msg,
                'Status': 'PENDING',
                'CreatedAt': int(time.time())
            })
            confirmed_times.append(time_str)

        if not confirmed_times:
            fallback = "Reckon I missed that one, mate. Give us a task and a time!"
        else:
            fallback = f"✅ Alright, at {', '.join(confirmed_times)}!"

        message = str(reply_text).strip()[:200] if reply_text else fallback
        return respond(200, message or fallback)

    except Exception as e:
        print("ERROR:", repr(e))
        return respond(200, "Bloody hell, my brain just short-circuited. Try that again, mate!")