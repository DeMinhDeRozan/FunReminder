import json
import boto3
import time
import botocore.exceptions
from datetime import datetime
from zoneinfo import ZoneInfo

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-2')
table = dynamodb.Table('RemindYouBro')
bedrock = boto3.client(service_name='bedrock-runtime', region_name='us-east-1')

DAILY_TOKEN_LIMIT = 1100

def lambda_handler(event, context):
    headers = {
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Headers': 'Content-Type,Authorization', 
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
        'Content-Type': 'application/json'
    }
    
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'OK'})}

    try:
        raw_body = event.get('body', '{}')
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        chat_id = str(body.get('user_id', 'web_user'))
        user_text = body.get('task_input', '')[:150]

        if not user_text:
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'No input'})}

        melbourne_now = datetime.now(ZoneInfo("Australia/Melbourne"))
        today_str = melbourne_now.strftime('%Y%m%d')
        token_key = f"TOKEN_USAGE_{today_str}"

        try:
            usage_res = table.get_item(Key={'UserID': token_key, 'Time': 0})
            current_tokens = int(usage_res.get('Item', {}).get('TotalTokens', 0))
            if current_tokens >= DAILY_TOKEN_LIMIT:
                return {
                    'statusCode': 429,
                    'headers': headers,
                    'body': json.dumps({'message': '⚠️ Limit reached for today. Try again tomorrow!'})
                }
        except Exception:
            pass
#This prompt is not the exact one I use in real code
        prompt = f"""
You are a JSON extraction API.

Extract all tasks and times (24h format HH:mm) from this text:
"{user_text}"

Return ONLY a valid JSON ARRAY.
Do not use markdown. Do not add explanations.

Format:
[
  {{"time": "HH:mm", "msg": "Hey mate, remember to [task] now"}}
]
"""
        
        response = bedrock.invoke_model(
            modelId='us.anthropic.claude-haiku-4-5-20251001-v1:0', 
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31", 
                "max_tokens": 200, 
                "temperature": 0, 
                "messages": [{"role": "user", "content": prompt}]
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
                    return {
                        'statusCode': 429,
                        'headers': headers,
                        'body': json.dumps({'message': '⚠️ Limit reached strictly for today!'})
                    }
                raise e

        data_text = response_body['content'][0]['text'].strip()
        
        if data_text.startswith("```"):
            data_text = data_text.split("\n", 1)[1].rsplit("\n", 1)[0].strip()
            if data_text.startswith("json"):
                data_text = data_text[4:].strip()

        data_list = json.loads(data_text)
        if isinstance(data_list, dict):
            data_list = [data_list]

        confirmed_times = []

        for data in data_list:
            time_str = data.get('time', '00:00')
            reminder_msg = data.get('msg', 'Task missing')
            
            try:
                hh, mm = time_str.split(':')
            except ValueError:
                hh, mm = "00", "00"
                
            formatted_time = int(f"{today_str}{int(hh):02d}{int(mm):02d}")
            
            table.put_item(Item={
                'UserID': chat_id, 
                'Time': formatted_time, 
                'Task': reminder_msg, 
                'Status': 'PENDING',
                'CreatedAt': int(time.time())
            })
            confirmed_times.append(time_str)
        
        return {
            'statusCode': 200, 
            'headers': headers, 
            'body': json.dumps({'message': f"✅ Alright, at {', '.join(confirmed_times)}!"})
        }
    except Exception as e:
        return {
            'statusCode': 200, 
            'headers': headers, 
            'body': json.dumps({'message': str(e)})
        }
