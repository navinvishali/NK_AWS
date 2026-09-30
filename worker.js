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


/* =====================================================
   XML HELPERS
===================================================== */

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

  if (!match) {
    return "";
  }

  return decodeXml(
    match[1]
      .trim()
      .replace(
        /<!\[CDATA\[([\s\S]*?)\]\]>/g,
        "$1"
      )
  );
}


/* =====================================================
   XML DECODE
===================================================== */

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
      function (_, number) {
        return String.fromCharCode(
          Number(number)
        );
      }
    );
}


/* =====================================================
   REMOVE HTML FROM DESCRIPTION
===================================================== */

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


/* =====================================================
   PARSE RSS
===================================================== */

function parseRSS(xml, feed) {

  const blocks =
    xml.match(
      /<item[\s\S]*?<\/item>/gi
    ) || [];

  return blocks
    .map(function (block) {

      const title =
        xmlText(
          block,
          "title"
        );

      const description =
        stripHtml(
          xmlText(
            block,
            "description"
          )
        );

      const date =
        xmlText(
          block,
          "pubDate"
        ) ||
        xmlText(
          block,
          "dc:date"
        );

      const url =
        xmlText(
          block,
          "link"
        ) ||
        xmlText(
          block,
          "guid"
        );


      const combined =
        (
          title +
          " " +
          description
        ).toLowerCase();


      const services = [
        ...feed.defaultServices
      ];


      /*
       * Detect relevant AWS services
       */

      for (
        const [service, rules]
        of Object.entries(
          SERVICE_RULES
        )
      ) {

        const matched =
          rules.some(
            function (rule) {

              return combined.includes(
                rule.toLowerCase()
              );

            }
          );


        if (
          matched &&
          !services.includes(service)
        ) {

          services.push(
            service
          );

        }

      }


      return {

        title: title,

        description: description,

        date: date,

        url: url,

        services: services,

        categories: services

      };

    })
    .filter(function (item) {

      return (
        item.title &&
        item.url
      );

    });
}


/* =====================================================
   FETCH ONE FEED
===================================================== */

async function fetchFeed(feed) {

  const response =
    await fetch(
      feed.url,
      {
        headers: {
          "User-Agent":
            "NK-AWS-Updates/1.0"
        },

        cf: {
          cacheTtl: 900,
          cacheEverything: true
        }
      }
    );


  if (!response.ok) {

    throw new Error(
      feed.name +
      ": HTTP " +
      response.status
    );

  }


  const xml =
    await response.text();


  return parseRSS(
    xml,
    feed
  );
}


/* =====================================================
   CLOUDFLARE WORKER
===================================================== */

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(
        request.url
      );


    /*
     * Only allow our API endpoint
     */

    if (
      url.pathname !==
      "/api/aws-updates"
    ) {

      return new Response(
        "Not found",
        {
          status: 404
        }
      );

    }


    /*
     * Only GET requests
     */

    if (
      request.method !== "GET"
    ) {

      return new Response(
        "Method not allowed",
        {
          status: 405
        }
      );

    }


    /*
     * Fetch all AWS feeds
     */

    const results =
      await Promise.allSettled(
        FEEDS.map(
          fetchFeed
        )
      );


    /*
     * Combine successful feeds
     */

    let items = [];


    for (
      const result
      of results
    ) {

      if (
        result.status ===
        "fulfilled"
      ) {

        items.push(
          ...result.value
        );

      }

    }


    /*
     * Remove duplicates
     */

    const seen =
      new Set();


    const unique =
      items.filter(
        function (item) {

          const key =
            item.url ||
            item.title;


          if (
            seen.has(key)
          ) {

            return false;

          }


          seen.add(key);

          return true;

        }
      );


    /*
     * Newest first
     */

    unique.sort(
      function (a, b) {

        const dateA =
          new Date(
            a.date || 0
          ).getTime();


        const dateB =
          new Date(
            b.date || 0
          ).getTime();


        return (
          dateB -
          dateA
        );

      }
    );


    /*
     * Return maximum 150 updates
     */

    const responseBody =
      JSON.stringify(
        {
          generatedAt:
            new Date().toISOString(),

          source:
            "Official AWS RSS feeds",

          items:
            unique.slice(
              0,
              150
            )
        }
      );


    return new Response(
      responseBody,
      {
        status: 200,

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

};
