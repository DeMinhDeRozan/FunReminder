import json
import re
import random
import time
import os
import uuid
import urllib.request
import urllib.error

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import boto3
import botocore.exceptions
from boto3.dynamodb.conditions import Key

from auth_helper import resolve_identity, AuthError, IdentityError, GUEST_MAX_REMINDERS


dynamodb = boto3.resource('dynamodb', region_name="<REGION>")
table = dynamodb.Table("<TABLE_NAME>")

bedrock = boto3.client(
    service_name='bedrock-runtime',
    region_name="<REGION>"
)

ssm_client = boto3.client('ssm', region_name="<REGION>")


MODEL_ID = "<MODEL_ID>"
TZ = ZoneInfo("<TIMEZONE>")

PARAMETER_NAME = "<SSM_PARAMETER>"
CACHE_TTL = 60

TTS_URL = os.environ.get("TTS_URL", "<TTS_URL>")
TTS_API_KEY = os.environ.get("TTS_API_KEY", "")
TTS_TIMEOUT = int(os.environ.get("TTS_TIMEOUT", "15"))

MAX_REMINDERS = 3

FAR_REMINDER_MINUTES = int(os.environ.get("FAR_REMINDER_MINUTES", "60"))

PENDING_TTL = int(os.environ.get("PENDING_TTL_SECONDS", "600"))
PENDING_PREFIX = "PENDING#"


PROMPT_LOG_CLIENT_INFO = os.environ.get("PROMPT_LOG_CLIENT_INFO", "true").lower() != "false"

PROMPT_LOG_TTL_DAYS = int(os.environ.get("PROMPT_LOG_TTL_DAYS", "7"))

REMINDER_TTL_DAYS = int(os.environ.get("REMINDER_TTL_DAYS", "7"))

USER_DAILY_CAP = int(os.environ.get("USER_DAILY_CAP", "40"))
GUEST_IP_DAILY_CAP = int(os.environ.get("GUEST_IP_DAILY_CAP", "60"))


_cached_token_cap = None
_cache_expiry_time = 0


def get_daily_token_cap():
    global _cached_token_cap, _cache_expiry_time

    if _cached_token_cap is not None and time.time() < _cache_expiry_time:
        return _cached_token_cap

    try:
        response = ssm_client.get_parameter(Name=PARAMETER_NAME)
        token_cap = int(response["Parameter"]["Value"])

        _cached_token_cap = token_cap
        _cache_expiry_time = time.time() + CACHE_TTL
        return token_cap

    except botocore.exceptions.ClientError as e:
        print("", repr(e))

    except (ValueError, KeyError, TypeError) as e:
        print("", repr(e))

    fallback = int(os.environ.get("DAILY_TOKEN_LIMIT", 11000))
    print("", fallback)
    return fallback


OFFTOPIC_REPLIES = [""]


WHO_REPLIES = [""]


NOT_A_NAME = frozenset((
    ""
).split())


NOT_DEMINH_REPLIES = [""]

IS_DEMINH_REPLIES = [""]


ABOUT_BOT_REPLIES = [""]


GREETING_REPLIES = [""]


HOWAREYOU_REPLIES = [""]


THANKS_REPLIES = [""]


INSULT_MILD_REPLIES = [""]

INSULT_MEDIUM_REPLIES = [""]

INSULT_STRONG_REPLIES = [""]


FLIRT_REPLIES = [""]


SAD_REPLIES = [""]


CRISIS_REPLY = (
    ""
)


TIME_Q_REPLIES = [""]


WEATHER_REPLIES = [""]


JOKE_REPLIES = [""]


WRITE_REPLIES = [""]


MATH_REPLIES = [""]


HELP_REPLIES = [""]


LIST_CANCEL_REPLIES = [""]


FILLER_REPLIES = [""]


NON_ENGLISH_REPLIES = [""]

ENGLISH_COMMON = frozenset((
    ""
).split())

FOREIGN_TELLTALES = frozenset((
    ""
).split())


def looks_non_english(text):
    letters = [c for c in text if c.isalpha()]
    if len(letters) < 2:
        return False

    if any(ord(c) > 0xFF for c in letters):
        return True

    words = re.findall(r"[^\W\d_]+", text.lower())
    if not words:
        return False

    if any(0xC0 <= ord(c) <= 0xFF for c in letters):
        english = sum(w in ENGLISH_COMMON for w in words)
        if english / len(words) < 0.5:
            return True

    hits = {w for w in words if w in FOREIGN_TELLTALES}
    return len(hits) >= 2 or (len(hits) == 1 and len(words) <= 2)


ALWAYS_CANNED = [
    (LIST_CANCEL, LIST_CANCEL_REPLIES),
    (TIME_Q, TIME_Q_REPLIES),
    (HELP, HELP_REPLIES),
    (HOW_ARE_YOU, HOWAREYOU_REPLIES),
    (GREETING, GREETING_REPLIES),
    (THANKS, THANKS_REPLIES),
    (MATH_SYM, MATH_REPLIES),
    (MATH_WORD, MATH_REPLIES),
    (FILLER, FILLER_REPLIES),
    (GIBBERISH, FILLER_REPLIES),
]


GUARDED_CANNED = [
    (ABOUT_BOT, ABOUT_BOT_REPLIES),
    (WHO_ARE_YOU, WHO_REPLIES),
    (FLIRT, FLIRT_REPLIES),
    (SAD, SAD_REPLIES),
    (WEATHER, WEATHER_REPLIES),
    (JOKE, JOKE_REPLIES),
    (WRITE_REQ, WRITE_REPLIES),
]


SAFE_CANNED = set(SAD_REPLIES + HELP_REPLIES + LIST_CANCEL_REPLIES + [CRISIS_REPLY])


def insult_reply(t):
    if not INSULT.search(t):
        return None
    if INSULT_STRONG.search(t):
        return random.choice(INSULT_STRONG_REPLIES)
    if INSULT_MEDIUM.search(t):
        return random.choice(INSULT_MEDIUM_REPLIES)
    return random.choice(INSULT_MILD_REPLIES)


def identity_reply(t):
    m = ARE_YOU_NAME.match(t)
    if not m:
        return None

    name = m.group('name').strip()
    words = name.lower().split()

    if ABOUT_BOT.search(t) or INSULT.search(t) or any(w in NOT_A_NAME for w in words):
        return None

    if IS_DEMINH.search(name):
        return random.choice(IS_DEMINH_REPLIES)

    return random.choice(NOT_DEMINH_REPLIES).format(name=name.title())


def canned_reply(text, ctx):
    t = ' '.join(text.split())

    for rx, bank in ALWAYS_CANNED:
        if rx.search(t):
            return random.choice(bank).format(**ctx)

    if TASK_CUE.search(t) or CLOCK_TIME.search(t):
        return None

    for handler in (insult_reply, identity_reply):
        reply = handler(t)
        if reply:
            return reply

    for rx, bank in GUARDED_CANNED:
        if rx.search(t):
            return random.choice(bank).format(**ctx)

    if QUESTIONISH.match(t) or t.endswith('?'):
        return random.choice(OFFTOPIC_REPLIES).format(**ctx)

    return None


SCARE_NONENGLISH = os.environ.get("SCARE_NONENGLISH", "true").lower() != "false"
SCARE_SMALLTALK = os.environ.get("SCARE_SMALLTALK", "true").lower() != "false"
LOG_OFFTOPIC = os.environ.get("LOG_OFFTOPIC", "true").lower() != "false"

if not SCARE_SMALLTALK:
    SAFE_CANNED |= set(GREETING_REPLIES + THANKS_REPLIES + HOWAREYOU_REPLIES + FILLER_REPLIES)

_INLINE_OFFTOPIC = (WRITE_REQ, JOKE, WEATHER, MATH_SYM, MATH_WORD, FLIRT, ABOUT_BOT, WHO_ARE_YOU, INSULT, _OPINION)


def mixed_offtopic(text):
    t = ' '.join(str(text or '').split())

    if _TELL_ME_JOKE.search(t) or _WRITE_ME.search(t):
        return True

    parts = []
    for line in re.split(r'[\r\n]+', str(text or '')):
        parts.extend(re.split(r'(?<=\?)\s*', ' '.join(line.split())))
    for part in parts:
        for clause in _CLAUSE_SPLIT.split(part):
            c = (clause or '').strip()
            if not c:
                continue
            if TASK_CUE.search(c) or CLOCK_TIME.search(c):
                times = list(CLOCK_TIME.finditer(c))
                if times and _TAIL_Q.match(c[times[-1].end():].strip()):
                    return True
                continue
            if QUESTIONISH.match(c):
                return True
            if any(rx.search(c) for rx in _INLINE_OFFTOPIC):
                return True
            if c.endswith('?') and not TIME_HINT.search(c):
                return True

    return False


def mark_prompt_offtopic(key, source):
    if not LOG_OFFTOPIC or not key:
        return
    try:
        table.update_item(
            Key=key,
            UpdateExpression="",
            ExpressionAttributeValues={':t': True, ':by': source}
        )
    except Exception as e:
        print("PROMPT_OFFTOPIC_MARK_ERROR:", repr(e))


FAR_WARN_REPLIES = [""]

CONFIRM_NUDGES = [""]

CANCEL_REPLIES = [""]

NO_PENDING_REPLIES = [""]


def humanize_delta(minutes):
    minutes = int(minutes)
    if minutes >= 2880:
        return f"{minutes // 1440} days"
    if minutes >= 120:
        return f"about {int(minutes / 60 + 0.5)} hours"
    return f"{minutes} minutes"


SYSTEM_PROMPT_TEMPLATE = ""


HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Content-Type': 'application/json'
}


def respond(code, message, **extra):
    return {
        'statusCode': code,
        'headers': HEADERS,
        'body': json.dumps({'message': message, **extra})
    }


def build_system_prompt(now):
    return (
        SYSTEM_PROMPT_TEMPLATE
        .replace('__NOW__', now.strftime('%Y-%m-%d %H:%M'))
        .replace('__WEEKDAY__', now.strftime('%A'))
    )


def resolve_datetime(data, now):
    time_str = str(data.get('time', '')).strip()
    date_str = str(data.get('date', '')).strip() or now.strftime('%Y-%m-%d')

    try:
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    except ValueError:
        try:
            dt = datetime.strptime(
                f"{now.strftime('%Y-%m-%d')} {time_str}",
                "%Y-%m-%d %H:%M"
            )
        except ValueError:
            return None

    dt = dt.replace(tzinfo=TZ)

    if dt < now - timedelta(minutes=1) and dt.date() == now.date():
        dt = dt + timedelta(days=1)

    return dt


def parse_model_json(text):
    text = text.strip()

    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("\n", 1)[0].strip()
        if text.startswith("json"):
            text = text[4:].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise


def generate_alarm_audio(alarm_text, reminder_id):
    if not TTS_URL:
        raise RuntimeError("")

    headers = {"Content-Type": "application/json"}
    if TTS_API_KEY:
        headers["X-API-Key"] = TTS_API_KEY

    request = urllib.request.Request(
        TTS_URL,
        data=json.dumps({
            "text": alarm_text,
            "reminder_id": reminder_id
        }).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=TTS_TIMEOUT) as resp:
            result = json.loads(resp.read().decode("utf-8"))

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError("")

    if not result.get("success") or not result.get("s3_key"):
        raise RuntimeError("")

    return result


def safe_generate_audio(job):
    try:
        return job, generate_alarm_audio(job["alarm_text"], job["reminder_id"]), None
    except Exception as e:
        return job, None, repr(e)


def set_audio_status(job, status, result=None):
    key = {'UserID': job["chat_id"], 'Time': job["time"]}
    condition = ""

    try:
        if status == "READY":
            table.update_item(
                Key=key,
                UpdateExpression=(
                    ""
                ),
                ConditionExpression=condition,
                ExpressionAttributeValues={
                    ':st': 'READY',
                    ':k': result["s3_key"],
                    ':v': result.get("voice", "unknown"),
                    ':rid': job["reminder_id"]
                }
            )
        else:
            table.update_item(
                Key=key,
                UpdateExpression="",
                ConditionExpression=condition,
                ExpressionAttributeValues={
                    ':st': status,
                    ':rid': job["reminder_id"]
                }
            )

    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            print("", job["reminder_id"])
        else:
            print("", job["reminder_id"], repr(e))

    except Exception as e:
        print("", job["reminder_id"], repr(e))


def make_label(dt, now):
    label = dt.strftime('%H:%M')
    if dt.date() != now.date():
        label = f"{dt.strftime('%a %d/%m')} {label}"
    return label


def prepare_reminders(data_list, now):
    prepared = []

    for data in data_list:
        reminder_msg = str(data.get('msg') or "").strip()[:90]
        alarm_text = str(data.get('alarm_text') or reminder_msg).strip()[:200]

        dt = resolve_datetime(data, now)

        if dt is None:
            print("", data)
            continue

        prepared.append({
            'msg': reminder_msg,
            'alarm_text': alarm_text,
            'time': int(dt.strftime('%Y%m%d%H%M')),
            'label': make_label(dt, now),
            'minutes_away': (dt - now).total_seconds() / 60
        })

    return prepared


REMINDER_TIME_MAX = 10 ** 12

GUEST_LIMIT_REPLIES = [""]

USER_CAP_REPLIES = [""]

GUEST_IP_CAP_REPLIES = [""]

GUEST_TRIMMED_NOTES = [""]


def reminder_expires_at(time_int):
    if REMINDER_TTL_DAYS <= 0:
        return None
    try:
        due = datetime.strptime(str(int(time_int)), '%Y%m%d%H%M').replace(tzinfo=TZ)
        base = int(due.timestamp())
    except (ValueError, TypeError):
        base = int(time.time())
    return max(base, int(time.time())) + REMINDER_TTL_DAYS * 86400


def bump_daily_counter(pk, limit, ttl_seconds=2 * 86400):
    if limit <= 0:
        return True
    try:
        table.update_item(
            Key={'UserID': pk, 'Time': 0},
            UpdateExpression="",
            ConditionExpression="",
            ExpressionAttributeValues={
                ':one': 1,
                ':lim': int(limit),
                ':exp': int(time.time()) + ttl_seconds,
                ':rt': 'DAILY_COUNTER'
            }
        )
        return True
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return False
        print("DAILY_COUNTER_ERROR:", repr(e))
        return True
    except Exception as e:
        print("DAILY_COUNTER_ERROR:", repr(e))
        return True


def guest_remaining(chat_id):
    used = 0
    args = {
        'KeyConditionExpression': Key('UserID').eq(chat_id) & Key('Time').lt(REMINDER_TIME_MAX),
        'Select': 'COUNT'
    }

    while True:
        res = table.query(**args)
        used += res.get('Count', 0)
        last = res.get('LastEvaluatedKey')
        if not last:
            break
        args['ExclusiveStartKey'] = last

    return max(0, GUEST_MAX_REMINDERS - used)


def save_reminders(chat_id, prepared, use_tts, is_guest=False):
    if is_guest:
        prepared = prepared[:guest_remaining(chat_id)]

    labels = []
    push_times = []
    audio_jobs = {}

    for p in prepared:
        reminder_id = str(uuid.uuid4())

        item = {
            'UserID': chat_id,
            'Time': p['time'],
            'Task': p['msg'],
            'AlarmText': p['alarm_text'],
            'ReminderID': reminder_id,
            'AudioStatus': 'PENDING' if use_tts else 'SKIPPED',
            'Status': 'PENDING',
            'CreatedAt': int(time.time())
        }

        expires_at = reminder_expires_at(p['time'])
        if expires_at:
            item['ExpireTime'] = expires_at

        table.put_item(Item=item)
        push_times.append(p['time'])

        if use_tts:
            audio_jobs[p['time']] = {
                "chat_id": chat_id,
                "time": p['time'],
                "alarm_text": p['alarm_text'],
                "reminder_id": reminder_id
            }
        else:
            audio_jobs.pop(p['time'], None)

        labels.append(p['label'])

    schedule_push_reminders(chat_id, push_times)

    jobs = list(audio_jobs.values())

    if jobs:
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            outcomes = list(pool.map(safe_generate_audio, jobs))

        for job, result, error in outcomes:
            if result:
                print("", job["reminder_id"], result.get("voice"))
                set_audio_status(job, "READY", result)
            else:
                print("", job["reminder_id"], error)
                set_audio_status(job, "FAILED")

    return labels


def save_pending(chat_id, prepared, reply_text):
    pending_id = str(uuid.uuid4())

    table.put_item(
        Item={
            'UserID': PENDING_PREFIX + chat_id,
            'Time': 0,
            'PendingID': pending_id,
            'PendingExpires': int(time.time()) + PENDING_TTL,
            'ExpireTime': int(time.time()) + PENDING_TTL + 3600,
            'PendingReply': str(reply_text).strip()[:200] if reply_text else '',
            'PendingReminders': [
                {
                    'Task': p['msg'],
                    'AlarmText': p['alarm_text'],
                    'Time': p['time'],
                    'Label': p['label']
                }
                for p in prepared
            ]
        }
    )

    return pending_id


def claim_pending(chat_id, pending_id=''):
    condition = ""
    values = {':now': int(time.time())}

    if pending_id:
        condition += ""
        values[':pid'] = pending_id

    try:
        result = table.update_item(
            Key={'UserID': PENDING_PREFIX + chat_id, 'Time': 0},
            UpdateExpression="",
            ConditionExpression=condition,
            ExpressionAttributeValues=values,
            ReturnValues='ALL_OLD'
        )
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise

    return result.get('Attributes')


def handle_pending(chat_id, action, pending_id, use_tts, typed=False, is_guest=False):
    attrs = claim_pending(chat_id, pending_id)

    if not attrs:
        return None if typed else respond(200, random.choice(NO_PENDING_REPLIES))

    if action == 'cancel':
        return respond(200, random.choice(CANCEL_REPLIES))

    prepared = [
        {
            'msg': str(r['Task']),
            'alarm_text': str(r['AlarmText']),
            'time': int(r['Time']),
            'label': str(r['Label'])
        }
        for r in attrs['PendingReminders']
    ]

    labels = save_reminders(chat_id, prepared, use_tts, is_guest)

    trimmed = is_guest and len(labels) < len(prepared)

    if trimmed and not labels:
        return respond(200, random.choice(GUEST_LIMIT_REPLIES), login_required=True)

    base = str(attrs.get('PendingReply') or '').strip() or ""
    note = ' ' + random.choice(GUEST_TRIMMED_NOTES) if trimmed else ''
    return respond(200, f"{base}{note} {random.choice(CONFIRM_NUDGES)}", login_required=trimmed)


def build_far_warning(p):
    return random.choice(FAR_WARN_REPLIES).format(
        when=p['label'],
        away=humanize_delta(p['minutes_away'])
    )


def describe_browser(ua):
    if not ua:
        return ''

    if BOT_UA.search(ua):
        return 'Bot/script'

    if 'Edg/' in ua or 'EdgA/' in ua or 'EdgiOS/' in ua:
        browser = 'Edge'
    elif 'OPR/' in ua or 'Opera' in ua:
        browser = 'Opera'
    elif 'SamsungBrowser' in ua:
        browser = ""
    elif 'Firefox/' in ua or 'FxiOS' in ua:
        browser = 'Firefox'
    elif 'CriOS' in ua or 'Chrome/' in ua:
        browser = 'Chrome'
    elif 'Safari/' in ua:
        browser = 'Safari'
    else:
        browser = 'Other'

    if 'iPhone' in ua or 'iPad' in ua or 'iPod' in ua:
        os_name = 'iOS'
    elif 'Android' in ua:
        os_name = 'Android'
    elif 'Windows' in ua:
        os_name = 'Windows'
    elif "" in ua or 'Macintosh' in ua:
        os_name = 'macOS'
    elif 'CrOS' in ua:
        os_name = 'ChromeOS'
    elif 'Linux' in ua:
        os_name = 'Linux'
    else:
        os_name = ''

    return f"{browser} on {os_name}" if os_name else browser


def get_client_info(event):
    info = {}

    try:
        headers = {str(k).lower(): str(v) for k, v in (event.get('headers') or {}).items()}
        ctx = event.get('requestContext') or {}

        ip = (
            (ctx.get('identity') or {}).get('sourceIp')
            or (ctx.get('http') or {}).get('sourceIp')
            or headers.get('x-forwarded-for', '').split(',')[0].strip()
        )

        ua = headers.get('user-agent', '')[:300]

        country = headers.get('cloudfront-viewer-country', '')

        if ip:
            info['IP'] = str(ip)[:64]
        if ua:
            info['UserAgent'] = ua
            info['Browser'] = describe_browser(ua)
        if country:
            info['Country'] = country[:8]

    except Exception as e:
        print("CLIENT_INFO_ERROR:", repr(e))

    return info


def log_prompt(chat_id, prompt, now, dangerous=False, detected_by=None, client=None, extra=None):
    chat_id = str(chat_id)

    owner = chat_id if CHAT_ID_RE.fullmatch(chat_id) else 'INVALID_USER'

    key = {
        'UserID': owner,
        'Time': time.time_ns() // 1000
    }

    item = {
        **key,
        'RowType': 'PROMPT_LOG',
        'ChatID': chat_id[:64],
        'Prompt': prompt,
        'Dangerous': bool(dangerous),
        'CreatedAt': int(time.time()),
        'CreatedAtLocal': now.strftime('%Y-%m-%d %H:%M:%S')
    }

    if detected_by:
        item['DetectedBy'] = detected_by

    if client and PROMPT_LOG_CLIENT_INFO:
        item.update(client)

    if extra:
        item.update(extra)

    if PROMPT_LOG_TTL_DAYS > 0:
        item['ExpireTime'] = int(time.time()) + PROMPT_LOG_TTL_DAYS * 86400

    try:
        table.put_item(Item=item)
        return key
    except Exception as e:
        print("PROMPT_LOG_ERROR:", repr(e))
        return None


import hashlib as _push_hashlib
import re as _push_re
from urllib.parse import urlparse as _push_urlparse

PUSH_SENDER_ARN = os.environ.get("PUSH_SENDER_ARN", "")
PUSH_SCHEDULER_ROLE_ARN = os.environ.get("PUSH_SCHEDULER_ROLE_ARN", "")
PUSH_SCHEDULE_GROUP = os.environ.get("PUSH_SCHEDULE_GROUP", "default")
PUSH_ALLOW_GUESTS = os.environ.get("PUSH_ALLOW_GUESTS", "false").lower() == "true"
PUSH_MAX_SUBS = int(os.environ.get("PUSH_MAX_SUBS", "5"))
PUSH_SUB_TTL_DAYS = int(os.environ.get("PUSH_SUB_TTL_DAYS", "90"))
PUSH_PREFIX = "PUSHSUB#"

scheduler_client = boto3.client('scheduler', region_name="<REGION>")

_PUSH_HOSTS = (
    "fcm.googleapis.com", "android.googleapis.com",
    "push.services.mozilla.com", "push.apple.com", "notify.windows.com",
)
_B64URL = _push_re.compile(r"^[A-Za-z0-9_\-]+={0,2}$")


def push_enabled():
    return bool(PUSH_SENDER_ARN and PUSH_SCHEDULER_ROLE_ARN)


def validate_push_subscription(sub):
    if not isinstance(sub, dict):
        return None
    endpoint = sub.get('endpoint')
    keys = sub.get('keys')
    if not isinstance(endpoint, str) or not isinstance(keys, dict) or len(endpoint) > 700:
        return None
    try:
        u = _push_urlparse(endpoint)
        host = (u.hostname or '').lower()
        port = u.port
    except Exception:
        return None
    if u.scheme != 'https' or u.username or u.password or port not in (None, 443):
        return None
    if not any(host == h or host.endswith('.' + h) for h in _PUSH_HOSTS):
        return None
    p256dh, auth = keys.get('p256dh'), keys.get('auth')
    if not (isinstance(p256dh, str) and isinstance(auth, str)):
        return None
    if not (_B64URL.match(p256dh) and _B64URL.match(auth)) or len(p256dh) > 130 or len(auth) > 40:
        return None
    return {'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth}}


def _push_sub_id(endpoint):
    return _push_hashlib.sha1(endpoint.encode('utf-8')).hexdigest()[:20]


def _push_row_key(chat_id):
    return {'UserID': PUSH_PREFIX + chat_id, 'Time': 0}


def load_push_subs(chat_id):
    item = table.get_item(Key=_push_row_key(chat_id)).get('Item') or {}
    return dict(item.get('Subs') or {})


def _save_push_subs(chat_id, subs):
    if not subs:
        table.delete_item(Key=_push_row_key(chat_id))
        return
    item = dict(_push_row_key(chat_id))
    item['Subs'] = subs
    item['UpdatedAt'] = int(time.time())
    item['ExpireTime'] = int(time.time()) + PUSH_SUB_TTL_DAYS * 86400
    table.put_item(Item=item)


def handle_push_action(chat_id, is_guest, action, body):
    if not push_enabled():
        return respond(200, "", push_enabled=False)
    if is_guest and not PUSH_ALLOW_GUESTS:
        return respond(403, "", push_enabled=True)

    raw = body.get('subscription') if action == 'push_subscribe' else {'endpoint': body.get('endpoint')}
    subs = load_push_subs(chat_id)

    if action == 'push_unsubscribe':
        endpoint = (raw or {}).get('endpoint')
        if isinstance(endpoint, str) and subs.pop(_push_sub_id(endpoint), None) is not None:
            _save_push_subs(chat_id, subs)
        return respond(200, "", push_enabled=True)

    clean = validate_push_subscription(raw)
    if not clean:
        return respond(400, "", push_enabled=True)

    sid = _push_sub_id(clean['endpoint'])
    if sid not in subs and len(subs) >= PUSH_MAX_SUBS:
        oldest = min(subs, key=lambda k: int(subs[k].get('ts', 0)))
        subs.pop(oldest, None)
    subs[sid] = {**clean, 'ts': int(time.time())}
    _save_push_subs(chat_id, subs)
    return respond(200, "", push_enabled=True)


def _push_schedule_name(chat_id, time_int):
    return "rem-%s-%s" % (_push_hashlib.sha1(chat_id.encode('utf-8')).hexdigest()[:16], time_int)


def schedule_push_reminders(chat_id, times):
    if not (push_enabled() and times):
        return
    try:
        if not load_push_subs(chat_id):
            return
        now = datetime.now(TZ)
        tz_name = getattr(TZ, 'key', "<TIMEZONE>")
        for t in sorted(set(times)):
            due = datetime.strptime(str(t), '%Y%m%d%H%M').replace(tzinfo=TZ)
            if due <= now:
                continue
            args = dict(
                Name=_push_schedule_name(chat_id, t),
                GroupName=PUSH_SCHEDULE_GROUP,
                ScheduleExpression='at(%s)' % due.strftime('%Y-%m-%dT%H:%M:%S'),
                ScheduleExpressionTimezone=tz_name,
                FlexibleTimeWindow={'Mode': 'OFF'},
                Target={'Arn': PUSH_SENDER_ARN, 'RoleArn': PUSH_SCHEDULER_ROLE_ARN,
                        'Input': json.dumps({'u': chat_id, 't': t})},
                ActionAfterCompletion='DELETE',
            )
            try:
                scheduler_client.create_schedule(**args)
            except Exception as e:
                if 'Conflict' in type(e).__name__ or 'ConflictException' in str(e):
                    scheduler_client.update_schedule(**args)
                else:
                    raise
    except Exception as e:
        print("PUSH_SCHEDULE_ERROR:", repr(e))


def lambda_handler(event, context):
    event = event or {}

    if event.get('httpMethod') == 'OPTIONS':
        return respond(200, 'OK')

    try:
        raw_body = event.get('body') or '{}'
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body

        try:
            chat_id, is_guest = resolve_identity(event, body.get('user_id'))
        except AuthError:
            return respond(401, "", auth_error=True)
        except IdentityError:
            return respond(400, "")

        use_tts = str(body.get('voice_mode', 'special')).lower() != 'original'

        action = str(body.get('action', '')).lower()

        if action in ('confirm', 'cancel'):
            return handle_pending(
                chat_id, action, str(body.get('pending_id') or ''), use_tts,
                is_guest=is_guest
            )

        if action in ('push_subscribe', 'push_unsubscribe'):
            return handle_push_action(chat_id, is_guest, action, body)

        user_text = str(body.get('task_input', ''))[:150]

        if not user_text.strip():
            return respond(200, "")

        melbourne_now = datetime.now(TZ)

        client = get_client_info(event)

        prompt_key = log_prompt(
            chat_id, user_text, melbourne_now,
            client=client
        )

        if CRISIS.search(user_text):
            return respond(200, CRISIS_REPLY)

        if YES_RE.match(user_text.strip()):
            reply = handle_pending(chat_id, 'confirm', '', use_tts, typed=True, is_guest=is_guest)
            if reply:
                return reply
        elif NO_RE.match(user_text.strip()):
            reply = handle_pending(chat_id, 'cancel', '', use_tts, typed=True, is_guest=is_guest)
            if reply:
                return reply

        if looks_non_english(user_text):
            if SCARE_NONENGLISH:
                mark_prompt_offtopic(prompt_key, 'lambda')
                return respond(200, random.choice(NON_ENGLISH_REPLIES), offtopic=True)
            return respond(200, random.choice(NON_ENGLISH_REPLIES))

        ctx = {
            'time': melbourne_now.strftime('%I:%M%p').lstrip('0').lower(),
            'day': melbourne_now.strftime('%A'),
            'date': melbourne_now.strftime('%d %b').lstrip('0')
        }

        canned = canned_reply(user_text, ctx)
        if canned:
            canned_extra = {}
            if canned not in SAFE_CANNED:
                canned_extra['offtopic'] = True
                mark_prompt_offtopic(prompt_key, 'lambda')
            return respond(200, canned, **canned_extra)

        if not TIME_HINT.search(user_text):
            mark_prompt_offtopic(prompt_key, 'lambda')
            return respond(200, random.choice(OFFTOPIC_REPLIES), offtopic=True)

        local_off = mixed_offtopic(user_text)

        if is_guest and guest_remaining(chat_id) <= 0:
            return respond(200, random.choice(GUEST_LIMIT_REPLIES), login_required=True)

        day = melbourne_now.strftime('%Y%m%d')

        if not bump_daily_counter(f"USAGE#{str(chat_id)[:64]}#{day}", USER_DAILY_CAP):
            return respond(429, random.choice(USER_CAP_REPLIES))

        if is_guest:
            ip_cap_key = guest_ip_cap_key(client.get('IP'))
            if ip_cap_key and not bump_daily_counter(f"{ip_cap_key}#{day}", GUEST_IP_DAILY_CAP):
                return respond(429, random.choice(GUEST_IP_CAP_REPLIES), login_required=True)

        token_key = f"TOKEN_USAGE_{melbourne_now.strftime('%Y%m%d')}"

        daily_token_limit = get_daily_token_cap()
        current_tokens = 0

        try:
            usage_res = table.get_item(Key={'UserID': token_key, 'Time': 0})
            current_tokens = int(
                usage_res.get('Item', {}).get('TotalTokens', 0)
            )

            if current_tokens >= daily_token_limit:
                return respond(
                    429,
                    ""
                )

        except Exception as e:
            print("TOKEN_CHECK_ERROR:", repr(e))

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 500,
                "temperature": 0.8,
                "system": build_system_prompt(melbourne_now),
                "messages": [{"role": "user", "content": user_text}]
            })
        )

        response_body = json.loads(response['body'].read().decode('utf-8'))

        usage = response_body.get('usage', {})
        used_tokens = (
            usage.get('input_tokens', 0) + usage.get('output_tokens', 0)
        )

        print(
            "", used_tokens,
            "", current_tokens + used_tokens,
            "/", daily_token_limit
        )

        if used_tokens > 0:
            try:
                table.update_item(
                    Key={'UserID': token_key, 'Time': 0},
                    UpdateExpression="",
                    ConditionExpression=(
                        ""
                    ),
                    ExpressionAttributeValues={
                        ':val': used_tokens,
                        ':limit': daily_token_limit,
                        ':exp': int(time.time()) + 3 * 86400
                    }
                )

            except botocore.exceptions.ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    return respond(429, "")
                raise

        parsed = parse_model_json(response_body['content'][0]['text'])

        if isinstance(parsed, dict) and parsed.get('non_english'):
            if SCARE_NONENGLISH:
                mark_prompt_offtopic(prompt_key, 'claude')
                return respond(200, random.choice(NON_ENGLISH_REPLIES), offtopic=True)
            return respond(200, random.choice(NON_ENGLISH_REPLIES))

        claude_off = isinstance(parsed, dict) and str(parsed.get('off_topic')).lower() == 'true'
        off_topic = local_off or claude_off

        reply_text = None

        if isinstance(parsed, dict) and 'reminders' in parsed:
            data_list = parsed.get('reminders') or []
            reply_text = parsed.get('reply')
        elif isinstance(parsed, dict):
            data_list = [parsed]
        else:
            data_list = parsed

        if not isinstance(data_list, list):
            data_list = []

        data_list = [d for d in data_list if isinstance(d, dict)]
        data_list = data_list[:MAX_REMINDERS]

        prepared = prepare_reminders(data_list, melbourne_now)

        if not prepared:
            off_topic = True

        if off_topic:
            mark_prompt_offtopic(prompt_key, 'lambda' if local_off else 'claude')

        far = [p for p in prepared if p['minutes_away'] > FAR_REMINDER_MINUTES]

        if far:
            pending_id = save_pending(chat_id, prepared, reply_text)
            return respond(
                200,
                build_far_warning(far[0]),
                needs_confirm=True,
                pending_id=pending_id,
                offtopic=off_topic
            )

        confirmed_times = save_reminders(chat_id, prepared, use_tts, is_guest) if prepared else []

        if not confirmed_times:
            fallback = (
                ""
            )
        else:
            fallback = ""

        message = str(reply_text).strip()[:200] if reply_text else fallback

        extra = {}
        if off_topic:
            extra['offtopic'] = True
        if is_guest and prepared and len(confirmed_times) < len(prepared):
            message = f"{message or fallback} {random.choice(GUEST_TRIMMED_NOTES)}"
            extra['login_required'] = True

        return respond(200, message or fallback, **extra)

    except Exception as e:
        print("ERROR:", repr(e))

        return respond(
            200,
            ""
        )


import hashlib


import ipaddress as _ipaddress


def _sec3_ip_key(ip):
    try:
        addr = _ipaddress.ip_address(str(ip or '').strip())
    except ValueError:
        return None

    if addr.version == 6:
        if addr.ipv4_mapped:
            return str(addr.ipv4_mapped)
        return str(_ipaddress.ip_network(f"{addr}/64", strict=False))

    return str(addr)


IP_ALLOWLIST = {
    k for k in (
        _sec3_ip_key(x.strip())
        for x in os.environ.get("SEC3_IP_ALLOWLIST", "").split(",")
        if x.strip()
    ) if k
}


def guest_ip_cap_key(ip):
    key = _sec3_ip_key(ip)
    if not key or key in IP_ALLOWLIST:
        return None
    try:
        net = _ipaddress.ip_network(key, strict=False)
        if net.is_private or net.is_loopback or net.is_link_local:
            return None
    except ValueError:
        return None
    return "GUESTIP#" + hashlib.sha256(key.encode('utf-8')).hexdigest()[:24]


ALARM_HISTORY_LIMIT = int(os.environ.get("ALARM_HISTORY_LIMIT", "100"))


def get_alarm_history(chat_id):
    now_int = int(datetime.now(TZ).strftime('%Y%m%d%H%M'))
    items = []
    args = {
        'KeyConditionExpression': Key('UserID').eq(chat_id) & Key('Time').between(1, now_int),
        'ScanIndexForward': False,
        'Limit': ALARM_HISTORY_LIMIT,
    }
    try:
        while len(items) < ALARM_HISTORY_LIMIT:
            res = table.query(**args)
            items.extend(res.get('Items', []))
            last = res.get('LastEvaluatedKey')
            if not last:
                break
            args['ExclusiveStartKey'] = last
    except Exception as e:
        print("SEC6_HISTORY_QUERY_ERROR:", repr(e))
        return None

    out = []
    for it in items[:ALARM_HISTORY_LIMIT]:
        if it.get('RowType') == 'PROMPT_LOG':
            continue
        try:
            due = datetime.strptime(str(int(it['Time'])), '%Y%m%d%H%M').replace(tzinfo=TZ)
        except (KeyError, ValueError, TypeError):
            continue
        out.append({
            'id': it.get('ReminderID'),
            'task': str(it.get('Task') or 'Reminder')[:90],
            'at': int(due.timestamp() * 1000),
        })
    return out


def _sec6_parse_body(event):
    raw = event.get('body') or '{}'
    try:
        body = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return {}
    return body if isinstance(body, dict) else {}


def _sec6_handle_alarm_history(event, body):
    try:
        chat_id, is_guest = resolve_identity(event, body.get('user_id'))
    except AuthError:
        return respond(401, "", auth_error=True)
    except IdentityError:
        return respond(400, "")

    if is_guest:
        return respond(200, 'OK', history=[])

    history = get_alarm_history(chat_id)
    if history is None:
        return respond(200, 'OK', history_unknown=True)
    return respond(200, 'OK', history=history)


_sec6_prev_lambda_handler = lambda_handler


def lambda_handler(event, context):
    event = event or {}

    if event.get('httpMethod') == 'OPTIONS':
        return _sec6_prev_lambda_handler(event, context)

    body = _sec6_parse_body(event)

    if str(body.get('action', '')).lower() == 'alarm_history':
        try:
            return _sec6_handle_alarm_history(event, body)
        except Exception as e:
            print("SEC6_ALARM_HISTORY_ERROR:", repr(e))
            return respond(200, 'OK', history_unknown=True)

    return _sec6_prev_lambda_handler(event, context)
