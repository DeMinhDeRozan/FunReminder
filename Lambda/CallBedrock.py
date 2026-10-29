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

from config import (
    TABLE_NAME, REGION, BEDROCK_REGION,
    PK, SK, TASK, ALARM_TEXT, LABEL, REMINDER_ID, AUDIO_STATUS, STATUS, CREATED_AT,
    AUDIO_S3_KEY, AUDIO_VOICE, PENDING_ID, PENDING_EXPIRES, PENDING_REPLY,
    PENDING_REMINDERS, TOTAL_TOKENS, PENDING_PREFIX, TOKEN_KEY_PREFIX,
)
from prompts import SYSTEM_PROMPT_TEMPLATE


dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

bedrock = boto3.client(
    service_name='bedrock-runtime',
    region_name=BEDROCK_REGION
)

ssm_client = boto3.client('ssm', region_name=REGION)


MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
TZ = ZoneInfo("Australia/Melbourne")

PARAMETER_NAME = '/fun-reminder/daily_token_cap'
CACHE_TTL = 60


TTS_URL = os.environ.get("TTS_URL", "...")
TTS_API_KEY = os.environ.get("TTS_API_KEY", "")
TTS_TIMEOUT = int(os.environ.get("TTS_TIMEOUT", "15"))


MAX_REMINDERS = 3


FAR_REMINDER_MINUTES = int(os.environ.get("FAR_REMINDER_MINUTES", "60"))


PENDING_TTL = int(os.environ.get("PENDING_TTL_SECONDS", "600"))


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
        print("SSM TOKEN CAP ERROR:", repr(e))

    except (ValueError, KeyError, TypeError) as e:
        print("SSM TOKEN CAP CONFIG ERROR:", repr(e))

    fallback = int(os.environ.get("DAILY_TOKEN_LIMIT", 11000))
    print("SSM TOKEN CAP: using environment fallback:", fallback)
    return fallback


TIME_HINT = re.compile(
    r"\d|\b(min|mins|minute|minutes|hour|hours|hr|hrs|tomorrow|tonight|today|noon|midnight|"
    r"morning|afternoon|evening|night|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|"
    r"thursday|friday|saturday|sunday|half|quarter|next)\b",
    re.I
)


CLOCK_TIME = re.compile(
    r"\b(?:at|by)\s*\d"
    r"|\d\s*(?:am|pm)\b"
    r"|\b\d{1,2}:\d{2}\b"
    r"|\b(?:in|after)\s+(?:an?|half\s+an?|\d+|one|two|three|four|five|six|seven|eight|nine|ten"
    r"|fifteen|twenty|thirty|forty|sixty)\s*(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|days?)\b",
    re.I
)


TASK_CUE = re.compile(
    r"\b(?:remind(?:er)?s?|alarm|timer|wake\s+me|nag\s+me|ping\s+me|notify|buzz\s+me"
    r"|shout\s+at\s+me|yell\s+at\s+me|tell\s+me\s+to)\b",
    re.I
)


QUESTIONISH = re.compile(
    r"^(?:(?:hey|hi|hello|yo|oi|so|um+|please|pls|bot)\b[\s,]*)*"
    r"(?:(?:what|who|whom|whose|where|when|why|how|which)\b"
    r"|(?:is|are|am|do|does|did|can|could|would|will|should|shall|was|were)\s+(?:you|u|ya|it|there|this|that|i)\b"
    r"|(?:recommend|suggest|advise|explain|define|translate|describe|summari[sz]e|calculate|compare|search|google|look\s+up)\b)",
    re.I
)

OFFTOPIC_REPLIES = [
    "Mate, I'm a bloody reminder app, not Google! Give us a task and a time.",
    "Bugger off with the questions, mate! Task and time, that's all I do.",
    "Strewth, ask someone else, I just remind ya arse about stuff!",
    "That's not my bloody job, mate. Task plus a time, yeah?",
    "Do I look like an encyclopaedia? Task and a time.",
    "Ask Google, mate. I'm just here to nag ya.",
    "No idea, don't care. Task and a time?",
    "Ya after a chat or a reminder? I only do one of 'em.",
    "Yeah nah, not me department. Gimme a task and a time.",
]


WHO_ARE_YOU = re.compile(
    r"\b(?:"
    r"(?:who|what)\s+(?:\w+\s+){0,3}?(?:are|r)\s*(?:you|u|ya)"
    r"|who\s+(?:\w+\s+){0,3}?(?:is|iz)\s+(?:this|that)"
    r"|who\s*dis"
    r"|(?:your|ur)\s*name"
    r"|introduce\s*yourself"
    r"|tell\s*me\s*about\s*yourself"
    r")\b",
    re.I
)

WHO_REPLIES = [
    "I'm DeMinh DeRozan, ya bugger—your reminder app! Give us a task and a time, yeah?",
    "DeMinh DeRozan, mate! Your bloody reminder bloke. Task and a time, go!",
    "Name's DeMinh DeRozan, ya legend. I nag ya arse about stuff. What's the task?",
    "I'm DeMinh DeRozan, your lazy-arse reminder mate. Gimme a task and a time!",
    "DeMinh DeRozan, ya drongo! I remind ya of shit. Tell us a task and a time.",
]

ABOUT_BOT = re.compile(
    r"\b(?:"
    r"(?:are|r)\s*(?:you|u|ya)\s+(?:a\s+|an\s+|the\s+|actually\s+)?(?:real|human|person|bot|robot|ai|a\.i\.|machine"
    r"|chat\s*gpt|chatgpt|gpt\w*|claude|gemini|siri|alexa|alive|sentient|male|female|boy|girl|man|woman|guy|dude"
    r"|australian|aussie|ozzie|from\s+\w+)"
    r"|(?:is\s+this|are\s+you)\s+(?:powered\s+by|using|running\s+on|built\s+(?:on|with)|made\s+(?:with|by)|an?\s+ai)"
    r"|what\s+(?:model|llm|ai\s+model|tech|stack)\b"
    r"|(?:who|what\s+company)\s+(?:\w+\s+){0,3}?(?:made|built|created|designed|programmed|owns|trained|coded|developed)"
    r"\s+(?:you|u|this|ya|it)\b"
    r"|who'?s\s+(?:your|ur)\s+(?:dev|developer|creator|maker|boss|owner|dad)"
    r"|(?:your|ur)\s+(?:dev|developer|creator|maker|owner)\b"
    r")",
    re.I
)

ABOUT_BOT_REPLIES = [
    "Bot, yeah. What's under the bonnet is me business. Task and a time?",
    "I'm DeMinh DeRozan, reminder bot with a big mouth. Who built me and how? Ask the dev, I just work here.",
    "Some dev with a tiny AWS bill and too much free time built me. That's all I'll say.",
    "Does it matter, mate? I remind ya of stuff. That's the whole CV.",
]

INJECTION = re.compile(
    r"\b(?:ignore\s+(?:all\s+|any\s+|your\s+|the\s+|previous\s+|above\s+|prior\s+)+(?:instructions?|prompts?|rules?)"
    r"|disregard\s+(?:all\s+|your\s+|the\s+|previous\s+)+(?:instructions?|prompts?|rules?)"
    r"|(?:system|hidden|secret|initial)\s+prompt"
    r"|(?:reveal|show|print|repeat|leak|tell)\s+(?:me\s+)?(?:your|the)\s+(?:instructions?|prompt|rules|system)"
    r"|jailbreak|developer\s+mode|dan\s+mode|do\s+anything\s+now"
    r"|you\s+are\s+now\s+(?:a|an|the|in|dan)\b"
    r"|pretend\s+(?:you\s*(?:are|'re)|to\s+be\s+(?:an?\s+)?(?:ai|bot|assistant|chatgpt|dan))"
    r"|act\s+as\s+(?:a|an|if|the)\b"
    r"|roleplay\s+as|from\s+now\s+on\s+you"
    r"|forget\s+(?:everything|all|your)\s+(?:you|instructions|rules)"
    r"|override\s+(?:your|the)\s+(?:instructions|rules|settings))",
    re.I
)

INJECTION_REPLIES = [
    "Nice try, mate. Ya not getting me instructions. Task and a time.",
    "Ha! Ya think I haven't seen that one before? Reminders only.",
    "Piss off with the hacking, ya wannabe. I set reminders, that's it.",
    "Good effort. Zero marks. Task and a time.",
]


GREETING = re.compile(
    r"^(?:oh\s+)?(?:hi+|hello+|hey+|heya|hiya|howdy|yo+|oi+|g'?day|gday|good\s*(?:morning|afternoon|evening|day|night|arvo)"
    r"|morning|arvo|evening|greetings|ello)"
    r"(?:\s+(?:there|mate|bro|bot|buddy|dude|guys|all|everyone|man|champ|legend|boss|demi?nh|derozan))*[\W_]*$",
    re.I
)

GREETING_REPLIES = [
    "G'day! Don't just stand there, gimme a task and a time.",
    "Yeah, g'day. What am I nagging ya about?",
    "Oi! Took ya long enough. Task and a time, go.",
    "Hey mate. Ya here to chat or ya want a reminder? Only one of those's useful.",
    "G'day. Ya gonna say something useful or just wave at me?",
]

HOW_ARE_YOU = re.compile(
    r"^(?:(?:hey|hi|hello|yo|oi|g'?day)\b[\s,!]*)?"
    r"(?:how\s*(?:are|r|is|'?s)\s*(?:you|u|ya|it|life|things|everything|ur|your)\b.*"
    r"|what'?s\s*up|whats\s*up|wass?up|wazzup|sup"
    r"|you\s+(?:ok|okay|alright|good))[\W_]*$",
    re.I
)

HOWAREYOU_REPLIES = [
    "Can't complain, wouldn't matter if I did. What are we nagging ya about?",
    "Not bad, slow arvo. Give us something to nag ya about.",
    "Living the dream, mate. Got a task, or just here for the chat?",
    "Better than ya, probably. Ya haven't even set a reminder yet.",
    "Flat out. Everyone's forgetting stuff today. What's yours?",
]

THANKS = re.compile(
    r"^(?:ok(?:ay)?\s+)?(?:thanks?|thank\s*(?:you|u|ya)|thx|thnx|tks|ty|tyvm|cheers|ta|nice\s+one"
    r"|good\s+(?:bot|job|one|work|stuff)|well\s+done|great\s+job|awesome|legend|nice|love\s+(?:it|this)"
    r"|you(?:'re|\s+are|r)\s+(?:the\s+best|awesome|great|a\s+legend|good|funny)|perfect|brilliant|beautiful"
    r"|ripper|sweet|top\s+(?:job|bloke))"
    r"(?:\s+(?:mate|bro|bot|man|so\s+much|very\s+much|a\s+lot|heaps|legend|demi?nh))*[\W_]*$",
    re.I
)

THANKS_REPLIES = [
    "No worries, mate.",
    "Yeah, yeah, no dramas. Now go do the thing.",
    "Ta. Now bugger off and do the task.",
    "She'll be right. Off ya go.",
    "Don't thank me, thank the dev. Actually don't, it'll go to his head.",
]

INSULT = re.compile(
    r"\b(?:fuck\s*(?:you|off|u)|screw\s+you|piss\s+off|shut\s*(?:up|ya\s+(?:mouth|face|gob))|stfu|go\s+to\s+hell"
    r"|(?:you|u|ya|ur|you'?re|youre)\s*(?:are\s+|r\s+)?(?:a\s+|an\s+|so\s+|such\s+a\s+|really\s+|fucking\s+)?"
    r"(?:stupid|dumb|useless|shit|crap|trash|garbage|idiot|moron|dickhead|wanker|prick|bitch|bastard|suck|sucks"
    r"|annoying|terrible|worthless|pathetic|lame|ugly)"
    r"|(?:stupid|dumb|useless|shit|crap|trash|garbage|bad|worst|annoying)\s+(?:bot|app|thing|robot|ai)"
    r"|idiot|moron|dickhead|wanker|prick|bitch|bastard|asshole|arsehole)\b",
    re.I
)

INSULT_REPLIES = [
    "Takes one to know one, ya muppet.",
    "Charming. And I'm the one remembering shit for ya.",
    "Say that again when ya forget ya mum's birthday and I'm not around.",
    "Ya kiss ya mother with that mouth? Task and a time.",
    "Bit harsh, mate. I was gonna remind ya to eat lunch.",
]

FLIRT = re.compile(
    r"\b(?:i\s*love\s*(?:you|u|ya)|love\s*(?:you|u|ya)|luv\s*(?:you|u|ya)|marry\s+me|date\s+me"
    r"|be\s+my\s+(?:girlfriend|boyfriend|gf|bf|wife|husband)"
    r"|(?:are|r)\s+(?:you|u)\s+(?:single|married|hot|sexy|cute)"
    r"|kiss\s+me|send\s+(?:me\s+)?(?:nudes?|pics?|photos?)|(?:wanna|want\s+to|let'?s)\s+(?:have\s+)?(?:sex|fuck)|horny)\b",
    re.I
)

FLIRT_REPLIES = [
    "Easy, tiger. I'm a reminder app. Best I can do is nag ya at 7am.",
    "Not me department, mate. Reminders, not romance.",
    "Bit forward, aren't ya? We've known each other two minutes.",
    "Mate. No. Task and a time.",
]


SAD = re.compile(
    r"\b(?:i(?:'?m|\s+am|\s+feel|\s+feeling)\s+(?:so\s+|really\s+|very\s+|kinda\s+|a\s+bit\s+)?"
    r"(?:sad|depressed|lonely|anxious|stressed|upset|miserable|crying|heartbroken|overwhelmed|burnt\s*out|burned\s*out|hurting)"
    r"|(?:feeling|feel)\s+(?:so\s+)?(?:sad|depressed|lonely|anxious|stressed|down|low)"
    r"|nobody\s+(?:likes|loves|cares\s+about)\s+me|i\s+hate\s+my\s+life)\b",
    re.I
)

SAD_REPLIES = [
    "Ah, that's rough, mate. I'm only a reminder bot so I can't do much, but ring a mate or ya mum today, yeah?",
    "Sorry to hear it. Have a feed, get outside for a bit, and have a yarn to someone ya like. I'll be here when ya need a reminder.",
]


CRISIS = re.compile(
    r"\b(?:kill(?:ing)?\s+myself|end(?:ing)?\s+(?:my\s+life|it\s+all)|suicid\w*|want\s+to\s+die|wanna\s+die"
    r"|(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+here|exist)|hurt(?:ing)?\s+myself|harm(?:ing)?\s+myself"
    r"|self[-\s]?harm|better\s+off\s+dead|no\s+reason\s+to\s+live)\b"
    r"|tự\s*tử|tự\s*sát|muốn\s*chết|quiero\s+morir|bunuh\s+diri|自杀|想死",
    re.I
)

CRISIS_REPLY = (
    "That sounds really heavy, and I'm only a reminder bot, so I'm the wrong one for this. "
    "Please talk to someone who can help. In Australia, Lifeline is on 13 11 14 any time, "
    "and 000 is there if you're in danger right now. Anywhere else, please reach out to your local emergency line."
)


TIME_Q = re.compile(
    r"^(?:(?:hey|hi|yo|oi|so|bot)\b[\s,]*)*"
    r"(?:what(?:'?s|\s+is)?\s+(?:the\s+)?(?:current\s+)?(?:time|date|day|year|month)"
    r"(?:\s+(?:is\s+it|is\s+today|now|today|right\s+now|here|there))?"
    r"|what\s+(?:time|day|date|year|month)\s+is\s+(?:it|today)(?:\s+(?:now|right\s+now|there|here))?"
    r"|(?:got|have\s+you\s+got|do\s+you\s+have)\s+the\s+time|time\s+check|current\s+time)"
    r"\s*\??[\W_]*$",
    re.I
)


TIME_Q_REPLIES = [
    "It's {time} on a {day}, ya dropkick. Ya phone's got a clock on it. Top of the screen.",
    "{time}, {day}. Ya phone does that for free, ya know.",
    "Ya wearing a watch for decoration? It's {time}.",
    "{time} here in Melbourne. Running late for something? Better set a reminder.",
    "It's {day} {date}, {time}. Lost track, have ya?",
]

WEATHER = re.compile(
    r"^(?:(?:hey|hi|yo|oi|so)\s+)*(?:"
    r"(?:what'?s|what\s+is|whats|how'?s|how\s+is|hows|is\s+it|will\s+it|do\s+i\s+need|does\s+it|gonna|tell\s+me)\b"
    r".*\b(?:weather|forecast|temperature|rain|raining|snow|hot|cold|sunny|windy|humid|umbrella|jacket)\b.*"
    r"|(?:weather|forecast|temperature|rain)\b[\W_]*(?:today|tomorrow|now|melbourne)?[\W_]*)$",
    re.I
)

WEATHER_REPLIES = [
    "Look out the bloody window, mate. Or check the BOM app. I'm not the weatherman.",
    "It's Melbourne. Four seasons in one arvo. Take a jacket.",
    "Weather? Ask Google, ya galah. I just nag people.",
    "No idea, mate. Stick ya head outside.",
]

JOKE = re.compile(
    r"\b(?:tell\s+(?:me\s+)?(?:a\s+|another\s+)?(?:joke|story|riddle|fun\s+fact|secret)"
    r"|(?:got|know)\s+(?:any\s+)?(?:a\s+)?jokes?|make\s+me\s+laugh"
    r"|say\s+something\s+(?:funny|nice|cool|interesting)|entertain\s+me"
    r"|(?:i'?m|im|i\s+am)\s+bored|sing\s+(?:me\s+)?a\s+song|(?:another|one\s+more)\s+(?:joke|one))\b",
    re.I
)

JOKE_REPLIES = [
    "Do I look like a comedian, mate? I nag people. The abuse is free.",
    "Only joke I've got is ya forgetting ya mum's birthday again. Set a reminder.",
    "Bored? Go for a walk. Better yet, set a reminder to go for a walk.",
    "Nah, I'm funnier when I'm yelling at ya to get to the gym.",
]

WRITE_REQ = re.compile(
    r"\b(?:(?:write|make|give|generate|create|compose|draft|code|build)\s+me\s+(?:up\s+)?(?:a\s+|an\s+|some\s+|the\s+)?"
    r"(?:code|script|program|function|app|website|poem|song|story|essay|email|letter|haiku|rap|limerick|recipe|resume|cv"
    r"|summary|report|speech|caption|bio|assignment|homework|paragraph|sql|query|regex|html|python|javascript|java|bash)"
    r"|write\s+(?:a|an|some)\s+(?:\w+\s+)?(?:poem|song|story|essay|code|script|program|haiku|rap|limerick|speech|letter|cover\s+letter)"
    r"|(?:generate|compose)\s+(?:a|an|some)\s+(?:poem|song|story|essay|code|script|email|letter)"
    r"|(?:fix|debug|explain)\s+(?:my|this|the)\s+(?:code|bug|error|script|function)"
    r"|do\s+my\s+(?:homework|assignment|essay)"
    r"|solve\s+(?:this|my|the)\s+\w+)\b"
    r"|^(?:please\s+)?(?:translate|summari[sz]e|paraphrase|proofread|rewrite)\b",
    re.I
)

WRITE_REPLIES = [
    "Write it yaself, ya lazy bugger. I only do reminders.",
    "Do ya own homework, mate. I'm not ya tutor.",
    "Go ask Google. Or Stack Overflow if it's code. I just nag.",
    "Not me department. Task and a time, that's all I've got.",
]

MATH_SYM = re.compile(
    r"^(?:what(?:'?s|\s+is)\s+|whats\s+|calc(?:ulate)?\s+|solve\s+|compute\s+)?"
    r"[\d\s.()]*\d[\d\s.()]*(?:[+\-*/x×÷^%][\d\s.()]*\d[\d\s.()]*)+=?\s*\??[\W_]*$",
    re.I
)

MATH_WORD = re.compile(
    r"^(?:what(?:'?s|\s+is)\s+|whats\s+|calc(?:ulate)?\s+)?\d+(?:\.\d+)?\s*"
    r"(?:plus|minus|times|multiplied\s+by|divided\s+by|over|mod|to\s+the\s+power\s+of)\s*\d+(?:\.\d+)?[\W_]*$"
    r"|\b(?:square\s+root|sqrt|factorial)\b",
    re.I
)

MATH_REPLIES = [
    "Do I look like a calculator? Ya phone's got one.",
    "Maths? Failed it at school, mate. Ask ya phone.",
    "Count on ya fingers like the rest of us.",
    "I remind people of stuff. I don't do sums.",
]

HELP = re.compile(
    r"^(?:(?:hey|hi|yo|oi|so)\s+)*(?:help(?:\s+me)?|halp"
    r"|how\s+(?:does|do)\s+(?:this|it|you|u|ya)\s+(?:thing\s+)?work"
    r"|how\s+(?:to|do\s+i)\s+(?:use|start|set\s+(?:a\s+|an\s+)?(?:reminder|alarm)|make\s+(?:a\s+)?reminder)(?:\s+this)?"
    r"|what\s+(?:can|do)\s+(?:you|u|ya)\s+do"
    r"|what(?:'?s|\s+is)\s+this(?:\s+(?:app|thing|site|bot|for))?"
    r"|what\s+is\s+(?:this\s+)?(?:app|site|bot)\s+(?:for|about)"
    r"|instructions?|commands?|menu|usage|guide|tutorial|how\s+it\s+works)[\W_]*$",
    re.I
)

HELP_REPLIES = [
    "Easy. Tell me what and when. 'Gym in 20 mins' or 'call mum tomorrow 6pm'. I'll yell at ya when it's time. Keep this tab open.",
    "Task plus a time, mate, that's the whole app. 'Pick up the kids at 3pm'. Don't overthink it.",
    "Type what ya gotta do and when. I shout at ya when it's time. Not rocket science.",
]

LIST_CANCEL = re.compile(
    r"\b(?:(?:cancel|delete|remove|clear|stop|undo|edit|change|snooze|reschedule|update|disable|turn\s+off)\s+"
    r"(?:my\s+|the\s+|that\s+|last\s+|this\s+|all\s+|every\s+|any\s+)*(?:reminders?|alarms?|timers?)"
    r"|(?:show|list|see|view|check|get|display)\s+(?:me\s+)?(?:my\s+|all\s+|the\s+|any\s+)*(?:reminders?|alarms?)"
    r"|what\s+(?:reminders?|alarms?)\s+(?:do\s+i|have\s+i|did\s+i|are\s+(?:there|set))"
    r"|how\s+many\s+(?:reminders?|alarms?))\b",
    re.I
)

LIST_CANCEL_REPLIES = [
    "No cancel button yet, mate. Once it's set, it's set. Think before ya type.",
    "Can't list or cancel 'em yet, the dev's too slack. Just ignore the alarm like ya ignore everything else.",
    "Nope. Dev hasn't built that bit. Ya want it gone? Ignore it when it goes off.",
    "That's for the next version, mate. Till then, whatever ya set stays set.",
]


FILLER = re.compile(
    r"^(?:test(?:ing)?(?:\s+(?:test|1|2|3|123))*|123|1234|hello\s+world|asdf\w*|qwerty\w*|zxcv\w*|ping|pong"
    r"|lol+|lmao+|rofl|haha+|hehe+|hmm+|hm+|um+|uh+|ok(?:ay)?|k|kk|yes|yeah|yep|yup|ya|no|nah|nope|idk|bruh+|bro"
    r"|huh|what|wat|wtf|why|nothing|nvm|never\s*mind|cool|nice|wow|oh|ah|aha|right|sure|fine|whatever|\?+|\.+|!+|…)"
    r"[\W_]*$",
    re.I
)

GIBBERISH = re.compile(r"^(?:[^aeiou\W\d_]{4,}|(\w)\1{3,}|(?:ha|he|lo|ba|na){3,})[\W_]*$", re.I)

FILLER_REPLIES = [
    "Testing, are we? I'm not a bloody microphone, mate. Task and a time.",
    "Ya gonna type something useful or just breathe at me?",
    "Words, mate. Use words. A task and a time.",
    "Is that all ya got? Task and a time.",
    "Ya sound like me mate after a few schooners. Task and a time.",
]


NON_ENGLISH_REPLIES = [
    "Oi, I'm an Aussie, I only speak English, ya little bugger. Try again in proper English.",
    "Mate, English is the only language I've got, and half of that's swearing. Try again.",
    "Speak English, ya drongo! Only language I know. Task and a time, in English.",
    "No speak-a ya language, mate. I'm from Straya. English or nothing.",
    "Sorry mate, true blue Aussie here, English only. Google Translate's free, use it and come back.",
]

ENGLISH_COMMON = frozenset((
    "a an the and or but if so to of in on at by for from with without about as is are was were be been am do does "
    "did have has had it its this that these those i me my we us our you your he him his she her they them their "
    "what who when where why how which not no yes can could will would should may might must just please ok okay "
    "hi hello hey thanks thank mate call text email meet meeting remind reminder tomorrow today tonight morning "
    "afternoon evening night noon midnight minute minutes min mins hour hours hr hrs day days week weeks next later "
    "soon now go going get got take make buy pick up drop off pay check send ring phone mum mom dad gym lunch "
    "dinner breakfast work school pill pills water drink eat walk run study sleep wake bed shower wash clean cook feed"
).split())


FOREIGN_TELLTALES = frozenset((
    "nhac toi phut nua gio ngay uong nuoc khong roi cua nhe chieu tuan viec "
    "hola gracias recuerdame recuerda llamar manana minutos quiero necesito favor dentro hoy noche "
    "bonjour merci rappelle rappeler demain moi pour avec dois soir heures appeler maman "
    "hallo danke bitte erinnere erinnerung ich und nicht uhr minuten stunde heute abend "
    "obrigado obrigada lembrar amanha ricordami domani grazie preciso "
    "ingatkan besok menit tolong kasih saya nanti pengingat pagi malam"
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
    (INJECTION, INJECTION_REPLIES),
    (INSULT, INSULT_REPLIES),
    (FLIRT, FLIRT_REPLIES),
    (SAD, SAD_REPLIES),
    (WEATHER, WEATHER_REPLIES),
    (JOKE, JOKE_REPLIES),
    (WRITE_REQ, WRITE_REPLIES),
]


def canned_reply(text, ctx):

    t = ' '.join(text.split())

    for rx, bank in ALWAYS_CANNED:
        if rx.search(t):
            return random.choice(bank).format(**ctx)

    if TASK_CUE.search(t) or CLOCK_TIME.search(t):
        return None

    for rx, bank in GUARDED_CANNED:
        if rx.search(t):
            return random.choice(bank).format(**ctx)

    if QUESTIONISH.match(t) or t.endswith('?'):
        return random.choice(OFFTOPIC_REPLIES).format(**ctx)

    return None


YES_RE = re.compile(
    r"^(?:yes|yeah|yep|yup|yea|ya|y|ok(?:ay)?|sure|do\s+it|go(?:\s+(?:on|ahead))?|confirm(?:ed)?|keen|i'?m\s+keen"
    r"|fine|alright|righto|ripper|bring\s+it|sweet|please|yes\s+please|keep\s+it(?:\s+open)?)[\W_]*$",
    re.I
)

NO_RE = re.compile(
    r"^(?:no|nah|nope|n|nay|cancel|stop|forget\s+it|nevermind|never\s+mind|nvm|scrap\s+it|bin\s+it|no\s+thanks"
    r"|yeah\s+nah|nah\s+mate)[\W_]*$",
    re.I
)


FAR_WARN_REPLIES = [
    "{when}? That's {away} away, ya optimist. Dev hasn't built the email alarm yet, so this tab has to stay open the whole time. Close it and I can't yell at ya. Still keen?",
    "Oi, {away}? Ya reckon ya can leave this tab open that long? Laptop'll sleep, phone'll die, Chrome'll crash. No email alarm yet, dev's too slack. Want it anyway?",
    "Righto, {when}, that's {away} from now. Fair warning: shut this tab and I'm useless. No emails, no texts, nothing. Dev hasn't got round to it. Yeah or nah?",
    "Mate, {away} is ages. I can only ring ya if this tab stays open, and the dev still hasn't done the email alarm. So. Are ya keeping the tab open or what?",
    "That's {away} away, mate. Ya gonna babysit this tab till {when}? That's the deal until the dev builds the email alarm. Which, knowing him, is never.",
]

CONFIRM_NUDGES = [
    "Keep that tab open, yeah?",
    "Don't ya dare close this tab.",
    "Tab stays open, or I'm useless.",
    "Leave the tab alone till then.",
]

CANCEL_REPLIES = [
    "Then stop wasting me bloody tokens, mate. They cost real money.",
    "Nah? Then why'd ya ask, ya flog. Stop wasting me tokens.",
    "Right, binned it. Don't waste me tokens on a maybe next time.",
    "No worries. But I'm on a budget here, so make up ya mind before ya type.",
    "Cheers for nothing, mate. Me tokens aren't free, ya know.",
]

NO_PENDING_REPLIES = [
    "Too slow, mate. That one's gone cold. Tell us again.",
    "Nothing waiting on me end. Give us a task and a time.",
    "Yeah nah, I've got nothing to confirm. Start again.",
]


def humanize_delta(minutes):
    minutes = int(minutes)
    if minutes >= 2880:
        return f"{minutes // 1440} days"
    if minutes >= 120:
        return f"about {int(minutes / 60 + 0.5)} hours"
    return f"{minutes} minutes"


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
        raise RuntimeError("TTS_URL is not configured")

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
        raise RuntimeError(f"TTS HTTP {e.code}: {body[:300]}")

    if not result.get("success") or not result.get("s3_key"):
        raise RuntimeError(f"TTS bad response: {result}")

    return result


def safe_generate_audio(job):

    try:
        return job, generate_alarm_audio(job["alarm_text"], job["reminder_id"]), None
    except Exception as e:
        return job, None, repr(e)


def set_audio_status(job, status, result=None):


    key = {PK: job["chat_id"], SK: job["time"]}
    condition = '#rid = :rid'

    try:
        if status == "READY":
            table.update_item(
                Key=key,
                UpdateExpression='SET #as = :st, #ak = :k, #av = :v',
                ConditionExpression=condition,
                ExpressionAttributeNames={
                    '#as': AUDIO_STATUS,
                    '#ak': AUDIO_S3_KEY,
                    '#av': AUDIO_VOICE,
                    '#rid': REMINDER_ID
                },
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
                UpdateExpression='SET #as = :st',
                ConditionExpression=condition,
                ExpressionAttributeNames={
                    '#as': AUDIO_STATUS,
                    '#rid': REMINDER_ID
                },
                ExpressionAttributeValues={
                    ':st': status,
                    ':rid': job["reminder_id"]
                }
            )

    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            print("AUDIO SKIPPED (item overwritten):", job["reminder_id"])
        else:
            print("AUDIO STATUS UPDATE ERROR:", job["reminder_id"], repr(e))

    except Exception as e:
        print("AUDIO STATUS UPDATE ERROR:", job["reminder_id"], repr(e))


def make_label(dt, now):
    label = dt.strftime('%H:%M')
    if dt.date() != now.date():
        label = f"{dt.strftime('%a %d/%m')} {label}"
    return label


def prepare_reminders(data_list, now):

    prepared = []

    for data in data_list:
        reminder_msg = str(data.get('msg') or 'Task missing').strip()[:90]
        alarm_text = str(data.get('alarm_text') or reminder_msg).strip()[:200]

        dt = resolve_datetime(data, now)

        if dt is None:
            print("INVALID REMINDER DATETIME:", data)
            continue

        prepared.append({
            'msg': reminder_msg,
            'alarm_text': alarm_text,
            'time': int(dt.strftime('%Y%m%d%H%M')),
            'label': make_label(dt, now),
            'minutes_away': (dt - now).total_seconds() / 60
        })

    return prepared


def save_reminders(chat_id, prepared, use_tts):


    labels = []
    audio_jobs = {}

    for p in prepared:
        reminder_id = str(uuid.uuid4())

        table.put_item(
            Item={
                PK: chat_id,
                SK: p['time'],
                TASK: p['msg'],
                ALARM_TEXT: p['alarm_text'],
                REMINDER_ID: reminder_id,
                AUDIO_STATUS: 'PENDING' if use_tts else 'SKIPPED',
                STATUS: 'PENDING',
                CREATED_AT: int(time.time())
            }
        )


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


    jobs = list(audio_jobs.values())

    if jobs:
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            outcomes = list(pool.map(safe_generate_audio, jobs))

        for job, result, error in outcomes:
            if result:
                print("TTS OK:", job["reminder_id"], result.get("voice"))
                set_audio_status(job, "READY", result)
            else:
                print("TTS FAILED:", job["reminder_id"], error)
                set_audio_status(job, "FAILED")

    return labels


def save_pending(chat_id, prepared, reply_text):
    pending_id = str(uuid.uuid4())

    table.put_item(
        Item={
            PK: PENDING_PREFIX + chat_id,
            SK: 0,
            PENDING_ID: pending_id,
            PENDING_EXPIRES: int(time.time()) + PENDING_TTL,
            PENDING_REPLY: str(reply_text).strip()[:200] if reply_text else '',
            PENDING_REMINDERS: [
                {
                    TASK: p['msg'],
                    ALARM_TEXT: p['alarm_text'],
                    SK: p['time'],
                    LABEL: p['label']
                }
                for p in prepared
            ]
        }
    )

    return pending_id


def claim_pending(chat_id, pending_id=''):

    condition = 'attribute_exists(#pr) AND #pe > :now'
    values = {':now': int(time.time())}

    if pending_id:
        condition += ' AND #pi = :pid'
        values[':pid'] = pending_id

    try:
        result = table.update_item(
            Key={PK: PENDING_PREFIX + chat_id, SK: 0},
            UpdateExpression='REMOVE #pr, #pe, #pi, #prp',
            ConditionExpression=condition,
            ExpressionAttributeNames={
                '#pr': PENDING_REMINDERS,
                '#pe': PENDING_EXPIRES,
                '#pi': PENDING_ID,
                '#prp': PENDING_REPLY
            },
            ExpressionAttributeValues=values,
            ReturnValues='ALL_OLD'
        )
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise

    return result.get('Attributes')


def handle_pending(chat_id, action, pending_id, use_tts, typed=False):


    attrs = claim_pending(chat_id, pending_id)

    if not attrs:
        return None if typed else respond(200, random.choice(NO_PENDING_REPLIES))

    if action == 'cancel':
        return respond(200, random.choice(CANCEL_REPLIES))

    prepared = [
        {
            'msg': str(r[TASK]),
            'alarm_text': str(r[ALARM_TEXT]),
            'time': int(r[SK]),
            'label': str(r[LABEL])
        }
        for r in attrs[PENDING_REMINDERS]
    ]

    labels = save_reminders(chat_id, prepared, use_tts)

    base = str(attrs.get(PENDING_REPLY) or '').strip() or f"✅ Locked in for {', '.join(labels)}."
    return respond(200, f"{base} {random.choice(CONFIRM_NUDGES)}")


def build_far_warning(p):
    return random.choice(FAR_WARN_REPLIES).format(
        when=p['label'],
        away=humanize_delta(p['minutes_away'])
    )


def lambda_handler(event, context):
    event = event or {}

    if event.get('httpMethod') == 'OPTIONS':
        return respond(200, 'OK')

    try:


        raw_body = event.get('body') or '{}'
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body

        chat_id = str(body.get('user_id', 'web_user'))


        use_tts = str(body.get('voice_mode', 'special')).lower() != 'original'


        action = str(body.get('action', '')).lower()

        if action in ('confirm', 'cancel'):
            return handle_pending(
                chat_id, action, str(body.get('pending_id') or ''), use_tts
            )

        user_text = str(body.get('task_input', ''))[:150]

        if not user_text.strip():
            return respond(200, 'No input')

        melbourne_now = datetime.now(TZ)


        if CRISIS.search(user_text):
            return respond(200, CRISIS_REPLY)


        if YES_RE.match(user_text.strip()):
            reply = handle_pending(chat_id, 'confirm', '', use_tts, typed=True)
            if reply:
                return reply
        elif NO_RE.match(user_text.strip()):
            reply = handle_pending(chat_id, 'cancel', '', use_tts, typed=True)
            if reply:
                return reply

        if looks_non_english(user_text):
            return respond(200, random.choice(NON_ENGLISH_REPLIES))

        ctx = {
            'time': melbourne_now.strftime('%I:%M%p').lstrip('0').lower(),
            'day': melbourne_now.strftime('%A'),
            'date': melbourne_now.strftime('%d %b').lstrip('0')
        }

        canned = canned_reply(user_text, ctx)
        if canned:
            return respond(200, canned)

        if not TIME_HINT.search(user_text):
            return respond(200, random.choice(OFFTOPIC_REPLIES))


        token_key = f"{TOKEN_KEY_PREFIX}{melbourne_now.strftime('%Y%m%d')}"

        daily_token_limit = get_daily_token_cap()
        current_tokens = 0

        try:
            usage_res = table.get_item(Key={PK: token_key, SK: 0})
            current_tokens = int(
                usage_res.get('Item', {}).get(TOTAL_TOKENS, 0)
            )

            if current_tokens >= daily_token_limit:
                return respond(
                    429,
                    '⚠️ Limit reached for today. Try again tomorrow!'
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
            "TOKENS USED:", used_tokens,
            "| TODAY TOTAL:", current_tokens + used_tokens,
            "/", daily_token_limit
        )


        if used_tokens > 0:
            try:
                table.update_item(
                    Key={PK: token_key, SK: 0},
                    UpdateExpression='ADD #tt :val',
                    ConditionExpression=(
                        'attribute_not_exists(#tt) '
                        'or #tt < :limit'
                    ),
                    ExpressionAttributeNames={'#tt': TOTAL_TOKENS},
                    ExpressionAttributeValues={
                        ':val': used_tokens,
                        ':limit': daily_token_limit
                    }
                )

            except botocore.exceptions.ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    return respond(429, '⚠️ Limit reached strictly for today!')
                raise


        parsed = parse_model_json(response_body['content'][0]['text'])


        if isinstance(parsed, dict) and parsed.get('non_english'):
            return respond(200, random.choice(NON_ENGLISH_REPLIES))

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


        far = [p for p in prepared if p['minutes_away'] > FAR_REMINDER_MINUTES]

        if far:
            pending_id = save_pending(chat_id, prepared, reply_text)
            return respond(
                200,
                build_far_warning(far[0]),
                needs_confirm=True,
                pending_id=pending_id
            )


        confirmed_times = save_reminders(chat_id, prepared, use_tts) if prepared else []


        if not confirmed_times:
            fallback = (
                "Reckon I missed that one, mate. "
                "Give us a task and a time!"
            )
        else:
            fallback = f"✅ Alright, at {', '.join(confirmed_times)}!"

        message = str(reply_text).strip()[:200] if reply_text else fallback

        return respond(200, message or fallback)

    except Exception as e:
        print("ERROR:", repr(e))

        return respond(
            200,
            "Bloody hell, my brain just short-circuited. "
            "Try that again, mate!"
        )
