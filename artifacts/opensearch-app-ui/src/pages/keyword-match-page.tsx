import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import Link from "@cloudscape-design/components/link";
import * as React from "react";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import Cards from "@cloudscape-design/components/cards";
import Box from "@cloudscape-design/components/box";
import Grid from "@cloudscape-design/components/grid";
import Alert from "@cloudscape-design/components/alert";
import Input from "@cloudscape-design/components/input";

// Add Google Fonts for calligraphy
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);
const SafeHtml = ({ html }: { html: string }) => {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

import {
  Container,
  ContentLayout,
  Header, Button,
  SpaceBetween,
  ExpandableSection,
  HelpPanel,
  Icon,
  RadioGroup,
  Slider
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

function KeywordMatchPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [value, setValue] = React.useState("");
  const [search_field, setSearchField] = React.useState("title");
  const [minimum_should_match, setMinimumShouldMatch] = React.useState(10);
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showAlert, setShowAlert] = React.useState(false)
  const [alertMsg, setAlertMsg] = React.useState("")
  const [alertType, setAlertType] = React.useState("error")


  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      })
    }
    init();
  }, [])

  const handle_notifications = (message, notify_type) => {
    setAlertMsg(message)
    setAlertType(notify_type)
    setShowAlert(true)
  }

  function highlighter(text: string, search_value: string) {
    if (!search_value || !text) {
      return text;
    }

    const lowerText = text.toLowerCase();
    const lowerSearch = search_value.toLowerCase();
    
    if (!lowerText.includes(lowerSearch)) {
      return text;
    }

    let result = '';
    let lastIndex = 0;
    let currentIndex = 0;

    while ((currentIndex = lowerText.indexOf(lowerSearch, lastIndex)) !== -1) {
      result += text.slice(lastIndex, currentIndex);
      result += `<b>${text.slice(currentIndex, currentIndex + search_value.length)}</b>`;
      lastIndex = currentIndex + search_value.length;
    }
    
    result += text.slice(lastIndex);
    return result;
  }

  async function match() {
    // Reset error state
    setError("");
    // Set loading state
    setLoading(true);
    
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
        "type": "match",
        "minimum_should_match": String(minimum_should_match) + "%"
      })
    });
    var suggestns = []
    var itms = []
    if (response.ok) {
      // read the response body
      const resp = await response.json();
      console.log("Search response:", resp); // Debug log to see the full response
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
              name: highlighter(source['title'], value),
              title: source['title'],
              description: highlighter(source['description'], value),
              color: highlighter(source['color'], value),
              price: "$" + highlighter(String(source['price']), String(value)),
              image_url: source['image_url']
            })
      }
      setItems(itms)
    } else {
      // Handle error response
      const errorText = await response.text();
      if (errorText.includes('index_not_found_exception')) {
        handle_notifications("Index not found, please index the product catalog first", "error")
      } else {
        handle_notifications(errorText, "error")
      }
      console.error("Search API error:", response.status, errorText);
      setError(`Error fetching search results: ${response.status} ${response.statusText}`);
      
    }
    // End loading state
    setLoading(false);
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
        {(showAlert && alertType == 'error') ? <Alert dismissible statusIconAriaLabel="Error" type='error' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'success') ? <Alert dismissible statusIconAriaLabel="Success" type='success' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'warning') ? <Alert dismissible statusIconAriaLabel="Warning" type='warning' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'info') ? <Alert dismissible statusIconAriaLabel="Info" type='info' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
      
        <ExpandableSection headerText="Guide to Minimum-Should-Match Search">
                  <HelpPanel
                    footer={
                      <div>
                        <h3>
                          Learn more{" "}
                          <Icon name="external" size="inherit" />
                        </h3>
                        <ul>
                          <li>
                            <a href="https://opensearch.org/docs/latest/query-dsl/minimum-should-match/">Link to documentation</a>
                          </li>
                        </ul>
                      </div>
                    }
                    
                  >
                    <div>
                      <p>
                      The <b>minimum_should_match</b> parameter in Opensearch is a powerful tool that lets you control how many search terms must match for a document to be included in the results.
                      This is particularly useful when searching across multiple terms and you want to ensure a certain level of relevance. You can specify this either as a number (2) or as a percentage (75%).
                      </p>
                      <h4>Prerequisites</h4>
                        <ul>
                          <li><a href="#/index-documents">Index your documents</a> into OpenSearch first</li>
                        </ul>
                      <p>
                        <b>In our example</b>, let's search for "red running wolves" across product descriptions. Using minimum_should_match, we can specify that at least 2 out of these 3 terms must be present for a result to be returned. Use the slider to adjust how many terms must match.
                        The query would look like:
                      </p>
                      <pre>
                          <code>{
                          JSON.stringify({"query": {
                            "match": {
                              "title": {
                                "query": "red running wolves",
                                "minimum_should_match": "(2 or 75%)"
                              }
                            }
                          }
                        })
                        }</code>
                        </pre>
                      <h4>Best Practices</h4>
                      <ul>
                        <li>Use percentages (e.g., "75%") for queries with varying numbers of terms</li>
                        <li>Start with higher values for more precise results</li>
                        <li>Consider lower values when recall is more important than precision</li>
                      </ul>
                    </div>
                  </HelpPanel>
        </ExpandableSection>
        <div>
          <h3>Select your search field</h3>
        </div>

        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 8 }]}>
        
        <div>
          <RadioGroup onChange={({ detail }) => setSearchField(detail.value)} value={search_field} 
            items={[
              { value: "title", label: "Title"},
              { value: "description", label: "Description" },
              { value: "color", label: "Color" }
              ]}
         />
        </div>
        <div>
        <label><b>Set your <i>minimum-should-match</i> percentage</b></label>
        <Slider onChange={({ detail }) => setMinimumShouldMatch(detail.value)} step={5} tickMarks value={minimum_should_match} max={100} min={10} />
        </div>

        </Grid>

        <Grid gridDefinition={[{ colspan: 12 }]}>
        <div>
          <Input
              value={value}
              onChange={({ detail }) => setValue(detail.value)}
              placeholder="A match search on Products e.g. Red Running Shoes"
            />
        </div>
        <div>
          <Button variant="primary" onClick={match}>
            Search
          </Button>
        </div>
        </Grid>
        

        <Grid gridDefinition={[{ colspan: 12 }]}>
          
          <Cards 
            loading={loading}
            cardDefinition={{
            header: item => (
              <div>
                <Link fontSize="heading-m">
                <SafeHtml html={item.name} />
                </Link>
              </div>
            ),
            sections: [
              {
                id: "description",
                header: "Description",
                content: item => (
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
                  <SafeHtml html={item.description} />
                </div>
                )
              },
              {
                id: "color",
                header: "Color",
                content: item => <SafeHtml html={item.color} />
              },
              {
                id: "price",
                header: "Price",
                content: item => <SafeHtml html={item.price} />
              },
              {
                id: "image",
                header: "Image",
                content: item => (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                )
              }
            ]
          }}
            cardsPerRow={[
              { cards: 1 },
              { minWidth: 500, cards: 2 }
            ]}
            items={items}
            loadingText="Loading products"
            visibleSections={["description", "color", "price", "image"]}
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

export default withAuthenticator(KeywordMatchPage)
