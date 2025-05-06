import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import Link from "@cloudscape-design/components/link";
import * as React from "react";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import Cards from "@cloudscape-design/components/cards";
import Box from "@cloudscape-design/components/box";
import Grid from "@cloudscape-design/components/grid";


import {
  Container,
  ContentLayout,
  Header, Button,
  SpaceBetween,
  ExpandableSection,
  HelpPanel,
  Icon,
  RadioGroup,
  Slider,
  Checkbox,
  Input
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

function KeywordRangePage(props: AppPage) {
  const appData = useContext(AppContext);
  const [value, setValue] = React.useState(10000);
  const [operator, setOperator] = React.useState("gte");
  const [items, setItems] = React.useState([]);

  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      })
    }
    init();
  }, [])

  async function range_filter(key_details: any) {
    if (key_details['key'] == 'Enter' || key_details['keyCode'] == 13) {
      const token = appData.userinfo.tokens.idToken.toString();
      // call api gateway and pass in the value and set Authorization header
      const response = await fetch(config["apiUrl"] + "/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        },
        body: JSON.stringify({
          "attribute_name": "price",
          "attribute_value": value,
          "operator": operator,
          "type": "range_filter",
        })
      });
      var suggestns = []
      var itms = []
      if (response.ok) {
        // read the response body
        const resp = await response.json();
        const arr = resp['result']['hits']['hits']

        // set the value of the input box to the first result
        // load cards here
        for (let i = 0; i < arr.length; i++) {
          // get the _source
          const source = arr[i]['_source']
          // get the title
          const title = source['title']
          // add to suggestions
          suggestns.push({ value: title })
          itms.push({
            name: title,
            description: source['description'],
            color: source['color'],
            price: "$" + source['price'],
            image_url: source['image_url']
          })
        }
        setItems(itms)
      }
    }
  }

  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
      header={
        <Header
          variant="h1"
          description="Query your Opensearch datastore"
          actions={<Button iconName="settings" variant="icon" />}>
          Keyword Search
        </Header>
      }
    >
      <Container fitHeight
      >
        <ExpandableSection headerText="Guide to Range filter">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://opensearch.org/docs/latest/query-dsl/term/range/">Link to documentation</a>
                  </li>
                </ul>
              </div>
            }

          >
            <div>
              <p>
              <b>Range queries</b> allow you to search for documents where a field's value falls within a specified range. This is particularly useful for numerical values and dates.
              </p>
              <h4>Basic Syntax</h4>
              <pre>
                <code>{
                  JSON.stringify({
                    "query": {
                      "range": {
                        "field_name": {
                          "gte": "lower_value",
                          "lte": "upper_value"
                        }
                      }
                    }
                  })
                }</code>
              </pre>
              
              <h4>Operators</h4>
              <ul>
                <li>gte: Greater than or equal to</li>
                <li>lte: Less than or equal to</li>
                <li>gt: Greater than</li>
                <li>lt: Less than</li>
              </ul>

              <h3>Examples</h3>
              <h4>Numeric Range</h4>
              <pre>
                <code>{
                  JSON.stringify({
                    "query": {
                      "range": {
                        "price": {
                          "gte": 100,
                          "lte": 200
                        }
                      }
                    }
                  })
                }</code>
              </pre>

              <h4>Date Range</h4>
              <pre>
                <code>{
                  JSON.stringify({
                    "query": {
                      "range": {
                        "created_date": {
                          "gte": "2025-01-01",
                          "lte": "2025-12-31",
                          "format": "yyyy-MM-dd"
                        }
                      }
                    }
                  })
                }</code>
              </pre>

              <h4>Best Practices</h4>
              <ul>
                <li>Use the appropriate operator combination for your use case</li>
                <li>For date fields, specify the format when using non-default date patterns</li>
                <li>Consider using range fields for better performance on frequently queried ranges</li>
                <li>Use range aggregations when you need to analyze data distributions</li>
              </ul>
            </div>
          </HelpPanel>
        </ExpandableSection>
        <div>
          <h3>Search by Price</h3>
        </div>

        <Grid gridDefinition={[{ colspan: 3 }, { colspan: 3 }]}>
          <div>
            <RadioGroup onChange={({ detail }) => setOperator(detail.value)} value={operator}
              items={[
                { value: "gte", label: "Greater than equals" },
                { value: "lte", label: "Less than equals" },
                { value: "gt", label: "Greater than" },
                { value: "lt", label: "Less than" }
              ]}
            />
          </div>
          <div>
            <Input
              onChange={({ detail }) => setValue(Number(detail.value))}
              onKeyDown={({ detail }) => range_filter(detail)}
              value={String(value)}
              inputMode="numeric"
              type="number"
            />
          </div>

        </Grid>

        <Grid gridDefinition={[{ colspan: 12 }]}>

          <Cards cardDefinition={{
            header: item => (
              <div>
              <Link fontSize="heading-m">
                {item.name}
              </Link>
              
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              
              <div 
                style={{ 
                  marginTop: '20px', 
                  marginBottom: '10px',
                  fontFamily: "'Tangerine', 'Brush Script MT', cursive",
                  fontSize: '1.5rem',
                  lineHeight: '1.6',
                  color: '#333',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                  padding: '10px',
                  background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0.7))',
                  borderRadius: '8px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}
              >
                {item.description}
              </div>
              <div>
                <img 
                  src={item.image_url} 
                  alt={item.name}
                  style={{ 
                    maxWidth: '20vw', 
                    maxHeight: '20vh', 
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    console.error("Image failed to load:", item.image_url);
                    e.currentTarget.src = "https://via.placeholder.com/300x200?text=Image+Not+Available";
                  }}
                />
              </div>
              </Grid>
            </div>
            ),
            sections: [
              {
                id: "color",
                header: "Color",
                content: item => item.color
              },
              {
                id: "price",
                header: "Price",
                content: item => item.price
              }
            ]
          }}
            cardsPerRow={[
              { cards: 1 },
              { minWidth: 500, cards: 1 }
            ]}
            items={items}
            loadingText="Loading products"
            visibleSections={["title", "description", "color", "price"]}
            empty={
              <Box
                margin={{ vertical: "xs" }}
                textAlign="center"
                color="inherit"
              >
                <SpaceBetween size="m">
                  <b>No resources</b>

                </SpaceBetween>
              </Box>
            }
          />
        </Grid>
      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(KeywordRangePage)