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
    "amazon connect",
    "connect customer",
    "contact center",
    "contact centre",
    "contact lens",
    "agent workspace",
    "routing profile",
    "queue",
    "after contact work",
    "acw",
    "connect cases",
    "connect customer profiles",
    "outbound campaigns"
  ],

  "Amazon Bedrock": [
    "amazon bedrock",
    "bedrock",
    "agentcore",
    "bedrock agents",
    "foundation model"
  ],

  "Amazon Lex": [
    "amazon lex",
    "lex v2",
    "lex bot"
  ],

  "AWS Lambda": [
    "aws lambda",
    "lambda function",
    "lambda functions"
  ],

  "DynamoDB": [
    "amazon dynamodb",
    "dynamodb"
  ],

  "API Gateway": [
    "amazon api gateway",
    "api gateway"
  ],

  "CloudWatch": [
    "amazon cloudwatch",
    "cloudwatch"
  ],

  "CloudTrail": [
    "aws cloudtrail",
    "cloudtrail"
  ],

  "Kinesis": [
    "amazon kinesis",
    "kinesis data streams",
    "kinesis video streams",
    "kinesis firehose"
  ],

  "EventBridge": [
    "amazon eventbridge",
    "eventbridge"
  ],

  "S3": [
    "amazon s3",
    "s3 bucket"
  ],

  "Step Functions": [
    "aws step functions",
    "step functions"
  ],

  "SQS": [
    "amazon sqs",
    "sqs"
  ],

  "SNS": [
    "amazon sns",
    "sns"
  ],

  "Amazon Transcribe": [
    "amazon transcribe",
    "transcribe"
  ],

  "Amazon Polly": [
    "amazon polly",
    "polly"
  ],

  "Amazon Q": [
    "amazon q",
    "q in connect",
    "amazon q in connect"
  ],

  "AI": [
    "generative ai",
    "generative-ai",
    "agentic ai",
    "agentic",
    "artificial intelligence",
    "machine learning",
    "foundation model",
    "large language model",
    "llm",
    "ai assistant",
    "ai agent",
    "ai agents",
    "model context protocol",
    "mcp"
  ]
};

function xmlText(item, tag) {
  const escapedTag = tag.replace(":", "\\:");

  const regex = new RegExp(
    "<" +
      escapedTag +
      "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" +
      escapedTag +
      ">",
    "i"
  );

  const match = item.match(regex);

  if (!match) return "";

  return decodeXml(
    match[1]
      .trim()
      .replace(
        /<!\[CDATA\[([\s\S]*?)\]\]>/g,
        "$1"
      )
  );
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(
      /&#(\d+);/g,
      (_, number) =>
        String.fromCharCode(Number(number))
    );
}

function stripHtml(value) {
  return value
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ""
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function parseRSS(xml, feed) {
  const blocks =
    xml.match(
      /<item[\s\S]*?<\/item>/gi
    ) || [];

  return blocks
    .map(block => {
      const title = xmlText(block, "title");

      const description = stripHtml(
        xmlText(block, "description")
      );

      const date =
        xmlText(block, "pubDate") ||
        xmlText(block, "dc:date");

      const url =
        xmlText(block, "link") ||
        xmlText(block, "guid");

      const combined =
        `${title} ${description}`.toLowerCase();

      const services = [
        ...feed.defaultServices
      ];

      for (
        const [service, rules]
        of Object.entries(SERVICE_RULES)
      ) {
        if (
          rules.some(rule =>
            combined.includes(
              rule.toLowerCase()
            )
          )
        ) {
          if (!services.includes(service)) {
            services.push(service);
          }
        }
      }

      return {
        title,
        description,
        date,
        url,
        services,
        categories: services
      };
    })
    .filter(item =>
      item.title && item.url
    );
}

async function fetchFeed(feed) {
  const response = await fetch(
    feed.url,
    {
      headers: {
        "User-Agent":
          "NK-AWS-Updates/1.0"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `${feed.name}: HTTP ${response.status}`
    );
  }

  const xml =
    await response.text();

  return parseRSS(
    xml,
    feed
  );
}

export default {
  async fetch(request, env) {

    const url =
      new URL(request.url);

    /*
     * LIVE AWS API
     */
    if (
      url.pathname ===
      "/api/aws-updates"
    ) {

      if (request.method !== "GET") {
        return new Response(
          "Method not allowed",
          { status: 405 }
        );
      }

      const results =
        await Promise.allSettled(
          FEEDS.map(fetchFeed)
        );

      let items = [];

      for (const result of results) {
        if (
          result.status ===
          "fulfilled"
        ) {
          items.push(
            ...result.value
          );
        }
      }

      const seen = new Set();

      const unique =
        items.filter(item => {

          const key =
            item.url ||
            item.title;

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);

          return true;
        });

      unique.sort((a, b) => {
        const dateA =
          new Date(
            a.date || 0
          ).getTime();

        const dateB =
          new Date(
            b.date || 0
          ).getTime();

        return dateB - dateA;
      });

      return new Response(
        JSON.stringify({
          generatedAt:
            new Date().toISOString(),

          source:
            "Official AWS RSS feeds",

          items:
            unique.slice(0, 150)
        }),
        {
          headers: {
            "Content-Type":
              "application/json; charset=UTF-8",

            "Cache-Control":
              "public, max-age=300",

            "Access-Control-Allow-Origin":
              "*"
          }
        }
      );
    }

    /*
     * WEBSITE
     *
     * / -> aws-updates.html
     */
    if (url.pathname === "/") {

      const pageURL =
        new URL(request.url);

      pageURL.pathname =
        "/aws-updates.html";

      return env.ASSETS.fetch(
        new Request(
          pageURL,
          request
        )
      );
    }

    /*
     * Allow direct access to
     * /aws-updates.html
     */
    if (
      url.pathname ===
      "/aws-updates.html"
    ) {
      return env.ASSETS.fetch(
        request
      );
    }

    /*
     * Other static files
     */
    return env.ASSETS.fetch(
      request
    );
  }
};
