const FEEDS = [
  {
    name: "AWS What's New",
    url: "https://aws.amazon.com/about-aws/whats-new/recent/feed/",
    defaultServices: []
  },
  {
    name: "Amazon Connect Release Notes",
    url: "https://docs.aws.amazon.com/connect/latest/adminguide/doc-history.xml.rss",
    defaultServices: ["Amazon Connect"]
  },
  {
    name: "AWS News Blog",
    url: "https://aws.amazon.com/blogs/aws/feed/",
    defaultServices: []
  }
];

const SERVICE_RULES = {
  "Amazon Connect": [
    "amazon connect", "connect customer", "contact center", "contact centre",
    "contact lens", "agent workspace", "routing profile", "queue", "after contact work",
    "acw", "connect cases", "connect customer profiles", "outbound campaigns"
  ],
  "Amazon Bedrock": [
    "amazon bedrock", "bedrock", "agentcore", "bedrock agents", "foundation model"
  ],
  "Amazon Lex": ["amazon lex", "lex v2", "lex bot"],
  "AWS Lambda": ["aws lambda", "lambda function", "lambda functions"],
  "DynamoDB": ["amazon dynamodb", "dynamodb"],
  "API Gateway": ["amazon api gateway", "api gateway"],
  "CloudWatch": ["amazon cloudwatch", "cloudwatch"],
  "CloudTrail": ["aws cloudtrail", "cloudtrail"],
  "Kinesis": ["amazon kinesis", "kinesis data streams", "kinesis video streams", "kinesis firehose"],
  "EventBridge": ["amazon eventbridge", "eventbridge"],
  "S3": ["amazon s3", "s3 bucket", "s3"],
  "Step Functions": ["aws step functions", "step functions"],
  "SQS": ["amazon sqs", "sqs"],
  "SNS": ["amazon sns", "sns"],
  "Amazon Transcribe": ["amazon transcribe", "transcribe"],
  "Amazon Polly": ["amazon polly", "polly"],
  "Amazon Q": ["amazon q", "q in connect", "amazon q in connect"],
  "AI": [
    "generative ai", "generative-ai", "agentic ai", "agentic", "artificial intelligence",
    "machine learning", "foundation model", "large language model", "llm",
    "ai assistant", "ai agent", "ai agents", "model context protocol", "mcp"
  ]
};

function xmlText(item, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = item.match(re);
  if (!m) return "";
  return decodeXml(m[1].trim().replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1"));
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripHtml(s) {
  return s.replace(/<script[\\s\\S]*?<\\/script>/gi, "")
          .replace(/<style[\\s\\S]*?<\\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\\s+/g, " ")
          .trim();
}

function parseRSS(xml, feed) {
  const blocks = xml.match(/<item[\\s\\S]*?<\\/item>/gi) || [];
  return blocks.map(block => {
    const title = xmlText(block, "title");
    const description = stripHtml(xmlText(block, "description"));
    const date = xmlText(block, "pubDate") || xmlText(block, "dc:date");
    const url = xmlText(block, "link") || xmlText(block, "guid");

    const combined = `${title} ${description}`.toLowerCase();
    const services = [...feed.defaultServices];

    for (const [service, rules] of Object.entries(SERVICE_RULES)) {
      if (rules.some(rule => combined.includes(rule.toLowerCase()))) {
        if (!services.includes(service)) services.push(service);
      }
    }

    return {
      title,
      description,
      date,
      url,
      services,
      categories: services.includes("AI") ? [...services, "AI"] : services
    };
  }).filter(x => x.title && x.url);
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "NK-AWS-Updates/1.0"
    },
    cf: {
      cacheTtl: 900,
      cacheEverything: true
    }
  });

  if (!response.ok) {
    throw new Error(`${feed.name}: HTTP ${response.status}`);
  }

  return parseRSS(await response.text(), feed);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/aws-updates") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);

    const seen = new Set();
    const unique = items.filter(item => {
      const key = item.url || item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return db - da;
    });

    const body = JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: "Official AWS RSS feeds",
      items: unique.slice(0, 150)
    });

    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*"
      }
    });
  }
};
