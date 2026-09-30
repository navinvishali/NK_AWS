const AWS_WHATS_NEW_API = "https://aws.amazon.com/api/dirs/items/search";

const LOOKBACK_DAYS = 90;
const PAGE_SIZE = 100;
const BATCH_SIZE = 5;
const MAX_PAGES = 25;

// Known AWS category names.
// This is only for nicer display — it does NOT restrict which
// AWS services/products can appear.
const CATEGORY_LABELS = {
  analytics: "Analytics",
  "application-services": "Application Integration",
  "artificial-intelligence": "Artificial Intelligence",
  "business-productivity": "Business Applications",
  compute: "Compute",
  "contact-center": "Contact Center",
  databases: "Databases",
  "developer-tools": "Developer Tools",
  "front-end-web-mobile": "End User Computing",
  "game-development": "Game Tech",
  "internet-of-things": "Internet of Things",
  "management-tools": "Management Tools",
  "media-services": "Media Services",
  migration: "Migration & Modernization",
  "mobile-services": "Multicloud & Hybrid",
  "networking-and-content-delivery": "Networking & Content Delivery",
  "partner-network": "Partners",
  "security-identity-and-compliance": "Security & Identity",
  storage: "Storage",
  "training-and-certification": "Training & Certification"
};


// Known product names for better display.
//
// IMPORTANT:
// This is NOT the service list.
//
// If AWS introduces a new service/product that isn't here,
// the code automatically generates a readable name from
// the AWS product slug.
const PRODUCT_LABELS = {
  "amazon-connect": "Amazon Connect",
  "amazon-bedrock": "Amazon Bedrock",
  "amazon-bedrock-agentcore": "Amazon Bedrock AgentCore",

  "aws-lambda": "AWS Lambda",
  "amazon-dynamodb": "Amazon DynamoDB",
  "amazon-api-gateway": "Amazon API Gateway",
  "amazon-cloudwatch": "Amazon CloudWatch",
  "aws-cloudtrail": "AWS CloudTrail",
  "amazon-kinesis": "Amazon Kinesis",
  "amazon-lex": "Amazon Lex",

  "amazon-s3": "Amazon S3",
  "amazon-eventbridge": "Amazon EventBridge",
  "amazon-sqs": "Amazon SQS",
  "amazon-sns": "Amazon SNS",

  "amazon-transcribe": "Amazon Transcribe",
  "amazon-polly": "Amazon Polly",
  "amazon-q": "Amazon Q",

  "aws-step-functions": "AWS Step Functions",

  "amazon-ec2": "Amazon EC2",
  "amazon-ecs": "Amazon ECS",
  "amazon-eks": "Amazon EKS",

  "amazon-cloudformation": "AWS CloudFormation",
  "aws-iam": "AWS Identity and Access Management",

  "amazon-sagemaker": "Amazon SageMaker",
  "amazon-opensearch-service": "Amazon OpenSearch Service"
};


// Convert AWS slug into a readable product name.
//
// Example:
//
// amazon-new-service
// ↓
// Amazon New Service
//
// aws-new-service
// ↓
// AWS New Service
//
// This means newly introduced products don't need to be
// manually added above.
function slugToLabel(value) {

  if (!value) {
    return "";
  }

  const slug = String(value)
    .replace(/^whats-new-v2#/i, "")
    .split("#")
    .pop()
    .trim();

  if (!slug) {
    return "";
  }

  if (PRODUCT_LABELS[slug]) {
    return PRODUCT_LABELS[slug];
  }

  return slug
    .replace(/^aws-/, "AWS ")
    .replace(/^amazon-/, "Amazon ")
    .replace(/-service$/i, " Service")
    .split("-")
    .map(word =>
      word
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : ""
    )
    .join(" ")
    .replace(/\bApi\b/g, "API")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSdk\b/g, "SDK")
    .replace(/\bIam\b/g, "IAM")
    .replace(/\bEc2\b/g, "EC2")
    .replace(/\bEcs\b/g, "ECS")
    .replace(/\bEks\b/g, "EKS")
    .replace(/\bS3\b/g, "S3")
    .replace(/\bSqs\b/g, "SQS")
    .replace(/\bSns\b/g, "SNS")
    .replace(/\bIot\b/g, "IoT");
}


// Make sure a value is always treated as an array.
function asArray(value) {

  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  return [value];
}


// Clean AWS tags.
function cleanTag(value) {

  if (typeof value === "string") {

    return value
      .replace(/^whats-new-v2#/i, "")
      .replace(/^products#/i, "")
      .replace(/^product#/i, "")
      .trim();

  }

  if (value && typeof value === "object") {

    return cleanTag(
      value.slug ??
      value.id ??
      value.name ??
      value.label ??
      value.value ??
      ""
    );

  }

  return "";
}


// Extract product/category labels from AWS response.
function extractTagLabels(values) {

  return asArray(values)
    .flatMap(value => {

      if (typeof value === "string") {
        return [cleanTag(value)];
      }

      if (value && typeof value === "object") {

        return [
          value.slug,
          value.id,
          value.name,
          value.label,
          value.value
        ]
          .filter(Boolean)
          .map(cleanTag);
      }

      return [];

    })
    .filter(Boolean);
}


// Recursively search AWS response for announcement objects.
function collectAnnouncementObjects(
  node,
  output = [],
  depth = 0
) {

  if (!node || depth > 8) {
    return output;
  }

  if (Array.isArray(node)) {

    for (const child of node) {

      collectAnnouncementObjects(
        child,
        output,
        depth + 1
      );

    }

    return output;
  }

  if (typeof node !== "object") {
    return output;
  }

  const headline =
    node.headline ??
    node.title ??
    node.item?.headline ??
    node.item?.title;

  const date =
    node.publishedAt ??
    node.postDateTime ??
    node.item?.publishedAt ??
    node.item?.postDateTime ??
    node.additionalFields?.postDateTime ??
    node.item?.additionalFields?.postDateTime;

  if (headline && date) {
    output.push(node);
  }

  for (const value of Object.values(node)) {

    if (value && typeof value === "object") {

      collectAnnouncementObjects(
        value,
        output,
        depth + 1
      );

    }

  }

  return output;
}


// Return the first useful string.
function firstString(...values) {

  for (const value of values) {

    if (
      typeof value === "string" &&
      value.trim()
    ) {

      return value.trim();

    }

  }

  return "";
}


// Convert AWS announcement object into our standard format.
function normalizeAnnouncement(raw) {

  const item =
    raw.item &&
    typeof raw.item === "object"
      ? raw.item
      : raw;

  const fields =
    item.additionalFields ??
    raw.additionalFields ??
    {};


  const headline = firstString(
    item.headline,
    raw.headline,
    fields.headline,
    fields.title,
    item.title,
    raw.title
  );


  const publishedAt = firstString(
    item.publishedAt,
    raw.publishedAt,
    item.postDateTime,
    raw.postDateTime,
    fields.postDateTime,
    item.additionalFields?.postDateTime
  );


  const id =
    firstString(
      item.id,
      raw.id,
      item.itemId,
      raw.itemId,
      fields.id
    ) ||
    `${headline}-${publishedAt}`;


  const url = firstString(
    item.url,
    raw.url,
    item.headlineUrl,
    raw.headlineUrl,
    fields.url,
    fields.headlineUrl
  );


  const summary = firstString(
    item.summary,
    raw.summary,
    fields.summary,
    item.description,
    raw.description
  );


  const body = firstString(
    item.body,
    raw.body,
    item.postBody,
    raw.postBody,
    fields.body,
    fields.postBody
  );


  const products = extractTagLabels(
    item.products ??
    raw.products ??
    fields.products ??
    item.product ??
    raw.product
  );


  const categories = extractTagLabels(
    item.categories ??
    raw.categories ??
    fields.categories ??
    item.category ??
    raw.category
  );


  return {

    id,

    headline,

    publishedAt,

    url:
      url.startsWith("http")
        ? url
        : url
          ? `https://aws.amazon.com${
              url.startsWith("/")
                ? ""
                : "/"
            }${url}`
          : "https://aws.amazon.com/new/",

    summary:
      summary || null,

    body:
      body || null,

    products,

    categories

  };
}


// Fetch one page from AWS What's New.
async function fetchWhatsNewPage(page) {

  const url =
    new URL(AWS_WHATS_NEW_API);

  url.searchParams.set(
    "item.directoryId",
    "whats-new-v2"
  );

  url.searchParams.set(
    "item.locale",
    "en_US"
  );

  url.searchParams.set(
    "sort_by",
    "item.additionalFields.postDateTime"
  );

  url.searchParams.set(
    "sort_order",
    "desc"
  );

  url.searchParams.set(
    "size",
    String(PAGE_SIZE)
  );

  url.searchParams.set(
    "page",
    String(page)
  );


  const response = await fetch(
    url,
    {
      headers: {
        "accept":
          "application/json, text/plain, */*",

        "user-agent":
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
      `AWS What's New API returned ${response.status}`
    );

  }


  return response.json();
}


// Normalize AWS page response.
function normalizePage(payload) {

  let candidates = [];


  if (Array.isArray(payload?.items)) {

    candidates =
      payload.items;

  }

  else if (
    Array.isArray(
      payload?.data?.items
    )
  ) {

    candidates =
      payload.data.items;

  }

  else if (
    Array.isArray(
      payload?.result?.items
    )
  ) {

    candidates =
      payload.result.items;

  }

  else if (
    Array.isArray(
      payload?.metadata?.items
    )
  ) {

    candidates =
      payload.metadata.items;

  }

  else if (
    Array.isArray(
      payload?.metadata?.result?.items
    )
  ) {

    candidates =
      payload.metadata.result.items;

  }


  // Fallback if AWS changes the response structure.
  if (!candidates.length) {

    candidates =
      collectAnnouncementObjects(
        payload
      );

  }


  const seen =
    new Set();

  const items =
    [];


  for (
    const candidate
    of candidates
  ) {

    const item =
      normalizeAnnouncement(
        candidate
      );


    if (
      !item.headline ||
      !item.publishedAt
    ) {

      continue;

    }


    if (
      seen.has(item.id)
    ) {

      continue;

    }


    seen.add(item.id);

    items.push(item);

  }


  const total =
    Number(
      payload?.total ??
      payload?.totalHits ??
      payload?.metadata?.total ??
      payload?.metadata?.totalHits ??
      payload?.result?.total
    ) || null;


  return {
    items,
    total
  };

}


// Remove HTML from announcement body.
function cleanHtml(value) {

  if (!value) {
    return "";
  }


  return String(value)

    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )

    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )

    .replace(
      /<[^>]+>/g,
      " "
    )

    .replace(
      /&nbsp;/gi,
      " "
    )

    .replace(
      /&amp;/gi,
      "&"
    )

    .replace(
      /&quot;/gi,
      '"'
    )

    .replace(
      /&#39;/gi,
      "'"
    )

    .replace(
      /&lt;/gi,
      "<"
    )

    .replace(
      /&gt;/gi,
      ">"
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();

}


// Determine services/products for an announcement.
function extractProducts(item) {

  const labels =
    item.products
      .map(slugToLabel)
      .filter(Boolean);


  // Extra detection from announcement text.
  //
  // This is only a fallback.
  // It does NOT restrict the AWS service list.
  const text =
    `${item.headline} ${
      item.summary || ""
    } ${
      cleanHtml(item.body || "")
    }`;


  const inferred = [

    [
      "Amazon Connect",
      /\bAmazon Connect\b/i
    ],

    [
      "Amazon Bedrock",
      /\bAmazon Bedrock\b/i
    ],

    [
      "AWS Lambda",
      /\bAWS Lambda\b/i
    ],

    [
      "Amazon DynamoDB",
      /\bAmazon DynamoDB\b/i
    ],

    [
      "Amazon API Gateway",
      /\bAmazon API Gateway\b/i
    ],

    [
      "Amazon CloudWatch",
      /\bAmazon CloudWatch\b/i
    ],

    [
      "AWS CloudTrail",
      /\bAWS CloudTrail\b/i
    ],

    [
      "Amazon Kinesis",
      /\bAmazon Kinesis\b/i
    ],

    [
      "Amazon Lex",
      /\bAmazon Lex\b/i
    ],

    [
      "Amazon S3",
      /\bAmazon S3\b/i
    ],

    [
      "Amazon EventBridge",
      /\bAmazon EventBridge\b/i
    ],

    [
      "Amazon Q",
      /\bAmazon Q\b/i
    ],

    [
      "Amazon SageMaker",
      /\bAmazon SageMaker\b/i
    ]

  ];


  for (
    const [
      label,
      regex
    ]
    of inferred
  ) {

    if (regex.test(text)) {

      labels.push(label);

    }

  }


  return [
    ...new Set(labels)
  ];

}


// Fetch approximately the last 3 months.
//
// Pages are retrieved in batches so the Worker doesn't
// make a huge number of sequential requests.
async function loadThreeMonths() {

  const cutoff =
    Date.now() -
    LOOKBACK_DAYS *
    24 *
    60 *
    60 *
    1000;


  const all = [];

  let stopped = false;


  for (
    let batchStart = 0;

    batchStart < MAX_PAGES &&
    !stopped;

    batchStart += BATCH_SIZE
  ) {


    const pages =
      Array.from(
        {
          length:
            Math.min(
              BATCH_SIZE,
              MAX_PAGES -
              batchStart
            )
        },

        (_, index) =>
          batchStart + index
      );


    const results =
      await Promise.allSettled(
        pages.map(
          fetchWhatsNewPage
        )
      );


    for (
      const result
      of results
    ) {

      if (
        result.status !==
        "fulfilled"
      ) {

        continue;

      }


      const page =
        normalizePage(
          result.value
        );


      all.push(
        ...page.items
      );


      const oldest =
        page.items

          .map(
            item =>
              Date.parse(
                item.publishedAt
              )
          )

          .filter(
            Number.isFinite
          )

          .reduce(
            (
              min,
              value
            ) =>
              Math.min(
                min,
                value
              ),
            Infinity
          );


      if (
        oldest !== Infinity &&
        oldest < cutoff
      ) {

        stopped = true;

      }

    }

  }


  const deduped =
    new Map();


  for (
    const item
    of all
  ) {

    const timestamp =
      Date.parse(
        item.publishedAt
      );


    if (
      !Number.isFinite(
        timestamp
      ) ||
      timestamp < cutoff
    ) {

      continue;

    }


    const products =
      extractProducts(
        item
      );


    const categories =
      item.categories

        .map(
          value =>
            CATEGORY_LABELS[value] ||
            slugToLabel(value)
        )

        .filter(Boolean);


    const normalized = {

      ...item,

      publishedAt:
        new Date(
          timestamp
        ).toISOString(),

      services:
        products,

      products:
        products,

      categories:
        categories,

      excerpt:
        cleanHtml(
          item.summary ||
          item.body ||
          ""
        ).slice(
          0,
          420
        )

    };


    if (
      !deduped.has(
        item.id
      )
    ) {

      deduped.set(
        item.id,
        normalized
      );

    }

  }


  return [
    ...deduped.values()
  ]

    .sort(
      (
        a,
        b
      ) =>
        Date.parse(
          b.publishedAt
        ) -
        Date.parse(
          a.publishedAt
        )
    );

}


// Return JSON response.
function json(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {

        "content-type":
          "application/json; charset=UTF-8",

        "cache-control":
          "public, max-age=900, s-maxage=900"

      }
    }
  );

}


// Cloudflare Worker.
export default {

  async fetch(
    request,
    env
  ) {

    const url =
      new URL(
        request.url
      );


    try {

      // =========================================
      // AWS UPDATES API
      // =========================================

      if (
        url.pathname ===
        "/api/aws-updates"
      ) {

        const items =
          await loadThreeMonths();


        const serviceMap =
          new Map();

        const categoryMap =
          new Map();


        for (
          const item
          of items
        ) {

          for (
            const service
            of item.services
          ) {

            serviceMap.set(
              service,

              (
                serviceMap.get(
                  service
                ) || 0
              ) + 1
            );

          }


          for (
            const category
            of item.categories
          ) {

            categoryMap.set(
              category,

              (
                categoryMap.get(
                  category
                ) || 0
              ) + 1
            );

          }

        }


        // Dynamic service list.
        //
        // This is important:
        //
        // The frontend gets this list directly from
        // the AWS announcements.
        //
        // Therefore a newly appearing AWS product
        // can automatically become a filter.
        const services =
          [
            ...serviceMap.entries()
          ]

            .sort(
              (
                a,
                b
              ) =>
                b[1] -
                a[1] ||
                a[0].localeCompare(
                  b[0]
                )
            )

            .map(
              (
                [
                  name,
                  count
                ]
              ) => ({
                name,
                count
              })
            );


        const categories =
          [
            ...categoryMap.entries()
          ]

            .sort(
              (
                a,
                b
              ) =>
                b[1] -
                a[1] ||
                a[0].localeCompare(
                  b[0]
                )
            )

            .map(
              (
                [
                  name,
                  count
                ]
              ) => ({
                name,
                count
              })
            );


        return json({

          source:
            "AWS What's New public announcement data",

          sourceUrl:
            "https://aws.amazon.com/new/",

          windowDays:
            LOOKBACK_DAYS,

          from:
            new Date(
              Date.now() -
              LOOKBACK_DAYS *
              86400000
            ).toISOString(),

          to:
            new Date().toISOString(),

          updatedAt:
            new Date().toISOString(),

          total:
            items.length,

          services,

          categories,

          items

        });

      }


      // =========================================
      // WEBSITE
      // =========================================

      if (
        url.pathname === "/" ||
        url.pathname ===
        "/aws-updates.html"
      ) {

        return env.ASSETS.fetch(

          new Request(
            new URL(
              "/aws-updates.html",
              request.url
            ),
            request
          )

        );

      }


      // =========================================
      // OTHER STATIC FILES
      // =========================================

      return env.ASSETS.fetch(
        request
      );


    } catch (error) {

      // API error response.
      if (
        url.pathname ===
        "/api/aws-updates"
      ) {

        return json(

          {
            error:
              "Unable to load AWS updates right now.",

            details:
              error instanceof Error
                ? error.message
                : String(error)
          },

          502

        );

      }


      return new Response(
        "Application error",
        {
          status: 500
        }
      );

    }

  }

};
