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
  FormField,
  Input,
  Alert,
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
  const [showAlert, setShowAlert] = React.useState(false)
  const [alertMsg, setAlertMsg] = React.useState("")
  const [alertType, setAlertType] = React.useState("error")

  const SafeHtml = ({ html }: { html: string }) => {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

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

  async function wildcard() {
    if (value == "") {
      handle_notifications("Please enter a search term", "error")
      return
    }
    try {
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
      } else {
        handle_notifications("Index not found, please index the product catalog first", "error")
      }
    } catch (error) {
      handle_notifications("Error fetching wildcard search: " + error, "error");
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
        {(showAlert && alertType == 'error') ? <Alert dismissible statusIconAriaLabel="Error" type='error' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'success') ? <Alert dismissible statusIconAriaLabel="Success" type='success' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'warning') ? <Alert dismissible statusIconAriaLabel="Warning" type='warning' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'info') ? <Alert dismissible statusIconAriaLabel="Info" type='info' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
      
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
              <h4>Prerequisites</h4>
              <ul>
                <li><a href="#/index-documents">Index your documents</a> into OpenSearch first</li>
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

          <FormField label="Search Term">
            <Input
              value={value}
              onChange={({ detail }) => setValue(detail.value)}
              placeholder="A wildcard search on Product catalog e.g. W*g"
            />
          </FormField>

          <Button variant="primary" onClick={wildcard}>
            Search
          </Button>

          <Cards cardDefinition={{
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