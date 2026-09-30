# NK AWS Updates — Live Version

## Files

- `index.html` — responsive AWS Updates page
- `worker.js` — Cloudflare Worker that reads official AWS RSS feeds and returns JSON

## Official feeds used

1. AWS What's New:
   https://aws.amazon.com/about-aws/whats-new/recent/feed/

2. Amazon Connect release notes:
   https://docs.aws.amazon.com/connect/latest/adminguide/doc-history.xml.rss

3. AWS News Blog:
   https://aws.amazon.com/blogs/aws/feed/

## Cloudflare setup

Create a Cloudflare Worker and paste `worker.js`.

Deploy the Worker.

Then configure a Worker Route for your website:

`https://YOUR-DOMAIN.com/api/aws-updates*`

The HTML calls:

`/api/aws-updates`

Therefore the HTML and API stay on the same domain.

## GitHub Pages note

If the HTML is hosted on GitHub Pages while the Worker is hosted on a different Cloudflare Worker subdomain, change:

`const API_URL="/api/aws-updates";`

to the deployed Worker URL, for example:

`const API_URL="https://your-worker.your-subdomain.workers.dev/api/aws-updates";`

Same-domain routing is preferred when your site already uses Cloudflare.

## What the Worker does

- Fetches official AWS RSS feeds
- Combines the feeds
- Detects relevant AWS services from titles/descriptions
- Adds multiple service tags to one announcement
- Removes duplicates
- Sorts newest first
- Returns JSON to the webpage
- Caches feed requests
- Does not require an AWS account or AWS credentials

## Important

The browser page contains no fake/static AWS announcements.
The displayed content comes from the Worker response.

The Worker uses keyword classification so an announcement mentioning multiple relevant services can appear under multiple filters.
