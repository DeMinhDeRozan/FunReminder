import json
import boto3
from datetime import datetime
from zoneinfo import ZoneInfo
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-2')
table = dynamodb.Table('RemindYouBro')

def lambda_handler(event, context):
    headers = {
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Headers': 'Content-Type,Authorization', 
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Content-Type': 'application/json'
    }

    melbourne_now = datetime.now(ZoneInfo("Australia/Melbourne"))
    current_time_str = melbourne_now.strftime("%Y%m%d%H%M")

    to_remind = []

    try:
        response = table.query(
            IndexName="StatusTimeIndex",
            KeyConditionExpression=Key("Status").eq("PENDING") & Key("Time").lte(current_time_str)
        )
        items = response.get('Items', [])

        for item in items:
            to_remind.append(item['Task'])
            try:
                table.update_item(
                    Key={
                        'UserID': item['UserID'], 
                        'Time': item['Time']
                    },
                    UpdateExpression="SET #s = :done",
                    ExpressionAttributeNames={'#s': 'Status'},
                    ExpressionAttributeValues={':done': 'DONE'}
                )
            except Exception as update_err:
                print(f"Update error: {str(update_err)}")

    except Exception as e:
        print(f"Query error: {str(e)}")
        response = table.scan()
        items = response.get('Items', [])
        for item in items:
            item_status = item.get('Status')
            item_time = str(item.get('Time', '999999999999'))

            if item_status == 'PENDING' and item_time <= current_time_str:
                to_remind.append(item['Task'])
                try:
                    table.update_item(
                        Key={
                            'UserID': item['UserID'], 
                            'Time': item['Time']
                        },
                        UpdateExpression="SET #s = :done",
                        ExpressionAttributeNames={'#s': 'Status'},
                        ExpressionAttributeValues={':done': 'DONE'}
                    )
                except Exception as update_err:
                    print(f"Scan update error: {str(update_err)}")

    return {
        'statusCode': 200, 
        'headers': headers, 
        'body': json.dumps({'reminders': to_remind})
    }