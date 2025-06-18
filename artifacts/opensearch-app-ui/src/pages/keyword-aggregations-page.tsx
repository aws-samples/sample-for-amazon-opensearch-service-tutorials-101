import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import * as React from "react";
import {
  Container,
  ContentLayout,
  Header,
  Button,
  SpaceBetween,
  Cards,
  Box,
  Alert,
  ExpandableSection,
  HelpPanel,
  Icon,
  Grid,
  ProgressBar,
  TextContent,
  ColumnLayout,
  StatusIndicator,
  Link
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

interface AggregationResult {
  categories: {
    buckets: Array<{
      key: string;
      doc_count: number;
    }>;
  };
  colors: {
    buckets: Array<{
      key: string;
      doc_count: number;
    }>;
  };
  price_stats: {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
  };
  price_ranges: {
    buckets: Array<{
      key: string;
      from?: number;
      to?: number;
      doc_count: number;
    }>;
  };
  avg_price_by_category: {
    buckets: Array<{
      key: string;
      doc_count: number;
      avg_price: {
        value: number;
      };
    }>;
  };
}

function AggregationsPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [aggregations, setAggregations] = useState<AggregationResult | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState<"error" | "success" | "warning" | "info">("error");

  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      });
    };
    init();
  }, []);

  const handle_notifications = (message: string, notify_type: "error" | "success" | "warning" | "info") => {
    setAlertMsg(message);
    setAlertType(notify_type);
    setShowAlert(true);
  };

  async function fetchAggregations() {
    const token = appData.userinfo.tokens.idToken.toString();

    const queryBody = {
      type: "complex_search",
      search_type: "aggregations",
      aggregations: [
        {
          type: "terms",
          field: "category",
          name: "categories",
          size: 10
        },
        {
          type: "terms",
          field: "color",
          name: "colors",
          size: 20
        },
        {
          type: "stats",
          field: "price",
          name: "price_stats"
        },
        {
          type: "range",
          field: "price",
          name: "price_ranges",
          ranges: [
            { "to": 5000 },
            { "from": 5000, "to": 10000 },
            { "from": 10000, "to": 15000 },
            { "from": 15000 }
          ]
        },
        {
          type: "nested_stats",
          field: "category",
          name: "avg_price_by_category",
          size: 10,
          metric_name: "avg_price",
          metric_type: "avg",
          metric_field: "price"
        }
      ]
    };

    try {
      const response = await fetch(config["apiUrl"] + "/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        },
        body: JSON.stringify(queryBody)
      });

      if (response.ok) {
        const resp = await response.json();
        setAggregations(resp['result']['aggregations']);
      } else {
        handle_notifications("Index not found, please index the product catalog first", "error")
      }
    } catch (error) {
      handle_notifications("Error fetching aggregations: " + error, "error");
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
      header={
        <Header
          variant="h1"
          description="View product statistics and distributions"
          actions={<Button iconName="refresh" variant="icon" onClick={fetchAggregations} />}>
          Product Aggregations
        </Header>
      }
    >
      <Container fitHeight>
        {showAlert && (
          <Alert
            dismissible
            statusIconAriaLabel={alertType}
            type={alertType}
            onDismiss={() => setShowAlert(false)}
          >
            {alertMsg}
          </Alert>
        )}

        <ExpandableSection headerText="Guide to Aggregations">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://opensearch.org/docs/latest/aggregations/">Link to documentation</a>
                  </li>
                </ul>
              </div>
            }
          >
            <div>
              <p>
                <b>Aggregations</b> in OpenSearch allow you to analyze your data and extract statistics beyond simple search results. They enable real-time analytics on large datasets, performed in milliseconds, though they typically consume more CPU and memory than standard queries.
              </p>

              <h4>Types of Aggregations</h4>
              <ul>
                <li><b>Metric Aggregations:</b> Calculate statistics from field values (min, max, avg, sum, etc.)</li>
                <li><b>Bucket Aggregations:</b> Group documents into "buckets" based on criteria</li>
                <li><b>Pipeline Aggregations:</b> Process the output of other aggregations</li>
              </ul>
              <h4>Prerequisites</h4>
              <ul>
                <li><a href="#/index-documents">Index your documents</a> into OpenSearch first</li>
              </ul>

              <p>
                <b>In our example</b>, let's explore product data with aggregations for insights about categories and prices: 
              </p>

              <pre>
                <code>{
                  JSON.stringify({
                    "aggregations": [
                      {
                        "name": "category_counts",
                        "type": "terms",
                        "field": "category",
                        "size": 10
                      },
                      {
                        "name": "price_stats",
                        "type": "stats",
                        "field": "price"
                      },
                      {
                        "name": "price_ranges",
                        "type": "range",
                        "field": "price",
                        "ranges": [
                          { "to": 50 },
                          { "from": 50, "to": 100 },
                          { "from": 100 }
                        ]
                      },
                      {
                        "name": "avg_price_by_category",
                        "type": "nested_stats",
                        "field": "category",
                        "metric_field": "price",
                        "metric_type": "avg",
                        "metric_name": "average_price"
                      }
                    ]
                  }, null, 2)
                }</code>
              </pre>

              <h4>Common Aggregation Types</h4>
              <ul>
                <li><b>terms:</b> Group documents by field values (like categories)</li>
                <li><b>stats:</b> Calculate min, max, sum, avg, and count for a numeric field</li>
                <li><b>range:</b> Group documents into predefined buckets based on ranges</li>
                <li><b>nested_stats:</b> Combine buckets with metrics (e.g., average price per category)</li>
              </ul>

              <h4>Best Practices</h4>
              <ul>
                <li>Use field mappings optimized for aggregations (keyword fields for terms)</li>
                <li>Consider performance impact when aggregating on high-cardinality fields</li>
                <li>Set appropriate size limits on bucket aggregations</li>
                <li>Use pipeline aggregations for complex analytics</li>
              </ul>
            </div>
          </HelpPanel>
        </ExpandableSection>

        <div style={{ height: "2vh" }} />

        <Box textAlign="center" margin={{ bottom: "m" }}>
          <Button
            iconName="refresh"
            onClick={fetchAggregations}
            variant="primary"
          >
            Load Aggregations
          </Button>
        </Box>

        {aggregations && (
          <SpaceBetween size="l">
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <Container>
                <SpaceBetween size="l">
                  <Box
                    variant="awsui-key-label"
                    padding="s"
                  >
                    <TextContent>
                      <Header variant="h2">Category Distribution</Header>
                    </TextContent>
                    {aggregations.categories.buckets.map(bucket => (
                      <div key={bucket.key} style={{ marginBottom: '10px' }}>
                        <Box variant="p" fontSize="heading-s" fontWeight="bold">{bucket.key}</Box>
                        <ProgressBar
                          value={(bucket.doc_count / aggregations.price_stats.count) * 100}
                          label={`${bucket.doc_count} items`}
                        />
                      </div>
                    ))}
                  </Box>

                  <Box
                    variant="awsui-key-label"
                    padding="s"
                  >
                    <TextContent>
                      <Header variant="h2">Color Distribution</Header>
                    </TextContent>
                    {aggregations.colors.buckets.map(bucket => (
                      <div key={bucket.key} style={{ marginBottom: '10px' }}>
                        <Box variant="p" fontSize="heading-s" fontWeight="bold">{bucket.key}</Box>
                        <ProgressBar
                          value={(bucket.doc_count / aggregations.price_stats.count) * 100}
                          label={`${bucket.doc_count} items`}
                        />
                      </div>
                    ))}
                  </Box>
                </SpaceBetween>
              </Container>

              <Container>
                <SpaceBetween size="l">
                  <Box
                    variant="awsui-key-label"
                    padding="s"
                  >
                    <TextContent>
                      <Header variant="h2">Price Statistics</Header>
                    </TextContent>
                    <ColumnLayout columns={2} variant="text-grid">
                      <div>
                        <Box variant="awsui-key-label">Total Items</Box>
                        <Box variant="p">{aggregations.price_stats.count}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Minimum Price</Box>
                        <Box variant="p">{formatPrice(aggregations.price_stats.min)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Maximum Price</Box>
                        <Box variant="p">{formatPrice(aggregations.price_stats.max)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Average Price</Box>
                        <Box variant="p">{formatPrice(aggregations.price_stats.avg)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Total Value</Box>
                        <Box variant="p">{formatPrice(aggregations.price_stats.sum)}</Box>
                      </div>
                    </ColumnLayout>
                  </Box>

                  <Box
                    variant="awsui-key-label"
                    padding="s"
                  >
                    <TextContent>
                      <Header variant="h2">Price Ranges</Header>
                    </TextContent>
                    {aggregations.price_ranges.buckets.map(bucket => (
                      <div key={bucket.key} style={{ marginBottom: '10px' }}>
                        <Box variant="p" fontSize="heading-s" fontWeight="bold">
                          {bucket.from ? formatPrice(bucket.from) : 'Under'} - {bucket.to ? formatPrice(bucket.to) : 'Over'}
                        </Box>
                        <ProgressBar
                          value={(bucket.doc_count / aggregations.price_stats.count) * 100}
                          label={`${bucket.doc_count} items`}
                        />
                      </div>
                    ))}
                  </Box>

                  <Box
                    variant="awsui-key-label"
                    padding="s"
                  >
                    <TextContent>
                      <Header variant="h2">Average Price by Category</Header>
                    </TextContent>
                    <SpaceBetween size="s">
                      {aggregations.avg_price_by_category.buckets.map(bucket => (
                        <Box
                          key={bucket.key}
                          variant="awsui-key-label"
                          padding="xs"
                        >
                          <Box variant="h3" fontSize="heading-s" fontWeight="bold">{bucket.key}</Box>
                          <ColumnLayout columns={2} variant="text-grid">
                            <div>
                              <Box variant="awsui-key-label">Average Price</Box>
                              <Box variant="p">{formatPrice(bucket.avg_price.value)}</Box>
                            </div>
                            <div>
                              <Box variant="awsui-key-label">Items</Box>
                              <Box variant="p">{bucket.doc_count}</Box>
                            </div>
                          </ColumnLayout>
                        </Box>
                      ))}
                    </SpaceBetween>
                  </Box>
                </SpaceBetween>
              </Container>
            </Grid>
          </SpaceBetween>
        )}
      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(AggregationsPage);