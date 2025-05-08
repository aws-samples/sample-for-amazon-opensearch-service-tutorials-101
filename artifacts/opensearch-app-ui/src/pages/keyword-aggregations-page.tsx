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
            {"to": 5000},
            {"from": 5000, "to": 10000},
            {"from": 10000, "to": 15000},
            {"from": 15000}
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
        handle_notifications("Error fetching aggregations", "error");
      }
    } catch (error) {
      handle_notifications("Error fetching aggregations: " + error, "error");
    }
  }

  useEffect(() => {
    fetchAggregations();
  }, []);

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
                Aggregations provide insights into your product catalog through various metrics and distributions:
                <ul>
                  <li>Category distribution</li>
                  <li>Color distribution</li>
                  <li>Price statistics and ranges</li>
                  <li>Average prices by category</li>
                </ul>
              </p>
            </div>
          </HelpPanel>
        </ExpandableSection>

        <div style={{ height: "2vh" }} />

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