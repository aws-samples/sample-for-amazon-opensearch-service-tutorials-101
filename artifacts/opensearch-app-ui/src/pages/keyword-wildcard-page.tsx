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
  Checkbox
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

function KeywordWildcardPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [value, setValue] = React.useState("");
  const [search_field, setSearchField] = React.useState("title");
  const [caseInsensitive, setCaseInsensitive] = React.useState(true);
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

  async function wildcard(key_details: any) {
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
          "attribute_name": search_field,
          "attribute_value": value,
          "case_insensitive": caseInsensitive,
          "type": "wildcard_match",
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
        <ExpandableSection headerText="Guide to Wildcard Search">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://opensearch.org/docs/latest/query-dsl/term/wildcard/">Link to documentation</a>
                  </li>
                </ul>
              </div>
            }

          >
            <div>
              <p>
                A <b>wildcard</b> search is a powerful feature in OpenSearch that lets you search for terms using pattern matching. This is particularly useful when you're unsure of the exact spelling or want to match multiple variations of a term.
              </p>
              <h4>Basic Operators</h4>
              <ul>
                <li>* - Matches zero or more characters (e.g., "auto*" matches "automatic", "automobile")</li>
                <li>? - Matches exactly one character (e.g., "te?t" matches "test", "text")</li>
              </ul>
              <p>
                <b>In our example</b>, let's search for "Wa*g" across product titles.
                The query would look like:
              </p>
              <pre>
                <code>{
                  JSON.stringify({
                    "query": {
                      "wildcard": {
                        "title": {
                          "value": "Wa*g",
                          "case_insensitive": true
                        }
                      }
                    }
                  })
                }</code>
              </pre>
              <h4>Best Practices</h4>
              <ul>
                <li>Avoid leading wildcards (e.g., "*car") as they are performance-intensive</li>
                <li>Use the case_insensitive parameter (default: false) when case doesn't matter</li>
                <li>Consider using the wildcard field type for better query performance</li>
                <li>Use more specific patterns when possible to reduce the search scope</li>
              </ul> 
            </div>
          </HelpPanel>
        </ExpandableSection>
        <div>
          <h3>Select your search field</h3>
        </div>

        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 5 }]}>

          <div>
            <RadioGroup onChange={({ detail }) => setSearchField(detail.value)} value={search_field}
              items={[
                { value: "title", label: "Title" },
                { value: "description", label: "Description" },
                { value: "color", label: "Color" }
              ]}
            />
          </div>
          <div>
            <Checkbox onChange={({ detail }) => setCaseInsensitive(detail.checked)} checked={caseInsensitive}>Case-Insensitive wildcard search</Checkbox>
          </div>

        </Grid>

        <Grid gridDefinition={[{ colspan: 12 }]}>

          <Autosuggest
            onChange={({ detail }) => setValue(detail.value)}
            value={value}
            options={[]}
            onKeyDown={({ detail }) => wildcard(detail)}
            ariaLabel="Autosuggest example with suggestions"
            placeholder="A wildcard search on Products e.g. W*g"
            empty="No matches found"
          />

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

export default withAuthenticator(KeywordWildcardPage)